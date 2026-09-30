const serverBaseUrl = "http://127.0.0.1:43127";
const dailyAlarmName = "daily-job-collection";
const collectionStepAlarmName = "job-collection-step";
const collectionRunStorageKey = "collectionRun";

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
    employmentTypes: Array<{ name: "full-time" | "part-time"; bossCode: string }>;
    minimumEducation: string;
    minimumSalaryK: number | null;
    maximumSalaryK: number | null;
    maximumPagesPerKeyword: number;
    maximumDetailsPerRun: number;
    minimumDelayMs: number;
    maximumDelayMs: number;
    minimumKeywordPauseMs: number;
    maximumKeywordPauseMs: number;
    detailBatchSize: number;
    minimumBatchPauseMs: number;
    maximumBatchPauseMs: number;
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
  education: string;
  educationLevel: string | null;
  employmentType: "full-time" | "part-time";
  city: string;
  url: string;
  description: string;
}

interface CollectionRun {
  trigger: "manual" | "scheduled";
  phase: "search" | "detail";
  tabId?: number;
  cityIndex: number;
  employmentTypeIndex: number;
  keywordIndex: number;
  page: number;
  previousPageFingerprint: string;
  completedQueries: number;
  candidates: Candidate[];
  detailIndex: number;
  completedJobs: Candidate[];
  startedAt: string;
}

let activeStep: Promise<void> | null = null;

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

function randomDuration(minimumMs: number, maximumMs: number): number {
  return Math.floor(minimumMs + Math.random() * (maximumMs - minimumMs + 1));
}

function searchUrl(keyword: string, cityCode: string, employmentTypeCode: string, page: number): string {
  const url = new URL("https://www.zhipin.com/web/geek/jobs");
  url.searchParams.set("query", keyword);
  url.searchParams.set("city", cityCode);
  url.searchParams.set("jobType", employmentTypeCode);
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

async function getCollectionRun(): Promise<CollectionRun | null> {
  const stored = await chrome.storage.local.get(collectionRunStorageKey);
  return (stored[collectionRunStorageKey] as CollectionRun | undefined) ?? null;
}

async function saveCollectionRun(run: CollectionRun): Promise<void> {
  await chrome.storage.local.set({ [collectionRunStorageKey]: run });
}

async function scheduleCollectionStep(delayMs: number): Promise<void> {
  await chrome.alarms.create(collectionStepAlarmName, { when: Date.now() + delayMs });
}

async function ensureCollectionTab(run: CollectionRun): Promise<number> {
  if (run.tabId) {
    const existing = await chrome.tabs.get(run.tabId).catch(() => undefined);
    if (existing?.id) return existing.id;
  }
  const tab = await chrome.tabs.create({ url: "about:blank", active: false });
  if (!tab.id) throw new Error("无法创建 Boss 采集标签页");
  run.tabId = tab.id;
  await saveCollectionRun(run);
  return tab.id;
}

async function clearCollectionRun(run: CollectionRun): Promise<void> {
  await chrome.alarms.clear(collectionStepAlarmName);
  await chrome.storage.local.remove(collectionRunStorageKey);
  if (run.tabId) await chrome.tabs.remove(run.tabId).catch(() => undefined);
}

function moveToNextQuery(run: CollectionRun, config: RuntimeConfig): boolean {
  run.completedQueries += 1;
  run.page = 1;
  run.previousPageFingerprint = "";
  run.keywordIndex += 1;
  if (run.keywordIndex < config.boss.keywords.length) return true;
  run.keywordIndex = 0;
  run.employmentTypeIndex += 1;
  if (run.employmentTypeIndex < config.boss.employmentTypes.length) return true;
  run.employmentTypeIndex = 0;
  run.cityIndex += 1;
  return run.cityIndex < config.boss.cities.length;
}

async function failCollection(run: CollectionRun, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await clearCollectionRun(run);
  await setStatus("error", message);
  await notify("岗位采集需要处理", message).catch(() => undefined);
}

async function completeCollection(run: CollectionRun): Promise<void> {
  if (run.completedJobs.length === 0) throw new Error("没有可发布岗位，原数据未修改");
  const result = await api<{ accepted: number; total: number }>("/ingest", {
    method: "POST",
    body: JSON.stringify({ jobs: run.completedJobs }),
  });
  const official = await api<{ started: boolean; message: string }>("/collect-official", { method: "POST" });
  await clearCollectionRun(run);
  await setStatus(
    "success",
    `Boss 采集完成：${result.accepted} 个岗位；${official.message}`,
    { ...result, officialCollectionStarted: official.started },
  );
  await notify("岗位采集完成", `Boss 本次处理 ${result.accepted} 个岗位；${official.message}。`)
    .catch(() => undefined);
}

async function advanceCollectionRun(): Promise<void> {
  if (activeStep) return activeStep;
  activeStep = (async () => {
    const run = await getCollectionRun();
    if (!run) return;
    try {
      const config = await api<RuntimeConfig>("/config");
      const tabId = await ensureCollectionTab(run);
      if (run.phase === "search") {
        const city = config.boss.cities[run.cityIndex];
        const employmentType = config.boss.employmentTypes[run.employmentTypeIndex];
        const keyword = config.boss.keywords[run.keywordIndex];
        if (!city || !employmentType || !keyword) throw new Error("采集进度与当前配置不匹配，请重新启动");
        await setStatus("running", `正在采集 ${city.name} / ${keyword} / 第 ${run.page} 页`);
        const snapshot = await navigate(
          tabId,
          searchUrl(keyword, city.bossCode, employmentType.bossCode, run.page),
        );
        const parsed = await api<{
          jobs: Candidate[];
          scanned: number;
          pageFingerprint: string;
        }>("/parse-search", {
          method: "POST",
          body: JSON.stringify({
            html: snapshot.html,
            city: city.name,
            employmentType: employmentType.name,
          }),
        });
        const candidates = new Map(run.candidates.map((job) => [job.url, job]));
        for (const job of parsed.jobs) candidates.set(job.url, job);
        run.candidates = [...candidates.values()];
        const queryFinished = parsed.scanned === 0
          || parsed.pageFingerprint === run.previousPageFingerprint
          || run.page >= config.boss.maximumPagesPerKeyword;
        let delayMs = randomDuration(config.boss.minimumDelayMs, config.boss.maximumDelayMs);
        if (queryFinished) {
          const hasNextQuery = moveToNextQuery(run, config);
          if (!hasNextQuery) {
            if (run.candidates.length === 0) throw new Error("没有识别到岗位卡片，原数据未修改");
            run.phase = "detail";
            run.detailIndex = 0;
          } else {
            const queryCount = config.boss.cities.length * config.boss.keywords.length
              * config.boss.employmentTypes.length;
            await setStatus("running", `已完成 ${run.completedQueries}/${queryCount} 组搜索，正在冷却访问`);
            delayMs = randomDuration(config.boss.minimumKeywordPauseMs, config.boss.maximumKeywordPauseMs);
          }
        } else {
          run.previousPageFingerprint = parsed.pageFingerprint;
          run.page += 1;
        }
        await saveCollectionRun(run);
        await scheduleCollectionStep(delayMs);
        return;
      }

      const detailCandidates = run.candidates.slice(0, config.boss.maximumDetailsPerRun);
      if (run.detailIndex >= detailCandidates.length) {
        await completeCollection(run);
        return;
      }
      const candidate = detailCandidates[run.detailIndex];
      await setStatus("running", `正在读取岗位详情 ${run.detailIndex + 1}/${detailCandidates.length}`);
      const snapshot = await navigate(tabId, candidate.url);
      const parsed = await api<{ description: string }>("/parse-detail", {
        method: "POST",
        body: JSON.stringify({ html: snapshot.html, url: snapshot.url }),
      });
      if (parsed.description) run.completedJobs.push({ ...candidate, description: parsed.description });
      run.detailIndex += 1;
      if (run.detailIndex >= detailCandidates.length) {
        await completeCollection(run);
        return;
      }
      const batchFinished = run.detailIndex % config.boss.detailBatchSize === 0;
      if (batchFinished) {
        await setStatus("running", `已读取 ${run.detailIndex} 个详情，正在分批冷却访问`);
      }
      await saveCollectionRun(run);
      await scheduleCollectionStep(randomDuration(
        batchFinished ? config.boss.minimumBatchPauseMs : config.boss.minimumDelayMs,
        batchFinished ? config.boss.maximumBatchPauseMs : config.boss.maximumDelayMs,
      ));
    } catch (error) {
      await failCollection(run, error);
    }
  })();
  try {
    await activeStep;
  } finally {
    activeStep = null;
  }
}

async function startCollection(trigger: "manual" | "scheduled"): Promise<boolean> {
  if (await getCollectionRun()) return false;
  const config = await api<RuntimeConfig>("/config");
  await scheduleDaily(config.schedule.time);
  if (trigger === "scheduled" && config.schedule.statutoryWorkdaysOnly) {
    const date = localDateInShanghai();
    const decision = await api<{ shouldRun: boolean }>(`/should-run?date=${date}`);
    if (!decision.shouldRun) {
      await setStatus("skipped", `${date} 不是中国法定工作日，已跳过`);
      return false;
    }
  }
  if (!config.boss.enabled) throw new Error("Boss 数据源未启用");
  const run: CollectionRun = {
    trigger,
    phase: "search",
    cityIndex: 0,
    employmentTypeIndex: 0,
    keywordIndex: 0,
    page: 1,
    previousPageFingerprint: "",
    completedQueries: 0,
    candidates: [],
    detailIndex: 0,
    completedJobs: [],
    startedAt: new Date().toISOString(),
  };
  await saveCollectionRun(run);
  await setStatus("running", trigger === "manual" ? "正在手动采集" : "正在执行定时采集");
  void advanceCollectionRun();
  return true;
}

chrome.runtime.onInstalled.addListener(() => {
  void scheduleDaily("23:00");
});

chrome.runtime.onStartup.addListener(() => {
  void getSettings().then(({ scheduleTime }) => scheduleDaily(scheduleTime ?? "23:00"));
  void getCollectionRun().then((run) => {
    if (run) return scheduleCollectionStep(1_000);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === dailyAlarmName) void startCollection("scheduled").catch(async (error) => {
    await setStatus("error", error instanceof Error ? error.message : String(error));
  });
  if (alarm.name === collectionStepAlarmName) void advanceCollectionRun();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "save-token") {
    void chrome.storage.local.set({ token: String(message.token ?? "").trim() }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message?.type === "run-now") {
    void startCollection("manual").then((started) => sendResponse({ ok: true, started })).catch((error) => {
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
