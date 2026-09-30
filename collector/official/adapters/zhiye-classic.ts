import { load } from "cheerio";
import type { SearchConfig } from "../../../src/types";
import { fetchOfficialHtml } from "../fetch";
import { buildOfficialCandidate } from "../parse";
import type {
  OfficialJobCandidate,
  OfficialSiteSource,
  OfficialSitesConfig,
} from "../types";

interface ClassicListItem {
  title: string;
  city: string;
  url: string;
}

function cleanText(value: string): string {
  return value.replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
}

function normalizeMonthlySalary(value: string): string {
  const normalized = cleanText(value);
  const yuanRange = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*元\s*\/\s*月/u);
  if (!yuanRange) return normalized;
  const minimum = Number(yuanRange[1]) / 1000;
  const maximum = Number(yuanRange[2]) / 1000;
  return `${minimum}-${maximum}K`;
}

export function parseZhiyeClassicList(
  html: string,
  source: OfficialSiteSource,
): { healthy: boolean; jobs: ClassicListItem[]; hasNextPage: boolean } {
  const $ = load(html);
  const table = $(".jobsTable").first();
  if (table.length === 0) return { healthy: false, jobs: [], hasNextPage: false };
  const jobs = table.find("tr").map((_, element) => {
    const row = $(element);
    const link = row.find("a[href*='/zpdetail/']").first();
    const href = link.attr("href");
    if (!href) return null;
    const cells = row.find("td");
    return {
      title: cleanText(link.attr("title") || link.text()),
      city: cleanText(cells.eq(2).attr("title") || cells.eq(2).text()),
      url: new URL(href, source.careersUrl).toString(),
    };
  }).get().filter((job): job is ClassicListItem => job !== null);
  return {
    healthy: true,
    jobs,
    hasNextPage: $(".pager a.next").filter((_, element) => cleanText($(element).text()).includes("下一页")).length > 0,
  };
}

function detailValue($: ReturnType<typeof load>, labelPattern: RegExp): string {
  let value = "";
  $(".xiangqinglist li.ntitle").each((_, element) => {
    const label = cleanText($(element).text());
    if (!labelPattern.test(label)) return;
    value = cleanText($(element).next("li").attr("title") || $(element).next("li").text());
  });
  return value;
}

export function parseZhiyeClassicDetail(
  html: string,
  source: OfficialSiteSource,
  listItem: ClassicListItem,
): OfficialJobCandidate {
  const $ = load(html);
  const container = $(".positiondetail-template6").first();
  if (container.length === 0) throw new Error("智易旧版职位详情结构无效");
  const title = cleanText(container.find(".boxSupertitle span").first().clone().children().remove().end().text())
    || listItem.title;
  const description = cleanText(container.find(".xiangqingtext").text());
  const candidate = buildOfficialCandidate(source, {
    title,
    description,
    salary: normalizeMonthlySalary(detailValue($, /薪资范围/u)),
    education: description,
    employmentType: source.zhiyeClassic?.employmentType ?? null,
    city: detailValue($, /工作地点/u) || listItem.city,
    url: listItem.url,
  });
  if (!candidate) throw new Error("智易旧版职位详情缺少必要字段");
  return candidate;
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function collectZhiyeClassicJobs(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: SearchConfig,
): Promise<OfficialJobCandidate[]> {
  if (!source.zhiyeClassic) throw new Error("智易旧版来源缺少适配器配置");
  const origin = new URL(source.careersUrl).origin;
  const host = new URL(origin).hostname;
  const discovered = new Map<string, ClassicListItem>();
  let requestCount = 0;

  for (const city of searchConfig.cities) {
    const cityCode = source.zhiyeClassic.cityCodes[city];
    if (!cityCode) continue;
    for (const keyword of searchConfig.titleIncludeKeywords) {
      for (let page = 1; page <= source.zhiyeClassic.maximumPagesPerKeyword; page += 1) {
        if (requestCount > 0) {
          await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
        }
        requestCount += 1;
        const url = new URL("/social", origin);
        url.searchParams.set("r", "-1");
        url.searchParams.set("c", cityCode);
        url.searchParams.set("k", keyword);
        if (page > 1) url.searchParams.set("PageIndex", String(page));
        const response = await fetchOfficialHtml(url.toString(), [host], config.collection);
        const parsed = parseZhiyeClassicList(response.html, source);
        if (!parsed.healthy) throw new Error("智易旧版职位列表结构无效");
        for (const job of parsed.jobs) discovered.set(job.url, job);
        if (!parsed.hasNextPage || parsed.jobs.length === 0) break;
      }
    }
  }

  const completed: OfficialJobCandidate[] = [];
  for (const job of [...discovered.values()].slice(0, config.collection.maximumDetailsPerSource)) {
    if (requestCount > 0) {
      await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
    }
    requestCount += 1;
    const detail = await fetchOfficialHtml(job.url, [host], config.collection);
    completed.push(parseZhiyeClassicDetail(detail.html, source, job));
  }
  return completed;
}
