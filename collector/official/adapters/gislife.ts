import { load } from "cheerio";
import { fetchOfficialHtml } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function parseGisLifeJobs(
  html: string,
  source: OfficialSiteSource,
): OfficialJobCandidate[] {
  const $ = load(html);
  return $("table.list tbody > tr.li").map((_, element) => {
    const row = $(element);
    const cells = row.children("td");
    const title = compact(cells.eq(0).text());
    const city = compact(cells.eq(2).text());
    const detail = row.next("tr.fold");
    const sections = detail.find(".require .item .richText");
    const responsibilities = compact(sections.eq(0).text());
    const requirements = compact(sections.eq(1).text());
    return buildOfficialCandidate(source, {
      title,
      description: [
        responsibilities && `岗位职责：${responsibilities}`,
        requirements && `任职要求：${requirements}`,
      ].filter(Boolean).join(" "),
      salary: "",
      education: requirements,
      employmentType: "full-time",
      city,
      url: `${source.careersUrl}#job=${encodeURIComponent(title)}`,
    });
  }).get().filter((candidate): candidate is OfficialJobCandidate => candidate !== null);
}

export async function collectGisLifeJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
): Promise<OfficialJobCandidate[]> {
  const host = new URL(source.careersUrl).hostname;
  const page = await fetchOfficialHtml(source.careersUrl, [host], config.collection);
  const jobs = parseGisLifeJobs(page.html, source);
  if (jobs.length === 0) throw new Error("空间座标官网没有识别到岗位，原数据保持不变");
  return jobs;
}
