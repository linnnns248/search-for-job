import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const requiredJobFields = [
  "id",
  "company",
  "companySize",
  "companySizeMin",
  "title",
  "description",
  "salary",
  "city",
  "sources",
  "firstSeenAt",
  "lastSeenAt",
  "status",
];

const jobsPath = new URL("../public/data/jobs.json", import.meta.url);
const configPath = new URL("../public/data/config.json", import.meta.url);
const jobsData = JSON.parse(await readFile(jobsPath, "utf8"));
const config = JSON.parse(await readFile(configPath, "utf8"));
const currentCriteriaSignature = createHash("sha256").update(JSON.stringify({
  cities: config.cities,
  keywords: config.keywords,
  titleIncludeKeywords: config.titleIncludeKeywords,
  employmentTypes: config.employmentTypes,
  education: config.education,
  salary: config.salary,
  companySize: config.companySize,
})).digest("hex").slice(0, 16);
const datasetUsesCurrentCriteria = jobsData.criteriaSignature === currentCriteriaSignature;

if (jobsData.schemaVersion !== 1 || !Array.isArray(jobsData.jobs)) {
  throw new Error("public/data/jobs.json 必须使用 schemaVersion 1 并包含 jobs 数组");
}

const ids = new Set();
for (const [index, job] of jobsData.jobs.entries()) {
  for (const field of requiredJobFields) {
    if (!(field in job)) throw new Error(`岗位 ${index + 1} 缺少字段：${field}`);
  }
  if (ids.has(job.id)) throw new Error(`岗位 ID 重复：${job.id}`);
  ids.add(job.id);
  if (!Array.isArray(job.sources) || job.sources.length === 0) {
    throw new Error(`岗位 ${job.id} 至少需要一个数据来源`);
  }
  if (job.companySizeMin < config.companySize.minimum) {
    throw new Error(`岗位 ${job.id} 的公司规模小于当前配置`);
  }
  const hasOfficialSource = job.sources.some((source) => source.type === "official");
  if (datasetUsesCurrentCriteria && config.salary.minimumK !== null
    && ((job.salaryMinK === null && !hasOfficialSource)
      || (job.salaryMinK !== null && job.salaryMinK < config.salary.minimumK))) {
    throw new Error(`岗位 ${job.id} 的薪资下限小于当前配置`);
  }
}

if (!Array.isArray(config.cities) || config.cities.length === 0) {
  throw new Error("public/data/config.json 至少需要配置一个城市");
}

if (!Array.isArray(config.keywords) || config.keywords.length === 0) {
  throw new Error("public/data/config.json 至少需要配置一个岗位关键词");
}

if (!Array.isArray(config.employmentTypes) || config.employmentTypes.length === 0) {
  throw new Error("public/data/config.json 至少需要配置一个求职类型");
}

if (!config.education?.minimum) {
  throw new Error("public/data/config.json 必须配置最低学历");
}

if (config.salary.minimumK !== null && config.salary.minimumK < 0) {
  throw new Error("最低薪资不能小于 0");
}

console.log(`数据校验通过：${jobsData.jobs.length} 个岗位，${config.keywords.length} 个关键词`);
