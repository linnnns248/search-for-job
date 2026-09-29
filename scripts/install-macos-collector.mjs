import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const label = "cn.wangbinnanxi.search-for-job.collector";
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collectorDirectory = path.join(projectRoot, ".collector");
const launchAgentsDirectory = path.join(os.homedir(), "Library", "LaunchAgents");
const plistPath = path.join(launchAgentsDirectory, `${label}.plist`);
const domain = `gui/${process.getuid()}`;

function xml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function launchctl(...arguments_) {
  return execFileSync("/bin/launchctl", arguments_, { encoding: "utf8", stdio: "pipe" });
}

async function uninstall() {
  try {
    launchctl("bootout", domain, plistPath);
  } catch {
    // The service may already be stopped; removing the plist is still safe.
  }
  await rm(plistPath, { force: true });
  console.log(`已移除自动启动服务：${label}`);
}

async function install() {
  await mkdir(collectorDirectory, { recursive: true });
  await mkdir(launchAgentsDirectory, { recursive: true });
  const bundledServer = path.join(collectorDirectory, "server.cjs");
  await build({
    entryPoints: [path.join(projectRoot, "collector", "server.ts")],
    outfile: bundledServer,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    sourcemap: false,
  });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(process.execPath)}</string>
    <string>${xml(bundledServer)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(projectRoot)}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xml(path.join(collectorDirectory, "collector.log"))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(path.join(collectorDirectory, "collector.error.log"))}</string>
</dict>
</plist>
`;

  try {
    launchctl("bootout", domain, plistPath);
  } catch {
    // First installation has no existing service to stop.
  }
  await writeFile(plistPath, plist, { encoding: "utf8", mode: 0o600 });
  launchctl("bootstrap", domain, plistPath);
  launchctl("enable", `${domain}/${label}`);
  launchctl("kickstart", "-k", `${domain}/${label}`);
  console.log(`本地接收器已设为登录后自动启动：${label}`);
  console.log(`配置文件：${plistPath}`);
}

if (process.argv.includes("--uninstall")) await uninstall();
else await install();
