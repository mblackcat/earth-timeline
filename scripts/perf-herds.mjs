// 真机 FPS 测量（设计 §5）：需要 dev server 在 5173；用 arch -arm64 运行。
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";
const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.waitForFunction(() => document.querySelector("[data-testid=geo-caption]")?.getAttribute("data-load") === "ready", null, { timeout: 120000 });
await page.waitForFunction(() => !!window.__herds, null, { timeout: 60000 });

const run = async (name, setup) => {
  await page.evaluate(setup);
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => window.__herds.measureFps(30));
  const s = await page.evaluate(() => window.__herds.stats());
  console.log(JSON.stringify({ name, ...r, ...s }));
};

await run("far · Cretaceous", () => {
  window.__timeEngine.pause();
  window.__timeEngine.seek(68e6);
  window.__herds.focus(-60, 20, 2.4);
});
await run("continental · North America", () => {
  window.__herds.setPromoteMax(150);
  window.__timeEngine.pause();
  window.__timeEngine.seek(68e6);
  window.__herds.focus(-105, 45, 0.5);
});
await run("smart playback", () => {
  window.__herds.focus(20, 15, 2.4);
  window.__timeEngine.seek(300e6);
  window.__timeEngine.play();
});
await browser.close();
