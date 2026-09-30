import type { SearchConfig } from "../../../src/types";
import { fetchOfficialFormJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type BaiduJob = {
  postId?: string;
  name?: string;
  postType?: string;
  workContent?: string;
  serviceCondition?: string;
  workPlace?: string;
};

type BaiduListResponse = {
  status?: string;
  message?: string;
  data?: {
    total?: string | number;
    list?: BaiduJob[];
  };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function parseBaiduPage(
  response: BaiduListResponse,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  if (response.status !== "ok") {
    throw new Error(`百度招聘接口返回异常：${response.message || "未知错误"}`);
  }
  const total = Number(response.data?.total);
  const rows = response.data?.list;
  if (total === 0 && (rows === undefined || rows === null)) return { total: 0, jobs: [] };
  if (!Number.isFinite(total) || !Array.isArray(rows)) {
    throw new Error("百度招聘列表缺少岗位数据");
  }
  const origin = new URL(source.careersUrl).origin;
  const recruitType = source.baidu?.recruitType ?? "SOCIAL";
  const jobs = rows.flatMap((row) => {
    const postId = clean(row.postId);
    if (!postId) return [];
    const duty = clean(row.workContent);
    const requirement = clean(row.serviceCondition);
    const candidate = buildOfficialCandidate(source, {
      title: clean(row.name),
      description: [duty && `工作职责：${duty}`, requirement && `任职资格：${requirement}`]
        .filter(Boolean).join(" "),
      salary: "",
      education: requirement,
      employmentType: source.baidu?.employmentType ?? null,
      city: clean(row.workPlace),
      url: `${origin}/jobs/detail/${recruitType}/${encodeURIComponent(postId)}`,
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

export async function collectBaiduJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.baidu) throw new Error("百度来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const endpoint = `${origin}/httservice/getPostListNew`;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const city of searchConfig.cities) {
    const cityCode = source.baidu.cityCodes[city];
    if (!cityCode) throw new Error(`百度来源缺少城市编码：${city}`);
    for (const keyword of searchConfig.titleIncludeKeywords) {
      for (let pageNo = 1; pageNo <= source.baidu.maximumPagesPerKeyword; pageNo += 1) {
        if (requestCount > 0) {
          await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
        }
        requestCount += 1;
        const form = new URLSearchParams({
          recruitType: source.baidu.recruitType,
          pageSize: String(source.baidu.pageSize),
          keyWord: keyword,
          curPage: String(pageNo),
          projectType: "",
        });
        form.append("workPlace[0]", cityCode);
        form.append("postType[0]", source.baidu.postTypeCode);
        const response = await fetchOfficialFormJson<BaiduListResponse>(
          endpoint,
          [host],
          config.collection,
          { form, referer: source.careersUrl },
        );
        const parsed = parseBaiduPage(response, source);
        for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
        if (parsed.jobs.length === 0 || pageNo * source.baidu.pageSize >= parsed.total) break;
      }
    }
  }

  return [...bySourceKey.values()].slice(0, config.collection.maximumDetailsPerSource);
}
