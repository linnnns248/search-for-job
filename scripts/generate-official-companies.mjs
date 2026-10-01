import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const officialConfigPath = path.join(projectRoot, "config", "official-sites.json");
const searchConfigPath = path.join(projectRoot, "public", "data", "config.json");
const outputPath = path.join(projectRoot, "public", "data", "official-companies.json");

const [officialConfig, searchConfig] = await Promise.all([
  readFile(officialConfigPath, "utf8").then(JSON.parse),
  readFile(searchConfigPath, "utf8").then(JSON.parse),
]);

const deferredIds = new Set(officialConfig.onboardingPolicy?.deferredSourceIds ?? []);
const minimumCompanySize = searchConfig.companySize.minimum;
const companies = officialConfig.sources
  .filter((source) => !deferredIds.has(source.id))
  .filter((source) => source.companySizeMin === null || source.companySizeMin >= minimumCompanySize)
  .map((source) => ({
    id: source.id,
    company: source.company,
    companySize: source.companySize ?? "规模待核验",
    companySizeMin: source.companySizeMin,
    careersUrl: source.careersUrl,
    enabled: source.enabled,
  }))
  .sort((left, right) => {
    const sizeDifference = (right.companySizeMin ?? -1) - (left.companySizeMin ?? -1);
    return sizeDifference || left.company.localeCompare(right.company, "zh-CN");
  });

await writeFile(outputPath, `${JSON.stringify({ schemaVersion: 1, companies }, null, 2)}\n`, "utf8");
console.log(`官网公司目录已生成：${companies.length} 家（已排除延后接入和低于规模门槛的公司）`);
