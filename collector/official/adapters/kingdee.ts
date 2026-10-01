import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type JsonObject = Record<string, unknown>;

interface KingdeePage {
  code?: number;
  message?: string;
  data?: {
    size?: number;
    content?: unknown[];
  };
}

function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number") return String(value);
  return "";
}

function salary(value: unknown): string {
  const [minimum, maximum] = text(value).split(",").map((part) => Number(part));
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return "";
  return `${Math.round(minimum / 1000)}-${Math.round(maximum / 1000)}K`;
}

export function parseKingdeePage(
  page: KingdeePage,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  if (page.code !== 200 || !page.data || !Array.isArray(page.data.content)
    || !Number.isFinite(page.data.size)) {
    throw new Error(`金蝶招聘接口返回异常：${page.message || "未知错误"}`);
  }
  const origin = new URL(source.careersUrl).origin;
  const jobs = page.data.content.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as JsonObject;
    const id = text(row.id);
    if (!id) return [];
    const description = text(row.jobDescription);
    const candidate = buildOfficialCandidate(source, {
      title: text(row.jobTitle),
      description,
      salary: salary(row.jobSalary),
      education: [text(row.demandEducation), description].filter(Boolean).join(" "),
      employmentType: "full-time",
      city: [text(row.jobCity), text(row.jobDistrict)].filter(Boolean).join("·"),
      url: `${origin}/zpxq1?id=${encodeURIComponent(id)}&social=false`,
    });
    return candidate ? [candidate] : [];
  });
  return { total: page.data.size as number, jobs };
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectKingdeeJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const endpoint = `${origin}/cmsadmin/recruit/queryJobList`;
  const pageSize = source.kingdee?.pageSize ?? 100;
  const maximumPages = source.kingdee?.maximumPagesPerKeyword ?? 3;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const keyword of searchConfig.titleIncludeKeywords) {
    for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const response = await fetchOfficialJson<KingdeePage>(endpoint, [host], config.collection, {
        referer: source.careersUrl,
        body: { page: pageNumber, size: pageSize, campus: false, keyword },
      });
      const parsed = parseKingdeePage(response, source);
      for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
      if (parsed.jobs.length === 0 || pageNumber * pageSize >= parsed.total) break;
    }
  }

  return [...bySourceKey.values()];
}
