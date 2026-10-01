import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type OppoJob = {
  positionId?: string | number;
  publishName?: string;
  unifiedName?: string;
  jobName?: string;
  workCityName?: string;
  educationRequire?: string;
  jobDuty?: string;
  workRequire?: string;
};

type OppoListResponse = {
  code?: string | number;
  msg?: string;
  data?: {
    pageNum?: string | number;
    pageSize?: string | number;
    pages?: string | number;
    total?: string | number;
    list?: OppoJob[];
  };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseOppoPage(
  response: OppoListResponse,
  source: OfficialSiteSource,
): { total: number; pages: number; jobs: OfficialJobCandidate[] } {
  if (Number(response.code) !== 0) {
    throw new Error(`OPPO 招聘接口返回异常：${response.msg || "未知错误"}`);
  }
  const total = Number(response.data?.total);
  const pages = Number(response.data?.pages);
  const rows = response.data?.list;
  if (!Number.isFinite(total) || !Number.isFinite(pages) || !Array.isArray(rows)) {
    throw new Error("OPPO 招聘列表缺少岗位数据");
  }
  const origin = new URL(source.careersUrl).origin;
  const jobs = rows.flatMap((row) => {
    const positionId = String(row.positionId ?? "").trim();
    if (!positionId) return [];
    const duty = clean(row.jobDuty);
    const requirement = clean(row.workRequire);
    const candidate = buildOfficialCandidate(source, {
      title: clean(row.publishName) || clean(row.unifiedName) || clean(row.jobName),
      description: [duty && `工作职责：${duty}`, requirement && `任职资格：${requirement}`]
        .filter(Boolean).join(" "),
      salary: "",
      education: requirement || clean(row.educationRequire),
      employmentType: source.oppo?.employmentType ?? null,
      city: clean(row.workCityName),
      url: `${origin}/official/oppo/recruitment/post/${encodeURIComponent(positionId)}`,
    });
    return candidate ? [candidate] : [];
  });
  return { total, pages, jobs };
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectOppoJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.oppo) throw new Error("OPPO 来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const endpoint = `${origin}/ats-candidate-api/open-api/position/queryPositionList`;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const city of searchConfig.cities) {
    const cityCode = source.oppo.cityCodes[city];
    if (!cityCode) throw new Error(`OPPO 来源缺少城市编码：${city}`);
    for (let pageNum = 1; pageNum <= source.oppo.maximumPagesPerCity; pageNum += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const response = await fetchOfficialJson<OppoListResponse>(
        endpoint,
        [host],
        config.collection,
        {
          body: {
            pageNum,
            pageSize: source.oppo.pageSize,
            publishName: "",
            workCityCodeList: [cityCode],
            jobTypeList: [],
            recruitTypeList: [source.oppo.recruitType],
            shareId: "",
          },
          referer: source.careersUrl,
        },
      );
      const parsed = parseOppoPage(response, source);
      for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
      if (parsed.jobs.length === 0 || pageNum >= parsed.pages
        || pageNum * source.oppo.pageSize >= parsed.total) break;
    }
  }

  return [...bySourceKey.values()].slice(0, config.collection.maximumDetailsPerSource);
}
