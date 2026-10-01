import type { SearchConfig } from "../../../src/types";
import { fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

interface Camera360ListRow {
  id?: string;
  job?: string;
  place?: string;
}

interface Camera360ListResponse {
  status?: number;
  message?: string;
  data?: { data?: Camera360ListRow[] };
}

interface Camera360DetailResponse {
  status?: number;
  message?: string;
  data?: {
    id?: string;
    job?: string;
    overview?: string;
    description?: string[];
    require?: string[];
  };
}

function compact(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim();
}

function compactList(value: unknown): string {
  return Array.isArray(value) ? value.map(compact).filter(Boolean).join(" ") : "";
}

function matchesKeyword(title: string, keywords: string[]): boolean {
  const normalized = title.toLocaleLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase()));
}

export function parseCamera360Detail(
  response: Camera360DetailResponse,
  source: OfficialSiteSource,
  city: string,
): OfficialJobCandidate {
  if (response.status !== 200 || !response.data?.id || !response.data.job) {
    throw new Error(`Camera360 招聘接口返回异常：${response.message || "未知错误"}`);
  }
  const responsibilities = compactList(response.data.description);
  const requirements = compactList(response.data.require);
  const candidate = buildOfficialCandidate(source, {
    title: compact(response.data.job),
    description: [
      responsibilities && `岗位职责：${responsibilities}`,
      requirements && `任职要求：${requirements}`,
    ].filter(Boolean).join(" "),
    salary: "",
    education: requirements,
    employmentType: "full-time",
    city,
    url: new URL(
      `positionDetail.html?id=${encodeURIComponent(response.data.id)}&channel=social`,
      source.careersUrl,
    ).toString(),
  });
  if (!candidate) throw new Error("Camera360 岗位详情缺少必要字段");
  return candidate;
}

export async function collectCamera360Jobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const listUrl = new URL("/hr/hr/moreinfo", origin);
  listUrl.search = new URLSearchParams({
    channel: "social",
    page: "1",
    pageSize: "100",
    place: "",
    type: "",
  }).toString();
  const list = await fetchOfficialJson<Camera360ListResponse>(
    listUrl.toString(), [host], config.collection, { referer: source.careersUrl },
  );
  if (list.status !== 200 || !Array.isArray(list.data?.data)) {
    throw new Error(`Camera360 招聘接口返回异常：${list.message || "未知错误"}`);
  }

  const relevant = list.data.data.filter((row) =>
    row.id && row.job && matchesKeyword(row.job, searchConfig.titleIncludeKeywords),
  ).slice(0, config.collection.maximumDetailsPerSource);
  const jobs: OfficialJobCandidate[] = [];
  for (const row of relevant) {
    const detailUrl = new URL("/hr/hr/jobdetail", origin);
    detailUrl.search = new URLSearchParams({
      channel: "social",
      id: row.id as string,
    }).toString();
    const detail = await fetchOfficialJson<Camera360DetailResponse>(
      detailUrl.toString(), [host], config.collection, { referer: source.careersUrl },
    );
    jobs.push(parseCamera360Detail(detail, source, compact(row.place)));
  }
  return jobs;
}
