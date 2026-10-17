import { expect, test, type Page } from "@playwright/test";

/**
 * 软件渲染（SwiftShader）下 Playwright 的每条命令可能耗时数秒，
 * 因此带时间断言的流程在页面内用 performance.now() 一次性完成，
 * 避免命令延迟污染"真实经过时间 vs 模拟时间"的对比。
 */
const errors: string[] = [];

test.setTimeout(120_000);

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto("/");
  await expect(page.getByTestId("playback-controls")).toBeVisible({ timeout: 30_000 });
});

test.afterEach(() => {
  expect(errors, errors.join("\n")).toEqual([]);
});

type Eng = { currentTimeYearsAgo: number; isPlaying: boolean };

/** 页面内的小工具：点击、读取模拟时间、等待。 */
async function inPage<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  return page.evaluate(fn);
}

test("1 yr/s: sim time tracks real elapsed time; pause freezes it; resume is continuous", async ({ page }) => {
  const r = await inPage(page, async () => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const eng = () => (window as unknown as { __timeEngine: Eng }).__timeEngine;
    const t = () => eng().currentTimeYearsAgo;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const out: Record<string, number> = { start: t() };
    q("dir-backward").click();
    {
      const sel = q("speed-select") as HTMLSelectElement;
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      set.call(sel, "1");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(50);

    const w0 = performance.now();
    q("btn-play").click();
    await sleep(3000);
    const sim1 = t();
    const w1 = performance.now();
    q("btn-play").click(); // 暂停
    await sleep(0);
    const paused = t();
    await sleep(1000);
    out.frozenDelta = t() - paused;
    out.run1Sim = paused;
    out.run1Real = (w1 - w0) / 1000;
    out.run1Lag = Math.abs(paused - sim1);

    q("btn-play").click(); // 继续
    const w2 = performance.now();
    await sleep(2000);
    q("btn-play").click();
    await sleep(0);
    out.run2Sim = t() - paused;
    out.run2Real = (performance.now() - w2) / 1000;
    return out;
  });
  expect(r.start).toBe(0);
  expect(r.frozenDelta).toBe(0);
  // 1 年/秒：模拟增量与真实经过时间一致（容差 0.6 年，覆盖主线程卡顿）
  expect(Math.abs(r.run1Sim! - r.run1Real!)).toBeLessThan(0.6);
  expect(Math.abs(r.run2Sim! - r.run2Real!)).toBeLessThan(0.6);
});

test("forward play returns toward the present and stops at the boundary", async ({ page }) => {
  const r = await inPage(page, async () => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const eng = () => (window as unknown as { __timeEngine: Eng }).__timeEngine;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    {
      const sel = q("speed-select") as HTMLSelectElement;
      const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
      set.call(sel, "1");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await sleep(50);
    q("btn-step-back").click();
    const afterStep = eng().currentTimeYearsAgo;
    q("btn-play").click();
    await sleep(2500);
    await sleep(100); // 让 React 提交最新的提示文本
    return {
      afterStep,
      end: eng().currentTimeYearsAgo,
      playing: String(eng().isPlaying),
      hint: q("playback-hint").textContent,
    };
  });
  expect(r.afterStep).toBe(1);
  expect(r.end).toBe(0);
  expect(r.playing).toBe("false");
  expect(r.hint).toContain("已到达现代");
});

test("deep mode: 4 s target plays the whole history; mode switch keeps the time", async ({ page }) => {
  await page.getByTestId("btn-seek-origin").click();
  await page.getByTestId("target-seconds").fill("4");
  await page.getByTestId("apply-target").click();
  const r = await inPage(page, async () => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const eng = () => (window as unknown as { __timeEngine: Eng }).__timeEngine;
    const t = () => eng().currentTimeYearsAgo;
    const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
    const start = t();
    const w0 = performance.now();
    q("btn-play").click();
    await sleep(1500);
    const mid = t();
    const real = (performance.now() - w0) / 1000;
    await sleep(4500);
    return { start, mid, real, end: t(), playing: String(eng().isPlaying) };
  });
  expect(r.start).toBe(4_540_000_000);
  // 4 秒播完 45.4 亿年 → 约 11.35 亿年/秒
  const expectedMid = 4_540_000_000 - (4_540_000_000 / 4) * r.real!;
  expect(Math.abs(r.mid! - expectedMid)).toBeLessThan(4_540_000_000 * 0.12);
  expect(r.end).toBe(0);
  expect(r.playing).toBe("false");
});

test("camera zoom and layer toggles do not touch simulated time, which keeps playing", async ({ page }) => {
  await page.getByTestId("btn-seek-origin").click();
  await page.getByTestId("speed-select").selectOption("1m");
  const box = (await page.locator("canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByTestId("btn-play").click();
  await page.mouse.wheel(0, -300);
  await page.getByTestId("toggle-graticule").click();
  const probe = await inPage(page, async () => {
    const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
    const eng = () => (window as unknown as { __timeEngine: Eng }).__timeEngine;
    const t = () => eng().currentTimeYearsAgo;
    const a = t();
    await new Promise((res) => setTimeout(res, 800));
    const b = t();
    q("btn-play").click(); // 暂停
    return { a, b };
  });
  expect(probe.b).toBeLessThan(probe.a); // 仍在推进
  expect(probe.b).toBeGreaterThan(4_000_000_000); // 且没有被重置或跳变
});
