import { createHash } from "node:crypto";
import { load } from "cheerio";
import { parseEducationRequirement, parseSalary } from "../boss/parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  SelectorAdapterConfig,
} from "./types";

type JsonObject = Record<string, unknown>;

function plainText(value: unknown): string {
  if (typeof value !== "string") return "";
  return load(`<body>${value}</body>`)("body").text().replace(/\s+/g, " ").trim();
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function firstString(value: unknown): string {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = firstString(item);
      if (result) return result;
    }
    return "";
  }
  if (value && typeof value === "object") {
    const object = value as JsonObject;
    return firstString(object.addressLocality)
      || firstString(object.address)
      || firstString(object.name)
      || firstString(object.value);
  }
  return stringValue(value);
}

function collectJobPostings(value: unknown, result: JsonObject[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, result);
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as JsonObject;
  const type = object["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => item === "JobPosting")) result.push(object);
  if (object["@graph"]) collectJobPostings(object["@graph"], result);
}

function employmentType(value: unknown): OfficialJobCandidate["employmentType"] {
  const normalized = firstString(value).toLocaleLowerCase().replace(/[\s_-]+/g, "");
  if (/fulltime|全职|社会招聘|社招|校园招聘|校招|正式/.test(normalized)) return "full-time";
  if (/parttime|兼职/.test(normalized)) return "part-time";
  return null;
}

function salaryText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const object = value as JsonObject;
  const currency = stringValue(object.currency);
  const raw = object.value;
  if (raw && typeof raw === "object") {
    const salary = raw as JsonObject;
    const minimum = stringValue(salary.minValue);
    const maximum = stringValue(salary.maxValue);
    const unit = stringValue(salary.unitText);
    if (minimum && maximum) return `${minimum}-${maximum}${unit}${currency ? ` ${currency}` : ""}`.trim();
    if (minimum || maximum) return `${minimum || maximum}${unit}${currency ? ` ${currency}` : ""}`.trim();
  }
  return firstString(raw);
}

function stableKey(source: OfficialSiteSource, url: string, title: string, city: string): string {
  const key = url || `${source.id}|${title}|${city}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 20);
}

function toCandidate(
  source: OfficialSiteSource,
  fields: {
    title: string;
    description: string;
    salary: string;
    education: string;
    employmentType: OfficialJobCandidate["employmentType"];
    city: string;
    url: string;
  },
): OfficialJobCandidate | null {
  if (!fields.title || !fields.url || !source.companySize || source.companySizeMin === null) return null;
  const education = parseEducationRequirement(fields.education || fields.description);
  const salary = parseSalary(fields.salary);
  return {
    sourceId: source.id,
    sourceName: `${source.company}官网`,
    company: source.company,
    companySize: source.companySize,
    companySizeMin: source.companySizeMin,
    title: fields.title,
    description: fields.description,
    salary: fields.salary || "未披露",
    salaryMinK: salary.minimumK,
    salaryMaxK: salary.maximumK,
    education: education.label,
    educationLevel: education.level,
    employmentType: fields.employmentType,
    city: fields.city,
    url: fields.url,
    sourceKey: stableKey(source, fields.url, fields.title, fields.city),
  };
}

export function parseJsonLdJobs(html: string, source: OfficialSiteSource): OfficialJobCandidate[] {
  const $ = load(html);
  const postings: JsonObject[] = [];
  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).text().trim();
    if (!raw) return;
    try {
      collectJobPostings(JSON.parse(raw), postings);
    } catch {
      // A malformed block must not prevent other valid JSON-LD blocks from being parsed.
    }
  });
  return postings.flatMap((posting) => {
    const hiringOrganization = posting.hiringOrganization as JsonObject | undefined;
    const location = posting.jobLocation as JsonObject | JsonObject[] | undefined;
    const url = stringValue(posting.url)
      || stringValue(posting.sameAs)
      || source.careersUrl;
    const candidate = toCandidate(source, {
      title: plainText(posting.title),
      description: plainText(posting.description),
      salary: salaryText(posting.baseSalary),
      education: firstString(posting.educationRequirements)
        || plainText(posting.educationRequirements)
        || firstString(posting.qualifications)
        || plainText(posting.qualifications),
      employmentType: employmentType(posting.employmentType),
      city: firstString(location),
      url: new URL(url, source.careersUrl).toString(),
    });
    if (candidate && hiringOrganization && !candidate.company) {
      candidate.company = firstString(hiringOrganization.name) || source.company;
    }
    return candidate ? [candidate] : [];
  });
}

export function parseOfficialList(html: string, source: OfficialSiteSource): OfficialJobCandidate[] {
  if (source.adapter === "json-ld") return parseJsonLdJobs(html, source);
  if (source.adapter === "selector" && source.selectors) {
    return parseSelectorJobs(html, source, source.selectors);
  }
  throw new Error(`官网来源 ${source.id} 的 ${source.adapter} 适配器尚未实现`);
}

function textFrom(card: ReturnType<ReturnType<typeof load>>, selector?: string): string {
  return selector ? card.find(selector).first().text().replace(/\s+/g, " ").trim() : "";
}

export function parseSelectorJobs(
  html: string,
  source: OfficialSiteSource,
  selectors: SelectorAdapterConfig,
): OfficialJobCandidate[] {
  const $ = load(html);
  return $(selectors.card).map((_, element) => {
    const card = $(element);
    const link = card.find(selectors.url).first();
    const href = selectors.urlAttribute
      ? link.attr(selectors.urlAttribute)
      : link.attr("href");
    if (!href) return null;
    return toCandidate(source, {
      title: textFrom(card, selectors.title),
      description: textFrom(card, selectors.description),
      salary: textFrom(card, selectors.salary),
      education: textFrom(card, selectors.education),
      employmentType: employmentType(textFrom(card, selectors.employmentType)),
      city: textFrom(card, selectors.city),
      url: new URL(href, source.careersUrl).toString(),
    });
  }).get().filter((candidate): candidate is OfficialJobCandidate => candidate !== null);
}
