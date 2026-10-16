// 用法：node scripts/screenshot.mjs [输出路径] [URL]
// 打开应用并截图，同时打印 HTTP 错误与控制台输出（开发调试用）。
import { chromium } from "@playwright/test";

const out = process.argv[2] ?? "screenshot.png";
const url = process.argv[3] ?? "http://localhost:5173/";
const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("response", (r) => r.status() >= 400 && console.log("HTTP", r.status(), r.url()));
page.on("console", (m) => console.log(`console.${m.type()}:`, m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(url);
await page.waitForTimeout(3000);
await page.screenshot({ path: out });
await browser.close();
console.log("saved", out);
