import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type TencentPost = {
  PostId?: string;
  RecruitPostName?: string;
  LocationName?: string;
  Responsibility?: string;
  Requirement?: string;
};

type TencentListResponse = {
  Code?: number;
  Message?: string;
  Data?: { Count?: number; Posts?: TencentPost[] };
};

type TencentDetailResponse = {
  Code?: number;
  Message?: string;
  Data?: TencentPost;
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function assertSuccessful(code: number | undefined, message: string | undefined): void {
  if (code !== 200) throw new Error(`腾讯招聘接口返回异常：${message || "未知错误"}`);
}

export function parseTencentList(response: TencentListResponse): { total: number; posts: TencentPost[] } {
  assertSuccessful(response.Code, response.Message);
  const total = response.Data?.Count;
  const posts = response.Data?.Posts;
  if (total === 0 && (posts === undefined || posts === null)) {
    return { total: 0, posts: [] };
  }
  if (!Number.isFinite(total) || !Array.isArray(posts)) {
    throw new Error("腾讯招聘列表缺少岗位数据");
  }
  return { total: total as number, posts };
}

export function parseTencentDetail(
  response: TencentDetailResponse,
  source: OfficialSiteSource,
): OfficialJobCandidate {
  assertSuccessful(response.Code, response.Message);
  const post = response.Data;
  const postId = clean(post?.PostId);
  if (!post || !postId) throw new Error("腾讯招聘详情缺少岗位 ID");
  const responsibility = clean(post.Responsibility);
  const requirement = clean(post.Requirement);
  const origin = new URL(source.careersUrl).origin;
  const candidate = buildOfficialCandidate(source, {
    title: clean(post.RecruitPostName),
    description: [
      responsibility && `工作职责：${responsibility}`,
      requirement && `任职资格：${requirement}`,
    ].filter(Boolean).join(" "),
    salary: "",
    education: requirement,
    employmentType: source.tencent?.employmentType ?? null,
    city: clean(post.LocationName),
    url: `${origin}/jobdesc.html?postId=${encodeURIComponent(postId)}`,
  });
  if (!candidate) throw new Error("腾讯招聘详情缺少标准化所需字段");
  return candidate;
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectTencentJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.tencent) throw new Error("腾讯来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const listEndpoint = `${origin}/tencentcareer/api/post/Query`;
  const detailEndpoint = `${origin}/tencentcareer/api/post/ByPostId`;
  const discovered = new Map<string, TencentPost>();
  let requestCount = 0;

  async function pause(): Promise<void> {
    if (requestCount > 0) {
      await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
    }
    requestCount += 1;
  }

  for (const city of searchConfig.cities) {
    const cityId = source.tencent.cityIds[city];
    if (!Number.isInteger(cityId)) throw new Error(`腾讯来源缺少城市编码：${city}`);
    for (const keyword of searchConfig.titleIncludeKeywords) {
      for (let pageIndex = 1; pageIndex <= source.tencent.maximumPagesPerKeyword; pageIndex += 1) {
        await pause();
        const query = new URLSearchParams({
          timestamp: String(Date.now()),
          countryId: "",
          cityId: String(cityId),
          bgIds: "",
          productId: "",
          categoryId: "",
          parentCategoryId: "",
          attrId: String(source.tencent.recruitmentTypeId),
          keyword,
          pageIndex: String(pageIndex),
          pageSize: String(source.tencent.pageSize),
          language: "zh-cn",
          area: "cn",
        });
        const response = await fetchOfficialJson<TencentListResponse>(
          `${listEndpoint}?${query.toString()}`,
          [host],
          config.collection,
          { method: "GET", referer: source.careersUrl },
        );
        const parsed = parseTencentList(response);
        for (const post of parsed.posts) {
          const postId = clean(post.PostId);
          if (postId) discovered.set(postId, post);
        }
        if (parsed.posts.length === 0 || pageIndex * source.tencent.pageSize >= parsed.total) break;
      }
    }
  }

  const selected = [...discovered.keys()].slice(0, config.collection.maximumDetailsPerSource);
  const jobs: OfficialJobCandidate[] = [];
  for (const postId of selected) {
    await pause();
    const query = new URLSearchParams({
      timestamp: String(Date.now()),
      postId,
      language: "zh-cn",
    });
    const response = await fetchOfficialJson<TencentDetailResponse>(
      `${detailEndpoint}?${query.toString()}`,
      [host],
      config.collection,
      { method: "GET", referer: `${origin}/jobdesc.html?postId=${encodeURIComponent(postId)}` },
    );
    jobs.push(parseTencentDetail(response, source));
  }
  return jobs;
}
