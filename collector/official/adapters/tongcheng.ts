import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type TongchengListJob = {
  jobId?: string;
  jobName?: string;
  employmentType?: string;
  employmentTypeName?: string;
  salaryRange?: string;
  workPlace?: string;
  recruitType?: number;
};

type TongchengListResponse = {
  code?: number;
  message?: string | null;
  data?: {
    content?: TongchengListJob[];
    totalSize?: number;
    totalPages?: number;
  };
};

type TongchengDetail = {
  id?: string;
  jobName?: string;
  addressName?: string;
  recruitmentTypeName?: string;
  qualifications?: string;
  duty?: string;
  salary?: string;
  jobStatus?: number;
};

type TongchengDetailResponse = {
  code?: number;
  message?: string | null;
  data?: TongchengDetail;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isTargetTitle(title: string, keywords: string[]): boolean {
  const normalized = title.toLocaleLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase()));
}

function normalizeSalary(value: unknown): string {
  const raw = clean(value).replace(/[～~—–至]/g, "-").replace(/\s+/g, "");
  const match = raw.match(/(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)/);
  if (!match) return raw;
  let minimum = Number(match[1]);
  let maximum = Number(match[2]);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum)) return raw;
  if (minimum >= 1000 && maximum >= 1000) {
    minimum /= 1000;
    maximum /= 1000;
  }
  return `${minimum}-${maximum}K`;
}

export function parseTongchengList(
  response: TongchengListResponse,
): { total: number; pages: number; jobs: TongchengListJob[] } {
  if (response.code !== 0) {
    throw new Error(`同程旅行招聘接口返回异常：${response.message || "未知错误"}`);
  }
  const total = Number(response.data?.totalSize);
  const pages = Number(response.data?.totalPages);
  const jobs = response.data?.content;
  if (!Number.isFinite(total) || !Number.isFinite(pages) || !Array.isArray(jobs)) {
    throw new Error("同程旅行招聘列表缺少岗位数据");
  }
  return { total, pages, jobs };
}

export function parseTongchengDetail(
  response: TongchengDetailResponse,
  listJob: TongchengListJob,
  source: OfficialSiteSource,
): OfficialJobCandidate | null {
  if (response.code !== 0 || !response.data) {
    throw new Error(`同程旅行岗位详情返回异常：${response.message || "未知错误"}`);
  }
  const detail = response.data;
  const jobId = clean(detail.id) || clean(listJob.jobId);
  if (!jobId) throw new Error("同程旅行岗位详情缺少岗位 ID");
  if (detail.jobStatus !== undefined && detail.jobStatus !== 1) return null;
  const duty = clean(detail.duty);
  const qualifications = clean(detail.qualifications);
  const isRegular = listJob.employmentType === source.tongcheng?.regularEmploymentTypeCode;
  const origin = new URL(source.careersUrl).origin;
  return buildOfficialCandidate(source, {
    title: clean(detail.jobName) || clean(listJob.jobName),
    description: [duty && `工作职责：${duty}`, qualifications && `任职资格：${qualifications}`]
      .filter(Boolean).join(" "),
    salary: normalizeSalary(detail.salary || listJob.salaryRange),
    education: qualifications,
    employmentType: isRegular ? source.tongcheng?.employmentType ?? null : null,
    city: clean(detail.addressName) || clean(listJob.workPlace),
    url: `${origin}/recruit/portal/#/socialDetail?id=${encodeURIComponent(jobId)}&type=${source.tongcheng?.queryType ?? 4}`,
  });
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectTongchengJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.tongcheng) throw new Error("同程旅行来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const listEndpoint = `${origin}/recruit-api/external/portal/job-list`;
  const detailEndpoint = `${origin}/recruit-api/external/portal/job-detail`;
  const headers = { companyId: source.tongcheng.companyId };
  const discovered = new Map<string, TongchengListJob>();
  let requestCount = 0;

  for (const city of searchConfig.cities) {
    const cityId = source.tongcheng.cityIds[city];
    if (!cityId) throw new Error(`同程旅行来源缺少城市编码：${city}`);
    for (let pageNo = 1; pageNo <= source.tongcheng.maximumPagesPerCity; pageNo += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const response = await fetchOfficialJson<TongchengListResponse>(
        listEndpoint,
        [host],
        config.collection,
        {
          body: {
            queryType: source.tongcheng.queryType,
            jobName: "",
            jobCategory: [],
            workLocation: [cityId],
            education: null,
            experience: null,
            schoolRecruitUnit: null,
            salaryRange: null,
            releaseTime: null,
            pageNo,
            pageSize: source.tongcheng.pageSize,
          },
          referer: source.careersUrl,
          publicHeaders: headers,
        },
      );
      const parsed = parseTongchengList(response);
      for (const job of parsed.jobs) {
        const jobId = clean(job.jobId);
        if (jobId && isTargetTitle(clean(job.jobName), searchConfig.titleIncludeKeywords)) {
          discovered.set(jobId, job);
        }
      }
      if (parsed.jobs.length === 0 || pageNo >= parsed.pages
        || pageNo * source.tongcheng.pageSize >= parsed.total) break;
    }
  }

  const completed: OfficialJobCandidate[] = [];
  const jobs = [...discovered.values()].slice(0, config.collection.maximumDetailsPerSource);
  for (const [index, job] of jobs.entries()) {
    if (index > 0 || requestCount > 0) {
      await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
    }
    const response = await fetchOfficialJson<TongchengDetailResponse>(
      detailEndpoint,
      [host],
      config.collection,
      {
        body: {
          jobId: job.jobId,
          queryType: source.tongcheng.queryType,
          userId: "",
        },
        referer: source.careersUrl,
        publicHeaders: headers,
      },
    );
    const candidate = parseTongchengDetail(response, job, source);
    if (candidate) completed.push(candidate);
  }
  return completed;
}
