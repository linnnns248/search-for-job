import { load } from "cheerio";
import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type JsonObject = Record<string, unknown>;

interface ZhiyePage {
  Code?: number;
  Message?: string;
  Count?: number;
  Data?: unknown[];
}

function text(value: unknown): string {
  if (typeof value === "string") {
    return load(`<body>${value}</body>`)("body").text().replace(/\s+/g, " ").trim();
  }
  if (typeof value === "number") return String(value);
  return "";
}

function textList(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join("、");
  return text(value);
}

function employmentType(value: unknown): OfficialJobCandidate["employmentType"] {
  const normalized = text(value).toLocaleLowerCase().replace(/[\s_-]+/g, "");
  if (/全职|fulltime|社会招聘|社招|校园招聘|校招|正式/u.test(normalized)) return "full-time";
  if (/兼职|parttime/u.test(normalized)) return "part-time";
  return null;
}

function detailPath(category: "1" | "2"): string {
  return category === "2" ? "campus/detail" : "social/detail";
}

function listPath(category: "1" | "2"): string {
  return category === "2" ? "campus/jobs" : "social/jobs";
}

export function parseZhiyePage(
  page: ZhiyePage,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  if (page.Code !== 200 || !Array.isArray(page.Data) || !Number.isFinite(page.Count)) {
    throw new Error(`智易招聘接口返回异常：${page.Message || "未知错误"}`);
  }
  const category = source.zhiye?.category ?? "1";
  const origin = new URL(source.careersUrl).origin;
  const jobs = page.Data.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as JsonObject;
    const jobAdId = text(row.Id);
    if (!jobAdId) return [];
    const duty = text(row.Duty);
    const requirement = text(row.Require);
    const candidate = buildOfficialCandidate(source, {
      title: text(row.JobAdName),
      description: [duty && `工作职责：${duty}`, requirement && `任职资格：${requirement}`]
        .filter(Boolean).join(" "),
      salary: text(row.Salary),
      education: [text(row.Degree), requirement].filter(Boolean).join(" "),
      employmentType: employmentType(row.Kind ?? row.Category),
      city: textList(row.LocNames),
      url: `${origin}/${detailPath(category)}?jobAdId=${encodeURIComponent(jobAdId)}`,
    });
    return candidate ? [candidate] : [];
  });
  return { total: page.Count as number, jobs };
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectZhiyeJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const endpoint = `${origin}/api/Jobad/GetJobAdPageList`;
  const category = source.zhiye?.category ?? "1";
  const pageSize = source.zhiye?.pageSize ?? 100;
  const maximumPages = source.zhiye?.maximumPagesPerKeyword ?? 10;
  const referer = `${origin}/${listPath(category)}`;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const keyword of searchConfig.titleIncludeKeywords) {
    for (let pageIndex = 0; pageIndex < maximumPages; pageIndex += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const response = await fetchOfficialJson<ZhiyePage>(endpoint, [host], config.collection, {
        referer,
        body: {
          PageIndex: pageIndex,
          PageSize: pageSize,
          ClassificationOne: [],
          Category: [category],
          KeyWords: keyword,
          SpecialType: 0,
          PortalId: "",
          DisplayFields: [
            "Category",
            "Kind",
            "LocId",
            "PostDate",
            "ClassificationOne",
            "ClassificationTwo",
            "WorkWeChatQrCode",
          ],
        },
      });
      const parsed = parseZhiyePage(response, source);
      for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
      if (parsed.jobs.length === 0 || (pageIndex + 1) * pageSize >= parsed.total) break;
    }
  }

  return [...bySourceKey.values()];
}
