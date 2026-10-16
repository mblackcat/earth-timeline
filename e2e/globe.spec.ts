import { expect, test, type Page } from "@playwright/test";

const errors: string[] = [];

async function readView(page: Page) {
  const el = page.getByTestId("view-level");
  return {
    altitude: Number(await el.getAttribute("data-altitude")),
    level: Number(await el.getAttribute("data-level")),
    lon: Number(await el.getAttribute("data-lon")),
    lat: Number(await el.getAttribute("data-lat")),
  };
}

/**
 * 截取 canvas 元素的实际合成画面，在页面内解码并统计像素：
 * 非背景像素比例（确认地球被画出）、青色海岸线像素数、简单哈希（判断画面是否变化）。
 */
async function canvasStats(page: Page) {
  const png = await page.locator("canvas").screenshot();
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let lit = 0;
    let cyan = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i]!, data[i + 1]!, data[i + 2]!];
      if (r + g + b > 40) lit++;
      if (g > 120 && b > 110 && r < 140) cyan++;
      if (i % 388 === 0) hash = (hash * 31 + r + g * 7 + b * 13) >>> 0;
    }
    const canvas = document.querySelector("canvas")!;
    return { width: canvas.clientWidth, height: canvas.clientHeight, litRatio: lit / (data.length / 4), cyan, hash };
  }, png.toString("base64"));
}

async function canvasSignature(page: Page) {
  return (await canvasStats(page)).hash;
}

/** 等待相机平滑过渡结束（高度不再变化，且已发布过视图信息）。 */
async function waitSettled(page: Page) {
  let prev = -1;
  let stable = 0;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(150);
    const { altitude } = await readView(page);
    stable = altitude > 0 && Math.abs(altitude - prev) < 1e-4 ? stable + 1 : 0;
    if (stable >= 3) return altitude;
    prev = altitude;
  }
  return prev;
}

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("geo-caption")).toHaveAttribute("data-load", "ready");
  await waitSettled(page);
});

test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

test("renders a real WebGL globe with coastlines", async ({ page }) => {
  const hasWebGL = await page.evaluate(() => {
    const c = document.querySelector("canvas")!;
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });
  expect(hasWebGL).toBe(true);
  const stats = await canvasStats(page);
  expect(stats.litRatio).toBeGreaterThan(0.1); // 地球与大气占据可观面积
  expect(stats.cyan).toBeGreaterThan(200); // 青色海岸线像素
  await expect(page.getByTestId("view-level")).toHaveAttribute("data-level", "0");
  await expect(page.getByTestId("geo-caption")).toContainText("示意数据");
});

test("drag rotates the globe without changing simulated time", async ({ page }) => {
  const box = (await page.locator("canvas").boundingBox())!;
  const before = await canvasSignature(page);
  const time = await page.getByTestId("current-time").textContent();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width / 2 + i * 25, box.y + box.height / 2 + i * 5);
  await page.mouse.up();
  await waitSettled(page);
  expect(await canvasSignature(page)).not.toBe(before);
  await expect(page.getByTestId("current-time")).toHaveText(time!);
});

test("wheel zoom is continuous, bounded, and changes spatial level", async ({ page }) => {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const start = (await readView(page)).altitude;

  // 单次滚轮步长：高度按比例变化，不应出现跳变
  await page.mouse.wheel(0, -100);
  const afterOne = await waitSettled(page);
  expect(afterOne / start).toBeGreaterThan(0.8);
  expect(afterOne / start).toBeLessThan(0.9);

  // 持续放大到下限：层级逐级增加且不穿过地表
  const levels: number[] = [];
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(30);
    levels.push((await readView(page)).level);
  }
  const minAlt = await waitSettled(page);
  expect(minAlt).toBeGreaterThan(0.01);
  expect(minAlt).toBeLessThan(0.03);
  expect((await readView(page)).level).toBe(3);
  for (let i = 1; i < levels.length; i++) expect(levels[i]!).toBeGreaterThanOrEqual(levels[i - 1]!);

  // 缩小到上限
  for (let i = 0; i < 60; i++) await page.mouse.wheel(0, 300);
  const maxAlt = await waitSettled(page);
  expect(maxAlt).toBeLessThanOrEqual(6.0001);
  expect(maxAlt).toBeGreaterThan(4);
});

test("global view and reset view buttons move the camera", async ({ page }) => {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 15; i++) await page.mouse.wheel(0, -200);
  const zoomed = await waitSettled(page);
  expect(zoomed).toBeLessThan(0.5);

  await page.getByTestId("btn-global-view").click();
  const global = await waitSettled(page);
  expect(global).toBeGreaterThan(2);
  expect((await readView(page)).level).toBe(0);

  // 拖动并放大后重置，回到默认视角
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 600, box.y + 350, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -400);
  await waitSettled(page);
  const moved = await canvasSignature(page);
  await page.getByTestId("btn-reset-view").click();
  await waitSettled(page);
  // DEFAULT_VIEW：注视 (20°E, 15°N)，倾斜 0 时地表高度 = 2.4 个地球半径
  // （viewStore 以 0.1% 的变化阈值节流发布，故比较时允许微小误差）
  await expect.poll(async () => (await readView(page)).altitude).toBeCloseTo(2.4, 2);
  expect(await canvasSignature(page)).not.toBe(moved);
});

test("collapsing the settings panel resizes the canvas and keeps the camera", async ({ page }) => {
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -150);
  const alt = await waitSettled(page);

  const w0 = (await canvasStats(page)).width;
  await page.getByTestId("btn-toggle-panel").click();
  await page.waitForTimeout(300);
  const w1 = (await canvasStats(page)).width;
  expect(w1).toBe(w0 + 300);
  // 相机未被重置（重置会跳回 2.4）
  expect(Math.abs((await readView(page)).altitude / alt - 1)).toBeLessThan(0.01);

  // 折叠状态下仍可交互
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  expect(await waitSettled(page)).toBeGreaterThan(alt);

  await page.getByTestId("btn-toggle-panel").click();
  await page.waitForTimeout(300);
  expect((await canvasStats(page)).width).toBe(w0);
});

test("window resize updates the render size", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(400);
  const small = await canvasStats(page);
  expect(small.width).toBe(900 - 300);
  expect(small.height).toBe(600 - 52 - 88);
  expect(small.litRatio).toBeGreaterThan(0.05);
  const drawing = await page.evaluate(() => {
    const c = document.querySelector("canvas")!;
    return { w: c.width, h: c.height, cw: c.clientWidth, dpr: window.devicePixelRatio };
  });
  expect(drawing.w).toBe(Math.round(drawing.cw * Math.min(2, drawing.dpr)));
});

test("layer toggles hide and show scene content", async ({ page }) => {
  const withLines = (await canvasStats(page)).cyan;
  await page.getByTestId("toggle-outlines").click();
  await page.waitForTimeout(300);
  expect((await canvasStats(page)).cyan).toBeLessThan(withLines / 5);
  await expect(page.getByTestId("geo-caption")).toHaveCount(0);
  await page.getByTestId("toggle-outlines").click();
  await page.waitForTimeout(300);
  expect((await canvasStats(page)).cyan).toBeGreaterThan(withLines * 0.8);
});

test("double-click on the globe flies toward that point and zooms in", async ({ page }) => {
  const box = (await page.locator("canvas").boundingBox())!;
  const before = await readView(page);
  // 屏幕中心右上方 → 注视点应向东、向北移动
  await page.mouse.dblclick(box.x + box.width / 2 + 120, box.y + box.height / 2 - 60);
  const after = await waitSettled(page);
  expect(after / before.altitude).toBeCloseTo(0.5, 2);
  const now = await readView(page);
  expect(now.lon).toBeGreaterThan(before.lon + 5);
  expect(now.lat).toBeGreaterThan(before.lat + 2);
});

test("double-click outside the globe does nothing", async ({ page }) => {
  const box = (await page.locator("canvas").boundingBox())!;
  const before = await readView(page);
  await page.mouse.dblclick(box.x + 10, box.y + 10);
  expect(await waitSettled(page)).toBeCloseTo(before.altitude, 3);
  expect((await readView(page)).lon).toBeCloseTo(before.lon, 2);
});
