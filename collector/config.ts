import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SearchConfig } from "../src/types";
import type { BossCollectorConfig, CollectorConfig } from "./types";

export const projectRoot = process.cwd();
export const collectorConfigPath = path.join(projectRoot, "config", "collector.json");
export const publicConfigPath = path.join(projectRoot, "public", "data", "config.json");
export const publicJobsPath = path.join(projectRoot, "public", "data", "jobs.json");
export const browserProfilePath = path.join(projectRoot, ".collector", "browser-profile");

export async function loadSearchConfig(): Promise<SearchConfig> {
  return JSON.parse(await readFile(publicConfigPath, "utf8")) as SearchConfig;
}

export async function loadCollectorConfig(): Promise<{ schemaVersion: 1; boss: BossCollectorConfig }> {
  const [sourceConfig, searchConfig] = await Promise.all([
    readFile(collectorConfigPath, "utf8").then((value) => JSON.parse(value) as CollectorConfig),
    loadSearchConfig(),
  ]);
  validateCollectorConfig(sourceConfig, searchConfig);
  return {
    schemaVersion: 1,
    boss: {
      ...sourceConfig.boss,
      cities: searchConfig.cities.map((name) => ({ name, bossCode: sourceConfig.boss.cityCodes[name] })),
      keywords: searchConfig.keywords,
      titleIncludeKeywords: searchConfig.titleIncludeKeywords,
      minimumCompanySize: searchConfig.companySize.minimum,
    },
  };
}

function validateCollectorConfig(config: CollectorConfig, searchConfig: SearchConfig): void {
  if (config.schemaVersion !== 1) throw new Error("采集配置仅支持 schemaVersion 1");
  if (!searchConfig.cities?.length) throw new Error("公开配置至少需要一个城市");
  if (!searchConfig.keywords?.length) throw new Error("公开配置至少需要一个关键词");
  if (!searchConfig.titleIncludeKeywords?.length) throw new Error("至少需要一个岗位名称筛选词");
  for (const city of searchConfig.cities) {
    if (!config.boss.cityCodes[city]) throw new Error(`缺少 ${city} 对应的 Boss 城市编码`);
  }
  if (searchConfig.companySize.minimum < 0) throw new Error("最低公司规模不能小于 0");
  if (config.boss.maximumPagesPerKeyword < 1) throw new Error("每个关键词至少采集 1 页");
  if (config.boss.minimumDelayMs < 1000) throw new Error("最短访问间隔不能小于 1000 毫秒");
  if (config.boss.maximumDelayMs < config.boss.minimumDelayMs) {
    throw new Error("最长访问间隔不能小于最短访问间隔");
  }
}
