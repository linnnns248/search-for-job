import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { JobDataset } from "../src/types";
import {
  parseBossCompanySize,
  parseBossJobDescription,
  parseBossSearchPage,
  parseCompanySizeMin,
} from "./boss/parse";
import { isChineseStatutoryWorkday } from "./calendar";
import { loadCollectorConfig, loadSearchConfig, projectRoot, publicJobsPath } from "./config";
import { mergeCollectedJobs } from "./merge";
import { normalizeBossJob } from "./normalize";
import type { BossJobCandidate } from "./types";

const port = 43127;
const tokenPath = path.join(projectRoot, ".collector", "extension-token");
const detailMetadata = new Map<string, { companySize: string; companySizeMin: number | null }>();

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
  return {
    company: stringField("company", 200),
    companySize: stringField("companySize", 100),
    companySizeMin: typeof candidate.companySizeMin === "number" ? candidate.companySizeMin : null,
    title: stringField("title", 200),
    salary: stringField("salary", 100) || "未披露",
    salaryMinK: typeof candidate.salaryMinK === "number" ? candidate.salaryMinK : null,
    salaryMaxK: typeof candidate.salaryMaxK === "number" ? candidate.salaryMaxK : null,
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
    if (request.method === "POST" && requestUrl.pathname === "/parse-search") {
      const body = await readJson(request);
      if (typeof body.html !== "string" || typeof body.city !== "string") throw new Error("搜索页参数无效");
      // 新版 Boss 搜索卡片不再稳定展示公司规模。先返回候选岗位，待详情页补齐
      // 公司规模后再按配置过滤，避免把所有有效岗位提前丢弃。
      const jobs = parseBossSearchPage(body.html, body.city).filter((job) =>
        collectorConfig.boss.titleIncludeKeywords.some((keyword) =>
          job.title.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()),
        ),
      );
      console.log(`搜索页解析：${jobs.length} 个候选岗位`);
      sendJson(response, 200, { jobs });
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
        (job) => job.description && job.companySizeMin !== null
          && job.companySizeMin >= collectorConfig.boss.minimumCompanySize,
      );
      if (candidates.length === 0) throw new Error("没有可发布岗位，原数据未修改");
      const generatedAt = new Date().toISOString();
      const existing = JSON.parse(await readFile(publicJobsPath, "utf8")) as JobDataset;
      const normalized = candidates.map((job) => normalizeBossJob(job, generatedAt));
      const dataset = mergeCollectedJobs(existing, normalized, generatedAt);
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
