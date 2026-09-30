import { load } from "cheerio";
import { parseEducationRequirement, parseSalary } from "../../boss/parse";
import { buildOfficialCandidate } from "../parse";
import type { OfficialJobCandidate, OfficialSiteSource } from "../types";

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseCloudViewList(html: string, source: OfficialSiteSource): OfficialJobCandidate[] {
  const $ = load(html);
  return $(".job-card").map((_, element) => {
    const card = $(element);
    const href = card.attr("href");
    const meta = normalizeText(card.find(".job-meta").text()).split(/[｜|]/u).map((item) => item.trim());
    const title = normalizeText(card.find("h3").first().text());
    const salary = normalizeText(card.find("strong").first().text());
    const description = normalizeText(card.find("p").not(".job-meta").first().text());
    if (!href) return null;
    return buildOfficialCandidate(source, {
      title,
      description,
      salary,
      education: "",
      employmentType: /校招|社招|全职|正式/u.test(meta[1] ?? "") ? "full-time" : null,
      city: meta[0] ?? "",
      url: new URL(href, source.careersUrl).toString(),
    });
  }).get().filter((job): job is OfficialJobCandidate => job !== null);
}

export function parseCloudViewDetail(
  html: string,
  candidate: OfficialJobCandidate,
): OfficialJobCandidate {
  const $ = load(html);
  const blocks = $(".detail-block").map((_, element) => normalizeText($(element).text())).get();
  const description = blocks.join("\n").trim();
  if (!description) throw new Error(`云览科技岗位详情为空：${candidate.url}`);
  const education = parseEducationRequirement(description);
  const salary = parseSalary(candidate.salary);
  return {
    ...candidate,
    description,
    education: education.label,
    educationLevel: education.level,
    salaryMinK: salary.minimumK,
    salaryMaxK: salary.maximumK,
  };
}

export function assertCloudViewDetailsAreDistinct(jobs: OfficialJobCandidate[]): void {
  if (jobs.length < 2) return;
  const descriptions = new Set(jobs.map((job) => job.description));
  if (descriptions.size === 1) {
    throw new Error("云览科技多个详情链接返回了相同正文，已停止发布以避免错误岗位描述");
  }
}
