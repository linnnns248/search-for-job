const tokenInput = document.querySelector<HTMLInputElement>("#token")!;
const saveButton = document.querySelector<HTMLButtonElement>("#save")!;
const runButton = document.querySelector<HTMLButtonElement>("#run")!;
const statusElement = document.querySelector<HTMLElement>("#status")!;

async function refresh(): Promise<void> {
  const state = await chrome.runtime.sendMessage({ type: "get-state" });
  tokenInput.value = state.token ?? "";
  const status = state.collectorStatus;
  statusElement.textContent = status?.message ?? "尚未执行采集";
  statusElement.dataset.state = status?.state ?? "idle";
}

saveButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "save-token", token: tokenInput.value });
  statusElement.textContent = "本地令牌已保存";
});

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  statusElement.textContent = "已启动采集，请保持 Chrome 和本地接收器运行";
  const result = await chrome.runtime.sendMessage({ type: "run-now" });
  if (!result?.ok) statusElement.textContent = result?.error ?? "采集失败";
  await refresh();
  runButton.disabled = false;
});

void refresh();
