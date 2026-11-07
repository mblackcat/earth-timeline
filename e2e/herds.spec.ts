import { expect, test, type Page } from "@playwright/test";

interface HerdsHandle {
  stats(): { instances: number; agents: number; chases: number; species: string };
  focus(lon: number, lat: number, altitude: number): void;
  pickPoint(): { x: number; y: number; speciesId: string; name: string } | null;
}
type W = { __herds: HerdsHandle; __timeEngine: { pause(): void; seek(t: number): void } };

const stats = (page: Page) => page.evaluate(() => (window as unknown as W).__herds.stats());

async function seek(page: Page, yearsAgo: number) {
  await page.evaluate((t) => (window as unknown as W).__timeEngine.seek(t), yearsAgo);
  await expect(page.getByTestId("geo-caption")).toHaveAttribute("data-load", "ready");
}

test("herds: far-view instances, click to details, continental agents, era switch", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByTestId("geo-caption")).toHaveAttribute("data-load", "ready");
  await page.evaluate(() => (window as unknown as W).__timeEngine.pause());
  await seek(page, 68e6);
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__herds, undefined, { timeout: 30_000 });

  // 远景：有实例，不超过上限
  await expect.poll(async () => (await stats(page)).instances, { timeout: 20_000 }).toBeGreaterThan(0);
  const far = await stats(page);
  expect(far.instances).toBeLessThanOrEqual(2000);

  // 点击实例打开该物种详情
  const pt = await page.evaluate(() => (window as unknown as W).__herds.pickPoint());
  expect(pt).not.toBeNull();
  await page.mouse.click(pt!.x, pt!.y);
  await expect(page.getByTestId("details-card")).toHaveAttribute("data-kind", "species");
  await expect(page.getByTestId("details-card")).toContainText(pt!.name);
  await page.getByTestId("details-close").click();

  // 洲视图：出现完整档，不超过 300
  await page.evaluate(() => (window as unknown as W).__herds.focus(-105, 45, 0.5));
  await expect.poll(async () => (await stats(page)).agents, { timeout: 20_000 }).toBeGreaterThan(0);
  expect((await stats(page)).agents).toBeLessThanOrEqual(300);

  // 换时代：个体集合切换
  await seek(page, 30e6);
  await expect.poll(async () => (await stats(page)).species, { timeout: 20_000 }).not.toBe(far.species);
});
