import { expect, test } from "@playwright/test";

/** Phase 3 验收（PLAN §10 Phase 3）。软件渲染下命令较慢，断言尽量读取最终状态。 */
const errors: string[] = [];
test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto("/");
  await expect(page.getByTestId("timeline-svg")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("geo-caption")).toHaveAttribute("data-load", "ready", { timeout: 30_000 });
});

test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

const engineTime = (page: import("@playwright/test").Page) =>
  page.evaluate(() => (window as unknown as { __timeEngine: { currentTimeYearsAgo: number } }).__timeEngine.currentTimeYearsAgo);

test("dragging the timeline changes the time and the 3D scene follows (geography slice)", async ({ page }) => {
  const box = (await page.getByTestId("timeline-svg").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + 8, { steps: 5 });
  await page.mouse.up();
  const t = await engineTime(page);
  expect(t).toBeGreaterThan(66_000_000); // 分段刻度下 30% 处位于古生代
  await expect(page.getByTestId("current-period")).toContainText("古生代");
  // 场景的地理图层随时间更新：古生代使用板块重建切片
  const caption = page.getByTestId("geo-caption");
  await expect(caption).toHaveAttribute("data-load", "ready");
  await expect(caption).toContainText("板块重建");

  await page.mouse.move(box.x + box.width - 2, box.y + 8);
  await page.mouse.down();
  await page.mouse.up();
  // 回到全新世：现代海岸线（示意）
  await expect(caption).toContainText("现代海岸线");
  await expect(caption).toHaveAttribute("data-load", "ready");
});

test("clicking an event jumps to its time; zooming keeps the marker aligned with the indicator", async ({ page }) => {
  await page.getByTestId("event-end-cretaceous-extinction").click();
  expect(await engineTime(page)).toBe(66_000_000);
  await expect(page.getByTestId("current-period")).toContainText("古近纪");
  for (let i = 0; i < 4; i++) await page.getByTestId("tl-zoom-in").click();
  const ex = Number(await page.getByTestId("event-end-cretaceous-extinction").getAttribute("data-x"));
  const ix = Number(await page.getByTestId("timeline-indicator").getAttribute("data-x"));
  expect(Math.abs(ex - ix)).toBeLessThan(0.5);
  expect(await engineTime(page)).toBe(66_000_000); // 缩放不改变时间
});

test("calendar labels near 1 BCE / 1 CE have no year 0", async ({ page }) => {
  await page.evaluate(() => (window as unknown as { __timeEngine: { seek(t: number): void } }).__timeEngine.seek(2000));
  await expect(page.getByTestId("playback-now")).toHaveText("公元前 1 年");
  await page.getByTestId("btn-step-forward").click();
  await expect(page.getByTestId("playback-now")).toHaveText("公元 1 年");
  for (let i = 0; i < 12; i++) await page.getByTestId("tl-zoom-in").click();
  const labels = await page.locator(".tl-tick text").allTextContents();
  expect(labels.some((l) => l === "0" || l === "前0")).toBe(false);
});
