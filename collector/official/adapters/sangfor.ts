import type { SearchConfig } from "../../../src/types";
import { fetchOfficialBearerJson, fetchOfficialJson } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

type JsonObject = Record<string, unknown>;

interface SangforToken {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
}

interface SangforPage {
  code?: number;
  message?: string;
  data?: {
    count?: number;
    listData?: unknown[];
  };
}

function text(value: unknown): string {
  if (typeof value === "string") return value.replace(/\s+/g, " ").trim();
  if (typeof value === "number") return String(value);
  return "";
}

function salary(minimumValue: unknown, maximumValue: unknown): string {
  const minimum = Number(minimumValue);
  const maximum = Number(maximumValue);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum <= 0) {
    return "";
  }
  return `${minimum}-${maximum}K`;
}

export function parseSangforPage(
  page: SangforPage,
  source: OfficialSiteSource,
): { total: number; jobs: OfficialJobCandidate[] } {
  if (page.code !== 0 || !page.data || !Array.isArray(page.data.listData)
    || !Number.isFinite(page.data.count)) {
    throw new Error(`深信服招聘接口返回异常：${page.message || "未知错误"}`);
  }
  const origin = new URL(source.careersUrl).origin;
  const jobs = page.data.listData.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as JsonObject;
    const id = text(row.positionId);
    if (!id) return [];
    const description = text(row.description);
    const commitment = text(row.commitment);
    const candidate = buildOfficialCandidate(source, {
      title: text(row.title),
      description,
      salary: salary(row.minSalary, row.maxSalary),
      education: [text(row.education), description].filter(Boolean).join(" "),
      employmentType: /全职|正式/u.test(commitment) ? "full-time"
        : /兼职/u.test(commitment) ? "part-time" : null,
      city: text(row.workPlaceText) || text(row.locationText),
      url: `${origin}/index/Delivery/${encodeURIComponent(id)}`,
    });
    return candidate ? [candidate] : [];
  });
  return { total: page.data.count as number, jobs };
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectSangforJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const apiOrigin = `${origin}/webapi`;
  const referer = `${origin}/index/Sociology`;
  const tokenResponse = await fetchOfficialJson<SangforToken>(
    `${apiOrigin}/api/connect/token`,
    [host],
    config.collection,
    { referer },
  );
  if (!tokenResponse.access_token || tokenResponse.token_type !== "Bearer") {
    throw new Error("深信服官网没有返回有效的匿名短期访问令牌");
  }

  const pageSize = source.sangfor?.pageSize ?? 100;
  const maximumPages = source.sangfor?.maximumPagesPerKeyword ?? 3;
  const channelId = source.sangfor?.channelId ?? 110;
  const bySourceKey = new Map<string, OfficialJobCandidate>();
  let requestCount = 0;

  for (const keyword of searchConfig.titleIncludeKeywords) {
    for (let pageNumber = 1; pageNumber <= maximumPages; pageNumber += 1) {
      if (requestCount > 0) {
        await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
      }
      requestCount += 1;
      const response = await fetchOfficialBearerJson<SangforPage>(
        `${apiOrigin}/api/Jobs`,
        [host],
        config.collection,
        {
          referer,
          bearer: tokenResponse.access_token,
          body: {
            channelId,
            page: pageNumber,
            pageSize,
            departmentId: 0,
            functionId: 0,
            kw: keyword,
            locationId: 0,
            workPlaceId: 0,
          },
        },
      );
      const parsed = parseSangforPage(response, source);
      for (const job of parsed.jobs) bySourceKey.set(job.sourceKey, job);
      if (parsed.jobs.length === 0 || pageNumber * pageSize >= parsed.total) break;
    }
  }

  return [...bySourceKey.values()];
}
