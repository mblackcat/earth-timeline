// 在 Node 脚本中加载项目的 TypeScript 数据模块（借助 Vite 的 runnerImport，无需额外依赖）。
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

export async function loadTs(path) {
  const { module } = await runnerImport(path, { root, configFile: false, logLevel: "error" });
  return module;
}
