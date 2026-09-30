import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type MeituanNamedValue = { name?: string };

type MeituanJob = {
  jobUnionId?: string;
  name?: string;
  jobType?: string;
  jobStatus?: string;
  cityList?: MeituanNamedValue[];
  jobDuty?: string;
  jobRequirement?: string;
};

type MeituanListResponse = {
  status?: number;
  message?: string;
  data?: {
    list?: MeituanJob[];
    page?: {
      pageNo?: number;
      pageSize?: number;
      totalPage?: number;
      totalCount?: number;
    };
  };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseMeituanPage(
  response: MeituanListResponse,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  if (response.status !== 1) {
    throw new Error(`美团招聘接口返回异常：${response.message || "未知错误"}`);
  }
  const total = response.data?.page?.totalCount;
  const rows = response.data?.list;
  if (total === 0 && (rows === undefined || rows === null)) {
    return { total: 0, jobs: [] };
  }
  if (!Number.isFinite(total) || !Array.isArray(rows)) {
    throw new Error("美团招聘列表缺少岗位数据");
  }
  const origin = new URL(source.careersUrl).origin;
  const jobs = rows.flatMap((row) => {
    const jobUnionId = clean(row.jobUnionId);
    if (!jobUnionId || (row.jobStatus && row.jobStatus !== "000")) return [];
    const duty = clean(row.jobDuty);
    const requirement = clean(row.jobRequirement);
    const candidate = buildOfficialCandidate(source, {
      title: clean(row.name),
      description: [duty && `工作职责：${duty}`, requirement && `任职资格：${requirement}`]
        .filter(Boolean).join(" "),
      salary: "",
      education: requirement,
      employmentType: source.meituan?.employmentType ?? null,
      city: (row.cityList ?? []).map((city) => clean(city.name)).filter(Boolean).join("、"),
      url: `${origin}/web/position/detail?highlightType=social&jobUnionId=${encodeURIComponent(jobUnionId)}`,
    });
    return candidate ? [candidate] : [];
  });
  return { total: total as number, jobs };
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectMeituanJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.meituan) throw new Error("美团来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const endpoint = `${origin}/api/official/job/getJobList`;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const city of searchConfig.cities) {
    const cityCode = source.meituan.cityCodes[city];
    if (!cityCode) throw new Error(`美团来源缺少城市编码：${city}`);
    for (const keyword of searchConfig.titleIncludeKeywords) {
      for (let pageNo = 1; pageNo <= source.meituan.maximumPagesPerKeyword; pageNo += 1) {
        if (requestCount > 0) {
          await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
        }
        requestCount += 1;
        const response = await fetchOfficialJson<MeituanListResponse>(
          endpoint,
          [host],
          config.collection,
          {
            referer: source.careersUrl,
            body: {
              page: { pageNo, pageSize: source.meituan.pageSize },
              jobShareType: "1",
              keywords: keyword,
              cityList: [{ code: cityCode }],
              department: [],
              jfJgList: [],
              jobType: [{ code: source.meituan.jobTypeCode, subCode: [] }],
              typeCode: [],
              specialCode: [],
            },
          },
        );
        const parsed = parseMeituanPage(response, source);
        for (const job of parsed.jobs) {
          const titleMatches = searchConfig.titleIncludeKeywords.some((candidate) =>
            job.title.toLocaleLowerCase().includes(candidate.toLocaleLowerCase()),
          );
          if (titleMatches) bySourceKey.set(job.sourceKey, job);
        }
        if (parsed.jobs.length === 0 || pageNo * source.meituan.pageSize >= parsed.total) break;
      }
    }
  }

  return [...bySourceKey.values()].slice(0, config.collection.maximumDetailsPerSource);
}
