import { expect, test, type Page } from "@playwright/test";

/**
 * 板块漂移插值：切片内海岸线连续移动，跨切片边界不跳变。
 * 画面按 48×32 网格统计墨色像素，比较两个时刻之间的差异量。
 */
async function inkGrid(page: Page): Promise<number[]> {
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
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    const GX = 48;
    const GY = 32;
    const grid = new Array<number>(GX * GY).fill(0);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (data[i]! < 60 && data[i + 1]! < 60 && data[i + 2]! < 60) grid[Math.floor((y / height) * GY) * GX + Math.floor((x / width) * GX)]!++;
      }
    }
    return grid;
  }, png.toString("base64"));
}

const diff = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]!), 0);

async function at(page: Page, yearsAgo: number) {
  await page.evaluate((t) => (window as unknown as { __timeEngine: { pause(): void; seek(t: number): void } }).__timeEngine.seek(t), yearsAgo);
  await expect(page.getByTestId("geo-caption")).toHaveAttribute("data-load", "ready");
  // 遮罩重绘有节流；等几帧让轮廓、遮罩、化石点都更新到位
  await page.waitForTimeout(400);
  return inkGrid(page);
}

test("coastlines drift continuously within a slice and do not jump at slice boundaries", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("geo-caption")).toHaveAttribute("data-load", "ready");
  await page.evaluate(() => (window as unknown as { __timeEngine: { pause(): void } }).__timeEngine.pause());

  const a = await at(page, 100e6);
  const b = await at(page, 90e6);
  const c = await at(page, 80.1e6);
  const d = await at(page, 79.9e6);
  const again = await at(page, 79.9e6);

  const noise = diff(d, again);
  const within = diff(a, b);
  const boundary = diff(c, d);
  console.log({ noise, within, boundary });
  // 半个切片（10 Ma）内海岸线明显移动
  expect(within).toBeGreaterThan(noise * 5 + 500);
  // 跨 80 Ma 边界（0.2 Ma）的变化远小于切片内 10 Ma 的漂移
  expect(boundary).toBeLessThan(within * 0.5);
});
