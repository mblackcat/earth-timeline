// 近地表 + 倾斜视角截图，用于目视检查深度精度与线稿质量。
import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:5173/");
await page.waitForTimeout(2500);
const box = await page.locator("canvas").boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await page.mouse.move(cx, cy);
for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, -200); await page.waitForTimeout(40); }
await page.waitForTimeout(2000);
await page.screenshot({ path: process.argv[2] ?? "near.png" });
await page.mouse.down({ button: "right" });
await page.mouse.move(cx + 120, cy + 250, { steps: 12 });
await page.mouse.up({ button: "right" });
await page.waitForTimeout(2000);
await page.screenshot({ path: process.argv[3] ?? "tilt.png" });
await browser.close();
