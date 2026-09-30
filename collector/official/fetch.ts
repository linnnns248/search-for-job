import type { OfficialSitesConfig } from "./types";

const maximumRedirects = 5;

function assertAllowedUrl(value: string, allowedHosts: Set<string>): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLocaleLowerCase();
  if (url.protocol !== "https:") throw new Error(`官网请求只允许 HTTPS：${url.toString()}`);
  if (url.username || url.password) throw new Error("官网请求链接不能包含账号信息");
  if (!allowedHosts.has(hostname)) throw new Error(`官网请求跳转到未授权域名：${hostname}`);
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("官网请求不能访问本机地址");
  }
  if (/^(?:127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(hostname)) {
    throw new Error("官网请求不能访问私有网络地址");
  }
  return url;
}

async function readLimitedBody(response: Response, maximumBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(`官网响应超过 ${maximumBytes} 字节限制`);
  }
  if (!response.body) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.byteLength;
    if (size > maximumBytes) throw new Error(`官网响应超过 ${maximumBytes} 字节限制`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

interface OfficialRequestOptions {
  method?: "GET" | "POST";
  accept: string;
  contentType?: string;
  body?: string;
  referer?: string;
}

async function fetchOfficialBody(
  value: string,
  allowedHosts: string[],
  config: OfficialSitesConfig["collection"],
  options: OfficialRequestOptions,
): Promise<{ body: string; finalUrl: string }> {
  const hosts = new Set(allowedHosts.map((host) => host.toLocaleLowerCase()));
  let url = assertAllowedUrl(value, hosts);
  const referer = options.referer
    ? assertAllowedUrl(options.referer, hosts).toString()
    : undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
  try {
    for (let redirect = 0; redirect <= maximumRedirects; redirect += 1) {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        body: options.body,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: options.accept,
          ...(options.contentType ? { "Content-Type": options.contentType } : {}),
          ...(referer ? { Referer: referer } : {}),
          "User-Agent": "search-for-job/0.3 (+local personal job tracker)",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error(`官网返回 ${response.status} 但没有跳转地址`);
        url = assertAllowedUrl(new URL(location, url).toString(), hosts);
        continue;
      }
      if (!response.ok) throw new Error(`官网请求失败：HTTP ${response.status}`);
      const body = await readLimitedBody(response, config.maximumResponseBytes);
      if (!body.trim()) throw new Error("官网返回空内容");
      return { body, finalUrl: url.toString() };
    }
    throw new Error(`官网跳转次数超过 ${maximumRedirects} 次`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`官网请求超过 ${config.requestTimeoutMs} 毫秒`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchOfficialHtml(
  value: string,
  allowedHosts: string[],
  config: OfficialSitesConfig["collection"],
): Promise<{ html: string; finalUrl: string }> {
  const response = await fetchOfficialBody(value, allowedHosts, config, {
    accept: "text/html,application/xhtml+xml",
  });
  return { html: response.body, finalUrl: response.finalUrl };
}

export async function fetchOfficialJson<T>(
  value: string,
  allowedHosts: string[],
  config: OfficialSitesConfig["collection"],
  request: { method?: "GET" | "POST"; body?: unknown; referer: string },
): Promise<T> {
  const method = request.method ?? (request.body === undefined ? "GET" : "POST");
  const response = await fetchOfficialBody(value, allowedHosts, config, {
    method,
    accept: "application/json",
    contentType: method === "POST" ? "application/json" : undefined,
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
    referer: request.referer,
  });
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error("官网接口没有返回有效 JSON");
  }
}

export async function fetchOfficialFormJson<T>(
  value: string,
  allowedHosts: string[],
  config: OfficialSitesConfig["collection"],
  request: { form: URLSearchParams; referer: string },
): Promise<T> {
  const response = await fetchOfficialBody(value, allowedHosts, config, {
    method: "POST",
    accept: "application/json",
    contentType: "application/x-www-form-urlencoded;charset=utf-8",
    body: request.form.toString(),
    referer: request.referer,
  });
  try {
    return JSON.parse(response.body) as T;
  } catch {
    throw new Error("官网接口没有返回有效 JSON");
  }
}
