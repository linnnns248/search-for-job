import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type HuaweiJob = {
  jobId?: string | number;
  dataSource?: string | number;
  jobname?: string;
  nameCn?: string;
  mainBusiness?: string;
  jobRequire?: string;
  jobArea?: string;
  jobAddress?: string;
  jobType?: string;
};

type HuaweiListResponse = {
  pageVO?: {
    totalRows?: string | number;
    totalPages?: string | number;
  };
  result?: HuaweiJob[];
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseHuaweiPage(
  response: HuaweiListResponse,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  const total = Number(response.pageVO?.totalRows);
  const rows = response.result;
  if (!Number.isFinite(total) || !Array.isArray(rows)) {
    throw new Error("华为招聘列表缺少岗位数据");
  }
  const origin = new URL(source.careersUrl).origin;
  const jobs = rows.flatMap((row) => {
    const jobId = String(row.jobId ?? "").trim();
    const dataSource = String(row.dataSource ?? "").trim();
    if (!jobId || !dataSource) return [];
    const duty = clean(row.mainBusiness);
    const requirement = clean(row.jobRequire);
    const candidate = buildOfficialCandidate(source, {
      title: clean(row.jobname) || clean(row.nameCn),
      description: [duty && `工作职责：${duty}`, requirement && `任职资格：${requirement}`]
        .filter(Boolean).join(" "),
      salary: "",
      education: requirement,
      employmentType: source.huawei?.employmentType ?? null,
      city: clean(row.jobArea) || clean(row.jobAddress),
      url: `${origin}/reccampportal/portal5/social-recruitment-detail.html?jobId=${encodeURIComponent(jobId)}&dataSource=${encodeURIComponent(dataSource)}`,
    });
    return candidate ? [candidate] : [];
  });
  return { total, jobs };
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectHuaweiJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.huawei) throw new Error("华为来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const keyword of searchConfig.titleIncludeKeywords) {
    for (let pageNo = 1; pageNo <= source.huawei.maximumPagesPerKeyword; pageNo += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const endpoint = new URL(
        `/reccampportal/services/portal/portalpub/getJob/newHr/page/${source.huawei.pageSize}/${pageNo}`,
        origin,
      );
      endpoint.search = new URLSearchParams({
        keywords: keyword,
        searchType: "1",
        orderBy: "P_COUNT_DESC",
        jobType: "1",
      }).toString();
      const response = await fetchOfficialJson<HuaweiListResponse>(
        endpoint.toString(),
        [host],
        config.collection,
        { referer: source.careersUrl },
      );
      const parsed = parseHuaweiPage(response, source);
      for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
      if (parsed.jobs.length === 0 || pageNo * source.huawei.pageSize >= parsed.total) break;
    }
  }

  return [...bySourceKey.values()].slice(0, config.collection.maximumDetailsPerSource);
}
