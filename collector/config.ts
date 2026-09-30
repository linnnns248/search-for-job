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
      employmentTypes: searchConfig.employmentTypes.map((name) => ({
        name,
        bossCode: sourceConfig.boss.employmentTypeCodes[name],
      })),
      minimumEducation: searchConfig.education.minimum,
      minimumSalaryK: searchConfig.salary.minimumK,
      maximumSalaryK: searchConfig.salary.maximumK,
      minimumCompanySize: searchConfig.companySize.minimum,
    },
  };
}

function validateCollectorConfig(config: CollectorConfig, searchConfig: SearchConfig): void {
  if (config.schemaVersion !== 1) throw new Error("采集配置仅支持 schemaVersion 1");
  if (!searchConfig.cities?.length) throw new Error("公开配置至少需要一个城市");
  if (!searchConfig.keywords?.length) throw new Error("公开配置至少需要一个关键词");
  if (!searchConfig.titleIncludeKeywords?.length) throw new Error("至少需要一个岗位名称筛选词");
  if (!searchConfig.employmentTypes?.length) throw new Error("至少需要一个求职类型");
  if (!searchConfig.education?.minimum) throw new Error("缺少最低学历要求");
  for (const city of searchConfig.cities) {
    if (!config.boss.cityCodes[city]) throw new Error(`缺少 ${city} 对应的 Boss 城市编码`);
  }
  for (const employmentType of searchConfig.employmentTypes) {
    if (!config.boss.employmentTypeCodes[employmentType]) {
      throw new Error(`缺少 ${employmentType} 对应的 Boss 求职类型编码`);
    }
  }
  if (searchConfig.companySize.minimum < 0) throw new Error("最低公司规模不能小于 0");
  if (searchConfig.salary.minimumK !== null && searchConfig.salary.minimumK < 0) {
    throw new Error("最低薪资不能小于 0");
  }
  if (config.boss.maximumPagesPerKeyword < 1) throw new Error("每个关键词至少采集 1 页");
  if (config.boss.maximumDetailsPerRun < 1) throw new Error("单次详情读取上限至少为 1");
  if (config.boss.minimumDelayMs < 1000) throw new Error("最短访问间隔不能小于 1000 毫秒");
  if (config.boss.maximumDelayMs < config.boss.minimumDelayMs) {
    throw new Error("最长访问间隔不能小于最短访问间隔");
  }
  if (config.boss.minimumKeywordPauseMs < config.boss.minimumDelayMs) {
    throw new Error("关键词间冷却时间不能短于普通访问间隔");
  }
  if (config.boss.maximumKeywordPauseMs < config.boss.minimumKeywordPauseMs) {
    throw new Error("关键词间最长冷却时间不能短于最短冷却时间");
  }
  if (config.boss.detailBatchSize < 1) throw new Error("详情批次大小至少为 1");
  if (config.boss.minimumBatchPauseMs < config.boss.minimumDelayMs) {
    throw new Error("详情批次冷却时间不能短于普通访问间隔");
  }
  if (config.boss.maximumBatchPauseMs < config.boss.minimumBatchPauseMs) {
    throw new Error("详情批次最长冷却时间不能短于最短冷却时间");
  }
}
