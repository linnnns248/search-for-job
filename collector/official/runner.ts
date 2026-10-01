import { readFile, rename, writeFile } from "node:fs/promises";
import type { JobDataset, JobRecord } from "../../src/types";
import { loadSearchConfig, publicJobsPath } from "../config";
import {
  assertCloudViewDetailsAreDistinct,
  parseCloudViewDetail,
  parseCloudViewList,
} from "./adapters/cloudview";
import { collectZhiyeJobs } from "./adapters/zhiye";
import { collectZhiyeClassicJobs } from "./adapters/zhiye-classic";
import { collectTencentJobs } from "./adapters/tencent";
import { collectMeituanJobs } from "./adapters/meituan";
import { collectBaiduJobs } from "./adapters/baidu";
import { collectHuaweiJobs } from "./adapters/huawei";
import { collectDidiJobs } from "./adapters/didi";
import { loadOfficialSitesConfig } from "./config";
import { matchesOfficialCriteria } from "./criteria";
import { fetchOfficialHtml } from "./fetch";
import { mergeOfficialJobs } from "./merge";
import { normalizeOfficialJob } from "./normalize";
import { parseOfficialList } from "./parse";
import type { OfficialJobCandidate, OfficialSiteSource, OfficialSitesConfig } from "./types";

export interface OfficialSourceResult {
  sourceId: string;
  company: string;
  state: "success" | "failed";
  discovered: number;
  accepted: number;
  error?: string;
}

export interface OfficialCollectionResult {
  generatedAt: string;
  enabledSources: number;
  successfulSources: number;
  accepted: number;
  total: number;
  sources: OfficialSourceResult[];
}

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function collectSource(
  source: OfficialSiteSource,
  config: OfficialSitesConfig,
  searchConfig: Awaited<ReturnType<typeof loadSearchConfig>>,
): Promise<OfficialJobCandidate[]> {
  if (source.adapter === "tencent") {
    const jobs = await collectTencentJobs(source, config, searchConfig);
    if (jobs.length === 0) throw new Error("腾讯招聘官网没有识别到岗位，原数据保持不变");
    return jobs;
  }
  if (source.adapter === "meituan") {
    const jobs = await collectMeituanJobs(source, config, searchConfig);
    if (jobs.length === 0) throw new Error("美团招聘官网没有识别到岗位，原数据保持不变");
    return jobs;
  }
  if (source.adapter === "baidu") {
    const jobs = await collectBaiduJobs(source, config, searchConfig);
    if (jobs.length === 0) throw new Error("百度招聘官网没有识别到岗位，原数据保持不变");
    return jobs;
  }
  if (source.adapter === "huawei") {
    return collectHuaweiJobs(source, config, searchConfig);
  }
  if (source.adapter === "didi") {
    return collectDidiJobs(source, config, searchConfig);
  }
  if (source.adapter === "zhiye") {
    const jobs = await collectZhiyeJobs(source, config, searchConfig);
    if (jobs.length === 0) throw new Error("智易招聘官网没有识别到岗位，原数据保持不变");
    return jobs;
  }
  if (source.adapter === "zhiye-classic") {
    return collectZhiyeClassicJobs(source, config, searchConfig);
  }
  const host = new URL(source.careersUrl).hostname;
  const listPage = await fetchOfficialHtml(source.careersUrl, [host], config.collection);
  if (source.adapter !== "cloudview") {
    const jobs = parseOfficialList(listPage.html, source);
    if (jobs.length === 0) throw new Error("官网列表没有识别到岗位，原数据保持不变");
    return jobs;
  }

  const discovered = parseCloudViewList(listPage.html, source)
    .slice(0, config.collection.maximumDetailsPerSource);
  if (discovered.length === 0) throw new Error("云览科技官网没有识别到岗位，原数据保持不变");
  const completed: OfficialJobCandidate[] = [];
  for (const [index, candidate] of discovered.entries()) {
    if (index > 0) {
      await wait(randomDuration(config.collection.minimumDelayMs, config.collection.maximumDelayMs));
    }
    const detail = await fetchOfficialHtml(candidate.url, [host], config.collection);
    completed.push(parseCloudViewDetail(detail.html, candidate));
  }
  assertCloudViewDetailsAreDistinct(completed);
  return completed;
}

export async function collectOfficialSources(): Promise<OfficialCollectionResult> {
  const [officialConfig, searchConfig, existing] = await Promise.all([
    loadOfficialSitesConfig(),
    loadSearchConfig(),
    readFile(publicJobsPath, "utf8").then((value) => JSON.parse(value) as JobDataset),
  ]);
  const enabledSources = officialConfig.sources.filter((source) => source.enabled);
  const sourceResults: OfficialSourceResult[] = [];
  const collectedJobs: JobRecord[] = [];
  const generatedAt = new Date().toISOString();

  for (const source of enabledSources) {
    try {
      const discovered = await collectSource(source, officialConfig, searchConfig);
      const accepted = discovered.filter((job) =>
        matchesOfficialCriteria(job, searchConfig, officialConfig.publicationPolicy),
      );
      collectedJobs.push(...accepted.map((job) => normalizeOfficialJob(job, generatedAt)));
      sourceResults.push({
        sourceId: source.id,
        company: source.company,
        state: "success",
        discovered: discovered.length,
        accepted: accepted.length,
      });
    } catch (error) {
      sourceResults.push({
        sourceId: source.id,
        company: source.company,
        state: "failed",
        discovered: 0,
        accepted: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const successfulSources = sourceResults.filter((result) => result.state === "success").length;
  if (enabledSources.length > 0 && successfulSources === 0) {
    throw new Error(`所有已启用官网均采集失败：${sourceResults.map((result) => result.error).join("；")}`);
  }

  let dataset = existing;
  if (collectedJobs.length > 0) {
    dataset = mergeOfficialJobs(existing, collectedJobs, generatedAt);
    const temporaryPath = `${publicJobsPath}.official.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
    await rename(temporaryPath, publicJobsPath);
  }

  return {
    generatedAt,
    enabledSources: enabledSources.length,
    successfulSources,
    accepted: collectedJobs.length,
    total: dataset.jobs.length,
    sources: sourceResults,
  };
}
