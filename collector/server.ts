import { createHash, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmploymentType, JobDataset } from "../src/types";
import {
  educationRanks,
  parseBossCompanySize,
  parseBossJobDescription,
  parseBossSearchPage,
  parseCompanySizeMin,
} from "./boss/parse";
import { isChineseStatutoryWorkday } from "./calendar";
import { loadCollectorConfig, loadSearchConfig, projectRoot, publicJobsPath } from "./config";
import { matchesConfiguredCriteria } from "./criteria";
import { mergeCollectedJobs } from "./merge";
import { normalizeBossJob } from "./normalize";
import { collectOfficialSources } from "./official/runner";
import type { BossJobCandidate } from "./types";

const port = 43127;
const tokenPath = path.join(projectRoot, ".collector", "extension-token");
const officialStatusPath = path.join(projectRoot, ".collector", "official-status.json");
const detailMetadata = new Map<string, { companySize: string; companySizeMin: number | null }>();
let officialCollectionTask: Promise<void> | null = null;

async function writeOfficialStatus(value: Record<string, unknown>): Promise<void> {
  await mkdir(path.dirname(officialStatusPath), { recursive: true });
  await writeFile(officialStatusPath, `${JSON.stringify({ ...value, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
}

function startOfficialCollection(): boolean {
  if (officialCollectionTask) return false;
  officialCollectionTask = (async () => {
    await writeOfficialStatus({ state: "running", message: "公司官网采集正在运行" });
    try {
      const result = await collectOfficialSources();
      await writeOfficialStatus({ state: "success", message: `公司官网采集完成：${result.accepted} 个岗位`, result });
      console.log(`公司官网采集完成：${result.accepted} 个岗位，当前共 ${result.total} 个`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await writeOfficialStatus({ state: "error", message });
      console.error(`公司官网采集失败：${message}`);
    } finally {
      officialCollectionTask = null;
    }
  })();
  return true;
}

function criteriaSignature(searchConfig: Awaited<ReturnType<typeof loadSearchConfig>>): string {
  return createHash("sha256").update(JSON.stringify({
    cities: searchConfig.cities,
    keywords: searchConfig.keywords,
    titleIncludeKeywords: searchConfig.titleIncludeKeywords,
    employmentTypes: searchConfig.employmentTypes,
    education: searchConfig.education,
    salary: searchConfig.salary,
    companySize: searchConfig.companySize,
  })).digest("hex").slice(0, 16);
}

async function loadOrCreateToken(): Promise<string> {
  await mkdir(path.dirname(tokenPath), { recursive: true });
  try {
    return (await readFile(tokenPath, "utf8")).trim();
  } catch {
    const token = randomBytes(24).toString("base64url");
    await writeFile(tokenPath, `${token}\n`, { encoding: "utf8", mode: 0o600 });
    return token;
  }
}

function setCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (origin?.startsWith("chrome-extension://")) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 8 * 1024 * 1024) throw new Error("请求内容超过 8MB 限制");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function validateBossUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("岗位链接无效");
  const url = new URL(value);
  if (url.protocol !== "https:" || !(url.hostname === "zhipin.com" || url.hostname.endsWith(".zhipin.com"))) {
    throw new Error("只接受 Boss 直聘 HTTPS 链接");
  }
  return url.toString();
}

function sanitizeCandidate(value: unknown): BossJobCandidate {
  if (!value || typeof value !== "object") throw new Error("岗位数据格式无效");
  const candidate = value as Partial<BossJobCandidate>;
  const stringField = (field: keyof BossJobCandidate, maximumLength: number): string => {
    const fieldValue = candidate[field];
    if (typeof fieldValue !== "string") throw new Error(`岗位字段 ${field} 无效`);
    return fieldValue.trim().slice(0, maximumLength);
  };
  const educationLevel = candidate.educationLevel;
  if (educationLevel !== null && educationLevel !== undefined && !(educationLevel in educationRanks)) {
    throw new Error("岗位学历字段无效");
  }
  const employmentType = stringField("employmentType", 50) as EmploymentType;
  if (employmentType !== "full-time" && employmentType !== "part-time") {
    throw new Error("岗位求职类型字段无效");
  }
  return {
    company: stringField("company", 200),
    companySize: stringField("companySize", 100),
    companySizeMin: typeof candidate.companySizeMin === "number" ? candidate.companySizeMin : null,
    title: stringField("title", 200),
    salary: stringField("salary", 100) || "未披露",
    salaryMinK: typeof candidate.salaryMinK === "number" ? candidate.salaryMinK : null,
    salaryMaxK: typeof candidate.salaryMaxK === "number" ? candidate.salaryMaxK : null,
    education: stringField("education", 100),
    educationLevel: educationLevel ?? null,
    employmentType,
    city: stringField("city", 100),
    url: validateBossUrl(candidate.url),
    description: stringField("description", 20_000),
  };
}

async function startServer(): Promise<void> {
  const token = await loadOrCreateToken();
  const server = createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }

  const requestUrl = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "search-for-job-collector" });
    return;
  }
  if (request.headers.authorization !== `Bearer ${token}`) {
    sendJson(response, 401, { error: "本地采集令牌无效" });
    return;
  }

  try {
    const [collectorConfig, searchConfig] = await Promise.all([loadCollectorConfig(), loadSearchConfig()]);
    if (request.method === "GET" && requestUrl.pathname === "/config") {
      sendJson(response, 200, { boss: collectorConfig.boss, schedule: searchConfig.schedule });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/should-run") {
      const date = requestUrl.searchParams.get("date") ?? "";
      const shouldRun = !searchConfig.schedule.statutoryWorkdaysOnly || await isChineseStatutoryWorkday(date);
      sendJson(response, 200, { shouldRun, date });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/collect-official") {
      const started = startOfficialCollection();
      sendJson(response, 202, {
        started,
        message: started ? "公司官网采集已启动" : "公司官网采集已在运行",
      });
      return;
    }
    if (request.method === "GET" && requestUrl.pathname === "/official-status") {
      try {
        sendJson(response, 200, JSON.parse(await readFile(officialStatusPath, "utf8")));
      } catch {
        sendJson(response, 200, { state: "idle", message: "公司官网尚未执行采集" });
      }
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/parse-search") {
      const body = await readJson(request);
      if (typeof body.html !== "string" || typeof body.city !== "string" || typeof body.employmentType !== "string") {
        throw new Error("搜索页参数无效");
      }
      const employmentType = body.employmentType as EmploymentType;
      if (!collectorConfig.boss.employmentTypes.some((type) => type.name === employmentType)) {
        throw new Error("求职类型不在允许配置中");
      }
      // 新版 Boss 搜索卡片不再稳定展示公司规模。先返回候选岗位，待详情页补齐
      // 公司规模后再按配置过滤，避免把所有有效岗位提前丢弃。
      const discoveredJobs = parseBossSearchPage(body.html, body.city, employmentType);
      const jobs = discoveredJobs.filter((job) => matchesConfiguredCriteria(job, collectorConfig.boss));
      const pageFingerprint = createHash("sha256")
        .update(discoveredJobs.map((job) => job.url).sort().join("\n"))
        .digest("hex")
        .slice(0, 16);
      console.log(`搜索页解析：发现 ${discoveredJobs.length} 个，符合前置条件 ${jobs.length} 个`);
      sendJson(response, 200, { jobs, scanned: discoveredJobs.length, pageFingerprint });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/parse-detail") {
      const body = await readJson(request);
      if (typeof body.html !== "string" || typeof body.url !== "string") throw new Error("岗位详情页参数无效");
      const url = validateBossUrl(body.url);
      const description = parseBossJobDescription(body.html);
      const companySize = parseBossCompanySize(body.html);
      detailMetadata.set(url, { companySize, companySizeMin: parseCompanySizeMin(companySize) });
      console.log(`详情页解析：描述 ${description ? "成功" : "失败"}，公司规模 ${companySize || "未识别"}`);
      sendJson(response, 200, { description, companySize });
      return;
    }
    if (request.method === "POST" && requestUrl.pathname === "/ingest") {
      const body = await readJson(request);
      if (!Array.isArray(body.jobs)) throw new Error("缺少岗位数组");
      const candidates = body.jobs.map((value) => {
        if (!value || typeof value !== "object") return value;
        const rawCandidate = value as Partial<BossJobCandidate>;
        const metadata = typeof rawCandidate.url === "string" ? detailMetadata.get(rawCandidate.url) : undefined;
        if (!metadata || rawCandidate.companySizeMin !== null) return value;
        return { ...rawCandidate, ...metadata };
      }).map(sanitizeCandidate).filter(
        (job) => matchesConfiguredCriteria(job, collectorConfig.boss)
          && job.description && job.companySizeMin !== null
          && job.companySizeMin >= collectorConfig.boss.minimumCompanySize,
      );
      if (candidates.length === 0) throw new Error("没有可发布岗位，原数据未修改");
      const generatedAt = new Date().toISOString();
      const existing = JSON.parse(await readFile(publicJobsPath, "utf8")) as JobDataset;
      const normalized = candidates.map((job) => normalizeBossJob(job, generatedAt));
      const currentCriteriaSignature = criteriaSignature(searchConfig);
      const existingForCurrentCriteria = existing.criteriaSignature === currentCriteriaSignature
        ? existing
        : {
            ...existing,
            jobs: existing.jobs.filter((job) => !job.id.startsWith("boss-")),
          };
      const dataset = mergeCollectedJobs(existingForCurrentCriteria, normalized, generatedAt);
      dataset.criteriaSignature = currentCriteriaSignature;
      dataset.jobs = dataset.jobs.filter((job) =>
        searchConfig.titleIncludeKeywords.some((keyword) =>
          job.title.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
        ),
      );
      await writeFile(publicJobsPath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");
      sendJson(response, 200, { accepted: normalized.length, total: dataset.jobs.length, generatedAt });
      return;
    }
    sendJson(response, 404, { error: "接口不存在" });
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) });
  }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`本地采集接收器：http://127.0.0.1:${port}`);
    console.log(`扩展令牌：${token}`);
    console.log("请保持此进程运行；令牌只保存在本机 .collector 目录。按 Ctrl+C 停止。\n");
  });
}

void startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
