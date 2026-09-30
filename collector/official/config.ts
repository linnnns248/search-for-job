import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../config";
import type { OfficialSiteSource, OfficialSitesConfig } from "./types";

export const officialSitesPath = path.join(projectRoot, "config", "official-sites.json");
const adapterTypes = new Set(["json-ld", "selector", "moka", "zhiye", "custom", "pending"]);
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
  }
}

export function validateOfficialSitesConfig(value: unknown): OfficialSitesConfig {
  if (!value || typeof value !== "object") throw new Error("官网来源配置格式无效");
  const config = value as Partial<OfficialSitesConfig>;
  if (config.schemaVersion !== 1 || !config.publicationPolicy || !Array.isArray(config.sources)) {
    throw new Error("官网来源配置必须使用 schemaVersion 1，并包含 publicationPolicy 和 sources 数组");
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
  return config as OfficialSitesConfig;
}

export async function loadOfficialSitesConfig(): Promise<OfficialSitesConfig> {
  return validateOfficialSitesConfig(JSON.parse(await readFile(officialSitesPath, "utf8")));
}
