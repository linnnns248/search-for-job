import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(projectRoot, "extension");
const outputDirectory = path.join(extensionRoot, "dist");

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await build({
  entryPoints: {
    background: path.join(extensionRoot, "src", "background.ts"),
    content: path.join(extensionRoot, "src", "content.ts"),
    popup: path.join(extensionRoot, "src", "popup.ts"),
  },
  bundle: true,
  format: "iife",
  target: "chrome120",
  outdir: outputDirectory,
  sourcemap: true,
});

for (const file of ["manifest.json", "popup.html", "popup.css", "icon.svg"]) {
  await cp(path.join(extensionRoot, file), path.join(outputDirectory, file));
}

console.log(`扩展构建完成：${outputDirectory}`);
