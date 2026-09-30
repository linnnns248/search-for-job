import { readFile } from "node:fs/promises";

const configPath = new URL("../config/official-sites.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

if (config.schemaVersion !== 1 || !config.collection || !config.publicationPolicy || !Array.isArray(config.sources)) {
  throw new Error("官网来源配置必须使用 schemaVersion 1，并包含 collection、publicationPolicy 和 sources 数组");
}

for (const [key, value] of Object.entries(config.publicationPolicy)) {
  if (typeof value !== "boolean") throw new Error(`官网缺失字段策略 ${key} 必须是布尔值`);
}

const ids = new Set();
const adapters = {};
for (const source of config.sources) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(source.id)) throw new Error(`官网来源 ID 无效：${source.id}`);
  if (ids.has(source.id)) throw new Error(`官网来源 ID 重复：${source.id}`);
  ids.add(source.id);
  const url = new URL(source.careersUrl);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`官网来源 ${source.id} 的招聘链接必须是无账号信息的 HTTPS 地址`);
  }
  if (source.enabled && (source.adapter === "pending" || source.companySizeMin === null)) {
    throw new Error(`官网来源 ${source.id} 尚未完成启用前验证`);
  }
  if (source.enabled && source.adapter === "zhiye") {
    if (!source.zhiye) throw new Error(`官网来源 ${source.id} 缺少智易适配器配置`);
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
  if (source.enabled && source.adapter === "zhiye-classic") {
    if (!source.zhiyeClassic) throw new Error(`官网来源 ${source.id} 缺少智易旧版适配器配置`);
    if (!Object.keys(source.zhiyeClassic.cityCodes ?? {}).length
      || Object.values(source.zhiyeClassic.cityCodes).some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error(`官网来源 ${source.id} 的智易旧版城市编码无效`);
    }
    if (!["full-time", "part-time"].includes(source.zhiyeClassic.employmentType)) {
      throw new Error(`官网来源 ${source.id} 的智易旧版求职类型无效`);
    }
    if (!Number.isInteger(source.zhiyeClassic.maximumPagesPerKeyword)
      || source.zhiyeClassic.maximumPagesPerKeyword < 1
      || source.zhiyeClassic.maximumPagesPerKeyword > 50) {
      throw new Error(`官网来源 ${source.id} 的智易旧版关键词页数必须在 1 到 50 之间`);
    }
  }
  if (source.enabled && source.adapter === "tencent") {
    if (!source.tencent) throw new Error(`官网来源 ${source.id} 缺少腾讯适配器配置`);
    if (!Object.keys(source.tencent.cityIds ?? {}).length
      || Object.values(source.tencent.cityIds).some((value) => !Number.isInteger(value))) {
      throw new Error(`官网来源 ${source.id} 的腾讯城市编码无效`);
    }
    if (!Number.isInteger(source.tencent.recruitmentTypeId)) {
      throw new Error(`官网来源 ${source.id} 的腾讯招聘类型无效`);
    }
    if (!["full-time", "part-time"].includes(source.tencent.employmentType)) {
      throw new Error(`官网来源 ${source.id} 的腾讯求职类型无效`);
    }
    if (!Number.isInteger(source.tencent.pageSize) || source.tencent.pageSize < 1 || source.tencent.pageSize > 100) {
      throw new Error(`官网来源 ${source.id} 的腾讯分页大小必须在 1 到 100 之间`);
    }
    if (!Number.isInteger(source.tencent.maximumPagesPerKeyword)
      || source.tencent.maximumPagesPerKeyword < 1
      || source.tencent.maximumPagesPerKeyword > 50) {
      throw new Error(`官网来源 ${source.id} 的腾讯关键词页数必须在 1 到 50 之间`);
    }
  }
  if (source.enabled && source.adapter === "meituan") {
    if (!source.meituan) throw new Error(`官网来源 ${source.id} 缺少美团适配器配置`);
    if (!Object.keys(source.meituan.cityCodes ?? {}).length
      || Object.values(source.meituan.cityCodes).some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error(`官网来源 ${source.id} 的美团城市编码无效`);
    }
    if (typeof source.meituan.jobTypeCode !== "string" || !source.meituan.jobTypeCode.trim()) {
      throw new Error(`官网来源 ${source.id} 的美团招聘类型无效`);
    }
    if (!["full-time", "part-time"].includes(source.meituan.employmentType)) {
      throw new Error(`官网来源 ${source.id} 的美团求职类型无效`);
    }
    if (!Number.isInteger(source.meituan.pageSize) || source.meituan.pageSize < 1 || source.meituan.pageSize > 100) {
      throw new Error(`官网来源 ${source.id} 的美团分页大小必须在 1 到 100 之间`);
    }
    if (!Number.isInteger(source.meituan.maximumPagesPerKeyword)
      || source.meituan.maximumPagesPerKeyword < 1
      || source.meituan.maximumPagesPerKeyword > 50) {
      throw new Error(`官网来源 ${source.id} 的美团关键词页数必须在 1 到 50 之间`);
    }
  }
  if (source.enabled && source.adapter === "baidu") {
    if (!source.baidu) throw new Error(`官网来源 ${source.id} 缺少百度适配器配置`);
    if (!Object.keys(source.baidu.cityCodes ?? {}).length
      || Object.values(source.baidu.cityCodes).some((value) => typeof value !== "string" || !value.trim())) {
      throw new Error(`官网来源 ${source.id} 的百度城市编码无效`);
    }
    if (typeof source.baidu.postTypeCode !== "string" || !source.baidu.postTypeCode.trim()
      || source.baidu.recruitType !== "SOCIAL") {
      throw new Error(`官网来源 ${source.id} 的百度招聘类型无效`);
    }
    if (!["full-time", "part-time"].includes(source.baidu.employmentType)) {
      throw new Error(`官网来源 ${source.id} 的百度求职类型无效`);
    }
    if (!Number.isInteger(source.baidu.pageSize) || source.baidu.pageSize < 1 || source.baidu.pageSize > 10) {
      throw new Error(`官网来源 ${source.id} 的百度分页大小必须在 1 到 10 之间`);
    }
    if (!Number.isInteger(source.baidu.maximumPagesPerKeyword)
      || source.baidu.maximumPagesPerKeyword < 1
      || source.baidu.maximumPagesPerKeyword > 50) {
      throw new Error(`官网来源 ${source.id} 的百度关键词页数必须在 1 到 50 之间`);
    }
  }
  adapters[source.adapter] = (adapters[source.adapter] ?? 0) + 1;
}

const enabled = config.sources.filter((source) => source.enabled).length;
const deferredIds = config.onboardingPolicy?.deferredSourceIds ?? [];
if (!Array.isArray(deferredIds) || new Set(deferredIds).size !== deferredIds.length) {
  throw new Error("官网延后接入来源必须是不重复的数组");
}
if (config.onboardingPolicy
  && (typeof config.onboardingPolicy.deferredReason !== "string"
    || !config.onboardingPolicy.deferredReason.trim())) {
  throw new Error("官网延后接入策略缺少原因");
}
for (const id of deferredIds) {
  const source = config.sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`官网延后接入来源不存在：${id}`);
  if (source.enabled) throw new Error(`官网延后接入来源不能同时启用：${id}`);
}
console.log(`官网来源配置通过：${config.sources.length} 个入口，${enabled} 个已启用`);
console.log(`延后接入：${deferredIds.length} 个纯游戏类公司`);
console.log(`适配器分布：${JSON.stringify(adapters)}`);
