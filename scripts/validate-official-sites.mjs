import { readFile } from "node:fs/promises";

const configPath = new URL("../config/official-sites.json", import.meta.url);
const config = JSON.parse(await readFile(configPath, "utf8"));

if (config.schemaVersion !== 1 || !config.publicationPolicy || !Array.isArray(config.sources)) {
  throw new Error("官网来源配置必须使用 schemaVersion 1，并包含 publicationPolicy 和 sources 数组");
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
  adapters[source.adapter] = (adapters[source.adapter] ?? 0) + 1;
}

const enabled = config.sources.filter((source) => source.enabled).length;
console.log(`官网来源配置通过：${config.sources.length} 个入口，${enabled} 个已启用`);
console.log(`适配器分布：${JSON.stringify(adapters)}`);

