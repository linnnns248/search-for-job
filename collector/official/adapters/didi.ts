import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type DidiJob = {
  jdId?: string | number;
  jobName?: string;
  workArea?: string;
  jobDuty?: string;
  jobQualification?: string;
};

type DidiListResponse = {
  meta?: {
    code?: string | number;
    message?: string;
  };
  data?: {
    total?: string | number;
    items?: DidiJob[];
  };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseDidiPage(
  response: DidiListResponse,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  if (Number(response.meta?.code) !== 0) {
    throw new Error(`滴滴招聘接口返回异常：${response.meta?.message || "未知错误"}`);
  }
  const total = Number(response.data?.total);
  const rows = response.data?.items;
  if (!Number.isFinite(total) || !Array.isArray(rows)) {
    throw new Error("滴滴招聘列表缺少岗位数据");
  }
  const origin = new URL(source.careersUrl).origin;
  const jobs = rows.flatMap((row) => {
    const jdId = String(row.jdId ?? "").trim();
    if (!jdId) return [];
    const duty = clean(row.jobDuty);
    const requirement = clean(row.jobQualification);
    const candidate = buildOfficialCandidate(source, {
      title: clean(row.jobName),
      description: [duty && `工作职责：${duty}`, requirement && `任职资格：${requirement}`]
        .filter(Boolean).join(" "),
      salary: "",
      education: requirement,
      employmentType: source.didi?.employmentType ?? null,
      city: clean(row.workArea),
      url: `${origin}/social/jobDetail?jdId=${encodeURIComponent(jdId)}`,
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

export async function collectDidiJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.didi) throw new Error("滴滴来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const endpoint = `${origin}/recruit-portal-service/api/job/front/list`;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const city of searchConfig.cities) {
    const cityName = source.didi.cityNames[city];
    if (!cityName) throw new Error(`滴滴来源缺少城市名称：${city}`);
    for (let pageNo = 1; pageNo <= source.didi.maximumPagesPerCity; pageNo += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const url = new URL(endpoint);
      url.search = new URLSearchParams({
        page: String(pageNo),
        size: String(source.didi.pageSize),
        workAreaList: cityName,
      }).toString();
      const response = await fetchOfficialJson<DidiListResponse>(
        url.toString(),
        [host],
        config.collection,
        { referer: source.careersUrl },
      );
      const parsed = parseDidiPage(response, source);
      for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
      if (parsed.jobs.length === 0 || pageNo * source.didi.pageSize >= parsed.total) break;
    }
  }

  return [...bySourceKey.values()].slice(0, config.collection.maximumDetailsPerSource);
}
