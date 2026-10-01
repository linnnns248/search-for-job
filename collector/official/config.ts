import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../config";
import type { OfficialSiteSource, OfficialSitesConfig } from "./types";

export const officialSitesPath = path.join(projectRoot, "config", "official-sites.json");
const adapterTypes = new Set(["json-ld", "selector", "cloudview", "moka", "zhiye", "zhiye-classic", "tencent", "meituan", "baidu", "huawei", "custom", "pending"]);
const checkStatuses = new Set(["reachable", "needs-browser", "unavailable", "pending"]);

function assertPublicHttpsUrl(value: string, label: string): void {
  const url = new URL(value);
  const hostname = url.hostname.toLocaleLowerCase();
  if (url.protocol !== "https:") throw new Error(`${label} 必须使用 HTTPS`);
  if (url.username || url.password) throw new Error(`${label} 不能包含账号信息`);
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error(`${label} 不能指向本机地址`);
  }
  if (/^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)) {
    throw new Error(`${label} 不能指向私有网络地址`);
  }
}

function validateSource(source: OfficialSiteSource, ids: Set<string>): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(source.id)) throw new Error(`官网来源 ID 无效：${source.id}`);
  if (ids.has(source.id)) throw new Error(`官网来源 ID 重复：${source.id}`);
  ids.add(source.id);
  if (!source.company.trim()) throw new Error(`官网来源 ${source.id} 缺少公司名称`);
  if (!Array.isArray(source.focusAreas)) throw new Error(`官网来源 ${source.id} 的关注方向无效`);
  if (!adapterTypes.has(source.adapter)) throw new Error(`官网来源 ${source.id} 的适配器类型无效`);
  if (!checkStatuses.has(source.checkStatus)) throw new Error(`官网来源 ${source.id} 的检查状态无效`);
  assertPublicHttpsUrl(source.careersUrl, `官网来源 ${source.id} 的招聘链接`);
  if (source.companySizeEvidenceUrl) {
    assertPublicHttpsUrl(source.companySizeEvidenceUrl, `官网来源 ${source.id} 的规模依据链接`);
  }
  if (source.companySizeMin !== null && (!Number.isInteger(source.companySizeMin) || source.companySizeMin < 0)) {
    throw new Error(`官网来源 ${source.id} 的公司规模下限无效`);
  }
  if (source.enabled) {
    if (source.adapter === "pending") throw new Error(`已启用官网来源 ${source.id} 尚未配置适配器`);
    if (!source.companySize || source.companySizeMin === null) {
      throw new Error(`已启用官网来源 ${source.id} 尚未确认公司规模`);
    }
    if (source.adapter === "selector" && !source.selectors) {
      throw new Error(`已启用官网来源 ${source.id} 缺少页面选择器`);
    }
    if (source.adapter === "zhiye") {
      if (!source.zhiye) throw new Error(`已启用官网来源 ${source.id} 缺少智易适配器配置`);
      if (!["1", "2"].includes(source.zhiye.category)) {
        throw new Error(`官网来源 ${source.id} 的智易招聘类型无效`);
      }
      if (!Number.isInteger(source.zhiye.pageSize) || source.zhiye.pageSize < 1 || source.zhiye.pageSize > 100) {
        throw new Error(`官网来源 ${source.id} 的智易分页大小必须在 1 到 100 之间`);
      }
      if (!Number.isInteger(source.zhiye.maximumPagesPerKeyword)
        || source.zhiye.maximumPagesPerKeyword < 1
        || source.zhiye.maximumPagesPerKeyword > 50) {
        throw new Error(`官网来源 ${source.id} 的智易关键词页数必须在 1 到 50 之间`);
      }
    }
    if (source.adapter === "zhiye-classic") {
      if (!source.zhiyeClassic) throw new Error(`已启用官网来源 ${source.id} 缺少智易旧版适配器配置`);
      if (!Object.keys(source.zhiyeClassic.cityCodes).length
        || Object.values(source.zhiyeClassic.cityCodes).some((value) => !value.trim())) {
        throw new Error(`官网来源 ${source.id} 的智易旧版城市编码无效`);
      }
      if (!['full-time', 'part-time'].includes(source.zhiyeClassic.employmentType)) {
        throw new Error(`官网来源 ${source.id} 的智易旧版求职类型无效`);
      }
      if (!Number.isInteger(source.zhiyeClassic.maximumPagesPerKeyword)
        || source.zhiyeClassic.maximumPagesPerKeyword < 1
        || source.zhiyeClassic.maximumPagesPerKeyword > 50) {
        throw new Error(`官网来源 ${source.id} 的智易旧版关键词页数必须在 1 到 50 之间`);
      }
    }
    if (source.adapter === "tencent") {
      if (!source.tencent) throw new Error(`已启用官网来源 ${source.id} 缺少腾讯适配器配置`);
      if (!Object.keys(source.tencent.cityIds).length
        || Object.values(source.tencent.cityIds).some((value) => !Number.isInteger(value))) {
        throw new Error(`官网来源 ${source.id} 的腾讯城市编码无效`);
      }
      if (!Number.isInteger(source.tencent.recruitmentTypeId)) {
        throw new Error(`官网来源 ${source.id} 的腾讯招聘类型无效`);
      }
      if (!["full-time", "part-time"].includes(source.tencent.employmentType)) {
        throw new Error(`官网来源 ${source.id} 的腾讯求职类型无效`);
      }
      if (!Number.isInteger(source.tencent.pageSize)
        || source.tencent.pageSize < 1 || source.tencent.pageSize > 100) {
        throw new Error(`官网来源 ${source.id} 的腾讯分页大小必须在 1 到 100 之间`);
      }
      if (!Number.isInteger(source.tencent.maximumPagesPerKeyword)
        || source.tencent.maximumPagesPerKeyword < 1
        || source.tencent.maximumPagesPerKeyword > 50) {
        throw new Error(`官网来源 ${source.id} 的腾讯关键词页数必须在 1 到 50 之间`);
      }
    }
    if (source.adapter === "meituan") {
      if (!source.meituan) throw new Error(`已启用官网来源 ${source.id} 缺少美团适配器配置`);
      if (!Object.keys(source.meituan.cityCodes).length
        || Object.values(source.meituan.cityCodes).some((value) => !value.trim())) {
        throw new Error(`官网来源 ${source.id} 的美团城市编码无效`);
      }
      if (!source.meituan.jobTypeCode.trim()) {
        throw new Error(`官网来源 ${source.id} 的美团招聘类型无效`);
      }
      if (!["full-time", "part-time"].includes(source.meituan.employmentType)) {
        throw new Error(`官网来源 ${source.id} 的美团求职类型无效`);
      }
      if (!Number.isInteger(source.meituan.pageSize)
        || source.meituan.pageSize < 1 || source.meituan.pageSize > 100) {
        throw new Error(`官网来源 ${source.id} 的美团分页大小必须在 1 到 100 之间`);
      }
      if (!Number.isInteger(source.meituan.maximumPagesPerKeyword)
        || source.meituan.maximumPagesPerKeyword < 1
        || source.meituan.maximumPagesPerKeyword > 50) {
        throw new Error(`官网来源 ${source.id} 的美团关键词页数必须在 1 到 50 之间`);
      }
    }
    if (source.adapter === "baidu") {
      if (!source.baidu) throw new Error(`已启用官网来源 ${source.id} 缺少百度适配器配置`);
      if (!Object.keys(source.baidu.cityCodes).length
        || Object.values(source.baidu.cityCodes).some((value) => !value.trim())) {
        throw new Error(`官网来源 ${source.id} 的百度城市编码无效`);
      }
      if (!source.baidu.postTypeCode.trim() || source.baidu.recruitType !== "SOCIAL") {
        throw new Error(`官网来源 ${source.id} 的百度招聘类型无效`);
      }
      if (!["full-time", "part-time"].includes(source.baidu.employmentType)) {
        throw new Error(`官网来源 ${source.id} 的百度求职类型无效`);
      }
      if (!Number.isInteger(source.baidu.pageSize)
        || source.baidu.pageSize < 1 || source.baidu.pageSize > 10) {
        throw new Error(`官网来源 ${source.id} 的百度分页大小必须在 1 到 10 之间`);
      }
      if (!Number.isInteger(source.baidu.maximumPagesPerKeyword)
        || source.baidu.maximumPagesPerKeyword < 1
        || source.baidu.maximumPagesPerKeyword > 50) {
        throw new Error(`官网来源 ${source.id} 的百度关键词页数必须在 1 到 50 之间`);
      }
    }
    if (source.adapter === "huawei") {
      if (!source.huawei) throw new Error(`已启用官网来源 ${source.id} 缺少华为适配器配置`);
      if (!["full-time", "part-time"].includes(source.huawei.employmentType)) {
        throw new Error(`官网来源 ${source.id} 的华为求职类型无效`);
      }
      if (!Number.isInteger(source.huawei.pageSize)
        || source.huawei.pageSize < 1 || source.huawei.pageSize > 20) {
        throw new Error(`官网来源 ${source.id} 的华为分页大小必须在 1 到 20 之间`);
      }
      if (!Number.isInteger(source.huawei.maximumPagesPerKeyword)
        || source.huawei.maximumPagesPerKeyword < 1
        || source.huawei.maximumPagesPerKeyword > 50) {
        throw new Error(`官网来源 ${source.id} 的华为关键词页数必须在 1 到 50 之间`);
      }
    }
  }
}

export function validateOfficialSitesConfig(value: unknown): OfficialSitesConfig {
  if (!value || typeof value !== "object") throw new Error("官网来源配置格式无效");
  const config = value as Partial<OfficialSitesConfig>;
  if (config.schemaVersion !== 1 || !config.collection || !config.publicationPolicy || !Array.isArray(config.sources)) {
    throw new Error("官网来源配置必须使用 schemaVersion 1，并包含 collection、publicationPolicy 和 sources 数组");
  }
  const collection = config.collection;
  if (!Number.isInteger(collection.requestTimeoutMs) || collection.requestTimeoutMs < 1000) {
    throw new Error("官网请求超时不能小于 1000 毫秒");
  }
  if (!Number.isInteger(collection.maximumResponseBytes) || collection.maximumResponseBytes < 1024) {
    throw new Error("官网响应大小上限不能小于 1024 字节");
  }
  if (!Number.isInteger(collection.minimumDelayMs) || collection.minimumDelayMs < 1000) {
    throw new Error("官网最短访问间隔不能小于 1000 毫秒");
  }
  if (!Number.isInteger(collection.maximumDelayMs) || collection.maximumDelayMs < collection.minimumDelayMs) {
    throw new Error("官网最长访问间隔不能小于最短访问间隔");
  }
  if (!Number.isInteger(collection.maximumDetailsPerSource) || collection.maximumDetailsPerSource < 1) {
    throw new Error("官网单站点详情上限至少为 1");
  }
  const requiredPolicyKeys = [
    "allowUndisclosedSalary",
    "allowUndisclosedEducation",
    "allowUndisclosedEmploymentType",
  ] as const;
  for (const key of requiredPolicyKeys) {
    const policyValue = config.publicationPolicy[key];
    if (typeof policyValue !== "boolean") throw new Error(`官网缺失字段策略 ${key} 必须是布尔值`);
  }
  const ids = new Set<string>();
  for (const source of config.sources) validateSource(source, ids);
  if (config.onboardingPolicy) {
    const deferredIds = config.onboardingPolicy.deferredSourceIds;
    if (!Array.isArray(deferredIds) || new Set(deferredIds).size !== deferredIds.length) {
      throw new Error("官网延后接入来源必须是不重复的数组");
    }
    for (const id of deferredIds) {
      if (!ids.has(id)) throw new Error(`官网延后接入来源不存在：${id}`);
      const source = config.sources.find((candidate) => candidate.id === id);
      if (source?.enabled) throw new Error(`官网延后接入来源不能同时启用：${id}`);
    }
    if (typeof config.onboardingPolicy.deferredReason !== "string"
      || !config.onboardingPolicy.deferredReason.trim()) {
      throw new Error("官网延后接入策略缺少原因");
    }
    if (config.onboardingPolicy.processingStrategy
      && config.onboardingPolicy.processingStrategy !== "company-size-descending") {
      throw new Error("官网接入处理顺序无效");
    }
    if (config.onboardingPolicy.processingStrategy
      && (typeof config.onboardingPolicy.processingReason !== "string"
        || !config.onboardingPolicy.processingReason.trim())) {
      throw new Error("官网接入处理顺序缺少原因");
    }
  }
  return config as OfficialSitesConfig;
}

export async function loadOfficialSitesConfig(): Promise<OfficialSitesConfig> {
  return validateOfficialSitesConfig(JSON.parse(await readFile(officialSitesPath, "utf8")));
}
