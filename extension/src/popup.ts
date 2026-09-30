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
  try {
    const result = await chrome.runtime.sendMessage({ type: "run-now" });
    if (!result?.ok) {
      statusElement.textContent = result?.error ?? "采集启动失败";
      return;
    }
    statusElement.textContent = result.started
      ? "已启动采集，可关闭此弹窗；请保持 Chrome 和本地接收器运行"
      : "采集已在运行，无需重复启动";
  } catch (error) {
    statusElement.textContent = error instanceof Error ? error.message : "采集启动失败";
  } finally {
    runButton.disabled = false;
  }
});

void refresh();
