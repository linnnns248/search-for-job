import { load } from "cheerio";
import type { AnyNode } from "domhandler";
import type { EducationLevel, EmploymentType } from "../../src/types";
import type { BossJobCandidate } from "../types";

const cardSelectors = [".job-card-wrapper", ".job-card-box", ".job-list-box li"];
const detailSelectors = [".job-sec-text", ".job-detail-section", ".job-detail", ".job-description"];

const educationPatterns: Array<{ level: EducationLevel; label: string; pattern: RegExp }> = [
  { level: "doctor", label: "博士", pattern: /博士(?:及以上)?/ },
  { level: "master", label: "硕士", pattern: /硕士(?:及以上)?/ },
  { level: "bachelor", label: "本科", pattern: /本科(?:及以上)?/ },
  { level: "associate", label: "大专", pattern: /大专(?:及以上)?/ },
  { level: "high-school", label: "高中", pattern: /高中(?:及以上)?/ },
  { level: "technical-school", label: "中专/中技", pattern: /中专|中技/ },
  { level: "middle-school", label: "初中及以下", pattern: /初中(?:及以下)?/ },
];

export const educationRanks: Record<EducationLevel, number> = {
  "middle-school": 1,
  "technical-school": 2,
  "high-school": 3,
  associate: 4,
  bachelor: 5,
  master: 6,
  doctor: 7,
};

export function decodeBossText(value: string): string {
  return value.replace(/[\uE031-\uE03A]/g, (character) => String(character.codePointAt(0)! - 0xE031));
}

function firstText($element: ReturnType<ReturnType<typeof load>>, selectors: string[]): string {
  for (const selector of selectors) {
    const value = decodeBossText($element.find(selector).first().text()).replace(/\s+/g, " ").trim();
    if (value) return value;
  }
  return "";
}

function firstAttribute(
  $element: ReturnType<ReturnType<typeof load>>,
  selectors: string[],
  attribute: string,
): string {
  for (const selector of selectors) {
    const value = $element.find(selector).first().attr(attribute)?.trim();
    if (value) return value;
  }
  return "";
}

export function parseCompanySizeMin(value: string): number | null {
  const normalized = value.replace(/,/g, "").replace(/\s+/g, "");
  const range = normalized.match(/(\d+)\s*[-—~至]\s*(\d+)\s*人/);
  if (range) return Number(range[1]);
  const above = normalized.match(/(\d+)\s*人(?:以上|及以上)/);
  if (above) return Number(above[1]);
  const plain = normalized.match(/(\d+)\s*人/);
  return plain ? Number(plain[1]) : null;
}

export function parseSalary(value: string): { minimumK: number | null; maximumK: number | null } {
  const normalized = value.replace(/\s+/g, "").toUpperCase();
  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-—~至]\s*(\d+(?:\.\d+)?)\s*K/);
  if (range) return { minimumK: Number(range[1]), maximumK: Number(range[2]) };
  const single = normalized.match(/(\d+(?:\.\d+)?)\s*K/);
  const amount = single ? Number(single[1]) : null;
  return { minimumK: amount, maximumK: amount };
}

export function parseEducationRequirement(value: string): { label: string; level: EducationLevel | null } {
  const normalized = value.replace(/\s+/g, "");
  for (const candidate of educationPatterns) {
    if (candidate.pattern.test(normalized)) return { label: candidate.label, level: candidate.level };
  }
  return { label: "", level: null };
}

export function parseBossSearchPage(
  html: string,
  city: string,
  employmentType: EmploymentType = "full-time",
): BossJobCandidate[] {
  const $ = load(html);
  let cards = $(cardSelectors[0]);
  for (const selector of cardSelectors.slice(1)) {
    if (cards.length > 0) break;
    cards = $(selector);
  }

  // Boss 会调整卡片 class 名，但岗位链接和公司链接的 URL 形态相对稳定。
  // 当已知卡片选择器失效时，从岗位链接向上寻找包含公司链接的最小容器。
  if (cards.length === 0) {
    const fallbackElements: AnyNode[] = [];
    const seenElements = new Set<unknown>();
    $("a[href*='/job_detail/']").each((_, linkElement) => {
      let container = $(linkElement).parent();
      for (let depth = 0; depth < 7 && container.length > 0; depth += 1) {
        if (container.find("a[href*='/gongsi/']").length > 0) break;
        container = container.parent();
      }
      const element = container.get(0);
      if (element && container.find("a[href*='/gongsi/']").length > 0 && !seenElements.has(element)) {
        seenElements.add(element);
        fallbackElements.push(element);
      }
    });
    cards = $(fallbackElements);
  }

  return cards
    .map((_, element) => {
      const card = $(element);
      const title = firstText(card, [
        ".job-name",
        ".job-title",
        ".job-info .name",
        "a[href*='/job_detail/']",
      ]);
      const company = firstText(card, [
        ".company-name",
        ".company-info .name",
        ".company-text h3",
        "a[href*='/gongsi/']",
      ]);
      const salary = firstText(card, [".salary", ".job-salary"]);
      const companySize = firstText(card, [
        ".company-tag-list li:last-child",
        ".company-info .company-tag-list li:last-child",
        ".company-text p",
      ]);
      const href = firstAttribute(card, ["a.job-card-left", "a.job-name", "a[href*='/job_detail/']"], "href");
      const salaryRange = parseSalary(salary);
      const education = parseEducationRequirement(decodeBossText(card.text()));
      const url = href ? new URL(href, "https://www.zhipin.com").toString() : "";

      return {
        company,
        companySize,
        companySizeMin: parseCompanySizeMin(companySize),
        title,
        salary: salary || "未披露",
        salaryMinK: salaryRange.minimumK,
        salaryMaxK: salaryRange.maximumK,
        education: education.label,
        educationLevel: education.level,
        employmentType,
        city,
        url,
        description: "",
      } satisfies BossJobCandidate;
    })
    .get()
    .filter((job) => job.company && job.title && job.url);
}

export function parseBossJobDescription(html: string): string {
  const $ = load(html);
  for (const selector of detailSelectors) {
    const description = $(selector).first().text().replace(/\s+/g, " ").trim();
    if (description) return description;
  }
  return "";
}

export function parseBossCompanySize(html: string): string {
  const $ = load(html);
  const preferredSelectors = [
    ".sider-company",
    ".company-info",
    ".job-detail-company",
    ".company-card",
  ];
  const sizePattern = /(\d[\d,]*\s*(?:[-—~至]\s*\d[\d,]*)?\s*人(?:以上|及以上)?)/;

  for (const selector of preferredSelectors) {
    const match = $(selector).text().replace(/\s+/g, " ").match(sizePattern);
    if (match) return match[1].replace(/\s+/g, "");
  }

  const bodyMatch = $("body").text().replace(/\s+/g, " ").match(sizePattern);
  return bodyMatch ? bodyMatch[1].replace(/\s+/g, "") : "";
}

export function isBossLoginOrVerificationPage(url: string, html: string): boolean {
  const normalizedUrl = url.toLowerCase();
  if (/login|security-check|verify|captcha|\/web\/user\//.test(normalizedUrl)) return true;
  const $ = load(html);
  if ($("body").hasClass("login-page")) return true;
  const visibleText = $("body").text().replace(/\s+/g, " ");
  return /扫码登录|微信扫码|验证码登录|手机验证码登录|安全验证|完成验证|请输入验证码/.test(visibleText);
}
