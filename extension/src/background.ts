const serverBaseUrl = "http://127.0.0.1:43127";
const dailyAlarmName = "daily-job-collection";

interface ExtensionSettings {
  token?: string;
  scheduleTime?: string;
}

interface RuntimeConfig {
  boss: {
    enabled: boolean;
    cities: Array<{ name: string; bossCode: string }>;
    keywords: string[];
    titleIncludeKeywords: string[];
    maximumPagesPerKeyword: number;
    minimumDelayMs: number;
    maximumDelayMs: number;
  };
  schedule: {
    timezone: string;
    time: string;
    statutoryWorkdaysOnly: boolean;
  };
}

interface Snapshot {
  url: string;
  title: string;
  isLoginOrVerification: boolean;
  html: string;
}

interface Candidate {
  company: string;
  companySize: string;
  companySizeMin: number | null;
  title: string;
  salary: string;
  salaryMinK: number | null;
  salaryMaxK: number | null;
  city: string;
  url: string;
  description: string;
}

let activeRun: Promise<void> | null = null;

async function getSettings(): Promise<ExtensionSettings> {
  return chrome.storage.local.get(["token", "scheduleTime"]);
}

async function setStatus(state: string, message: string, details: Record<string, unknown> = {}): Promise<void> {
  await chrome.storage.local.set({
    collectorStatus: { state, message, details, updatedAt: new Date().toISOString() },
  });
  const badge = state === "running" ? "…" : state === "success" ? "✓" : state === "error" ? "!" : "";
  await chrome.action.setBadgeText({ text: badge });
  await chrome.action.setBadgeBackgroundColor({ color: state === "error" ? "#c62828" : "#0f766e" });
}

async function notify(title: string, message: string): Promise<void> {
  await chrome.notifications.create({
    type: "basic",
    iconUrl: "icon.svg",
    title,
    message,
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = await getSettings();
  if (!token) throw new Error("尚未配置本地采集令牌");
  const response = await fetch(`${serverBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `本地接收器返回 ${response.status}`);
  return body;
}

function localDateInShanghai(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function randomDelay(minimumMs: number, maximumMs: number): Promise<void> {
  const duration = Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
  return new Promise((resolve) => setTimeout(resolve, duration));
}

function searchUrl(keyword: string, cityCode: string, page: number): string {
  const url = new URL("https://www.zhipin.com/web/geek/jobs");
  url.searchParams.set("query", keyword);
  url.searchParams.set("city", cityCode);
  if (page > 1) url.searchParams.set("page", String(page));
  return url.toString();
}

function waitForTabComplete(tabId: number, timeoutMs = 45_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Boss 页面加载超时"));
    }, timeoutMs);
    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") return;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function navigate(tabId: number, url: string): Promise<Snapshot> {
  const completed = waitForTabComplete(tabId);
  await chrome.tabs.update(tabId, { url, active: false });
  await completed;
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  const snapshot = await chrome.tabs.sendMessage(tabId, { type: "snapshot" }) as Snapshot;
  if (snapshot.isLoginOrVerification) {
    throw new Error("Boss 登录已失效或出现安全验证，请在普通 Chrome 中人工处理");
  }
  return snapshot;
}

async function scheduleDaily(time: string): Promise<void> {
  const [hour, minute] = time.split(":").map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  await chrome.alarms.clear(dailyAlarmName);
  await chrome.alarms.create(dailyAlarmName, { when: next.getTime(), periodInMinutes: 24 * 60 });
  await chrome.storage.local.set({ scheduleTime: time });
}

async function runCollection(trigger: "manual" | "scheduled"): Promise<void> {
  if (activeRun) return activeRun;
  activeRun = (async () => {
    let tabId: number | undefined;
    try {
      await setStatus("running", trigger === "manual" ? "正在手动采集" : "正在执行定时采集");
      const config = await api<RuntimeConfig>("/config");
      await scheduleDaily(config.schedule.time);
      if (trigger === "scheduled" && config.schedule.statutoryWorkdaysOnly) {
        const date = localDateInShanghai();
        const decision = await api<{ shouldRun: boolean }>(`/should-run?date=${date}`);
        if (!decision.shouldRun) {
          await setStatus("skipped", `${date} 不是中国法定工作日，已跳过`);
          return;
        }
      }
      if (!config.boss.enabled) throw new Error("Boss 数据源未启用");

      const tab = await chrome.tabs.create({ url: "about:blank", active: false });
      if (!tab.id) throw new Error("无法创建 Boss 采集标签页");
      tabId = tab.id;
      const candidates = new Map<string, Candidate>();

      for (const city of config.boss.cities) {
        for (const keyword of config.boss.keywords) {
          for (let page = 1; page <= config.boss.maximumPagesPerKeyword; page += 1) {
            await setStatus("running", `正在采集 ${city.name} / ${keyword} / 第 ${page} 页`);
            const snapshot = await navigate(tabId, searchUrl(keyword, city.bossCode, page));
            const parsed = await api<{ jobs: Candidate[] }>("/parse-search", {
              method: "POST",
              body: JSON.stringify({ html: snapshot.html, city: city.name }),
            });
            if (parsed.jobs.length === 0) break;
            for (const job of parsed.jobs) candidates.set(job.url, job);
            await randomDelay(config.boss.minimumDelayMs, config.boss.maximumDelayMs);
          }
        }
      }

      if (candidates.size === 0) throw new Error("没有识别到岗位卡片，原数据未修改");
      const completedJobs: Candidate[] = [];
      let current = 0;
      for (const candidate of candidates.values()) {
        current += 1;
        await setStatus("running", `正在读取岗位详情 ${current}/${candidates.size}`);
        const snapshot = await navigate(tabId, candidate.url);
        const parsed = await api<{ description: string }>("/parse-detail", {
          method: "POST",
          body: JSON.stringify({ html: snapshot.html, url: snapshot.url }),
        });
        if (parsed.description) completedJobs.push({ ...candidate, description: parsed.description });
        await randomDelay(config.boss.minimumDelayMs, config.boss.maximumDelayMs);
      }

      const result = await api<{ accepted: number; total: number }>("/ingest", {
        method: "POST",
        body: JSON.stringify({ jobs: completedJobs }),
      });
      await setStatus("success", `采集完成：新增或更新 ${result.accepted} 个岗位`, result);
      await notify("岗位采集完成", `本次处理 ${result.accepted} 个岗位，当前共 ${result.total} 个。`)
        .catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await setStatus("error", message);
      await notify("岗位采集需要处理", message).catch(() => undefined);
      throw error;
    } finally {
      if (tabId) await chrome.tabs.remove(tabId).catch(() => undefined);
      activeRun = null;
    }
  })();
  return activeRun;
}

chrome.runtime.onInstalled.addListener(() => {
  void scheduleDaily("23:00");
});

chrome.runtime.onStartup.addListener(() => {
  void getSettings().then(({ scheduleTime }) => scheduleDaily(scheduleTime ?? "23:00"));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === dailyAlarmName) void runCollection("scheduled").catch(() => undefined);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "save-token") {
    void chrome.storage.local.set({ token: String(message.token ?? "").trim() }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "run-now") {
    void runCollection("manual").then(() => sendResponse({ ok: true })).catch((error) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    });
    return true;
  }
  if (message?.type === "get-state") {
    void chrome.storage.local.get(["token", "collectorStatus", "scheduleTime"]).then(sendResponse);
    return true;
  }
  return false;
});
