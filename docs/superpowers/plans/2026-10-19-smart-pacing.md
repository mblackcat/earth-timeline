# 智能倍速 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增"智能"倍速：按内容密度放慢 / 加快，全程时长可预期；默认档改为"智能 · 约 3 分钟"。

**Architecture:** 纯函数 `buildPacing` 在时间轴位置 u 上建注意力密度 ρ 与扭曲坐标 W 的查找表；`TimeEngine` 新增 `"smart"` 模式，在 W 上匀速播放（锚点 + 已播秒数模型不变）。数据锚点收集放在 `simulation/pacingAnchors.ts`，runtime 注入引擎。

**Tech Stack:** TypeScript、Vitest（jsdom）、React 19、Zustand、Playwright。

设计：`docs/superpowers/specs/2026-10-19-smart-pacing-design.md`（锚点收集模块从 `timeline/` 改放 `simulation/`，保持 timeline 层不依赖数据）。

**环境：** 每条命令前 `export PATH=/Users/joeyzhao/.nvm/versions/node/v22.22.0/bin:$PATH`；e2e 用 `arch -arm64`。用户要求提交前明确授权——本计划不含提交步骤，完成后统一询问。

---

## 文件

| 文件 | 职责 |
|---|---|
| Create `src/timeline/pacing.ts` | 密度、W 查找表、正反查、瞬时倍率（纯函数） |
| Create `src/timeline/pacing.test.ts` | 上述单元测试 |
| Create `src/simulation/pacingAnchors.ts` | 从事件 / 物种 / 纪 / 切片收集锚点 |
| Create `src/simulation/pacingAnchors.test.ts` | 锚点收集测试 |
| Modify `src/timeline/TimeEngine.ts` | `"smart"` 模式、`setPacing`、`setSmartDuration`、快照 `smartSeconds` |
| Modify `src/timeline/TimeEngine.test.ts` | 智能模式测试 |
| Modify `src/timeline/speeds.ts` | 智能预设、默认档、匹配 |
| Modify `src/timeline/runtime.ts` | 构建并注入 pacing |
| Modify `src/state/timeStore.ts` | 初始 `smartSeconds` |
| Modify `src/components/Timeline/PlaybackBar.tsx` + test | 避免智能模式下每帧重渲染；预设测试 |
| Modify `src/components/SettingsPanel/PlaybackSettings.tsx` + test | 当前倍率显示（量化订阅） |
| Modify `e2e/*.spec.ts` | 依赖默认倍速的断言 |
| Modify `TASKS.md`、`HANDOFF.md` | 记录 |

---

### Task 1: pacing 查找表

**Files:** Create `src/timeline/pacing.ts`, `src/timeline/pacing.test.ts`

- [ ] **Step 1: 写失败测试** `src/timeline/pacing.test.ts`

```ts
import { buildPacing } from "./pacing";
import { TimeScale } from "./TimeScale";

const MAX = 4_540_000_000;
const scale = new TimeScale("segmented", MAX, 0);

describe("buildPacing", () => {
  it("W is monotonic from 0 (oldest) to 1 (present)", () => {
    const p = buildPacing(scale, [{ yearsAgo: 66_000_000, weight: 1 }]);
    expect(p.toW(MAX)).toBe(0);
    expect(p.toW(0)).toBeCloseTo(1, 12);
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const w = p.toW(scale.fromU(i / 200));
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });

  it("fromW inverts toW", () => {
    const p = buildPacing(scale, [{ yearsAgo: 252_000_000, weight: 1 }, { yearsAgo: 10_000, weight: 1 }]);
    for (const t of [MAX, 3e9, 538_800_000, 252_000_000, 66e6, 2.58e6, 11_700, 5_000, 240, 0]) {
      expect(p.fromW(p.toW(t))).toBeCloseTo(t, -Math.max(0, Math.floor(Math.log10(t + 1)) - 6));
    }
    expect(p.fromW(-0.1)).toBe(MAX);
    expect(p.fromW(1.1)).toBe(0);
  });

  it("without anchors, playback is uniform along the timeline", () => {
    const p = buildPacing(scale, []);
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) expect(p.toW(scale.fromU(u))).toBeCloseTo(u, 6);
  });

  it("slows down near anchors, capped at maxSlowdown", () => {
    const p = buildPacing(scale, [{ yearsAgo: 66_000_000, weight: 5 }]);
    const near = p.rateAt(66_000_000, 180);
    const empty = buildPacing(scale, []).rateAt(66_000_000, 180);
    const far = p.rateAt(30_000_000, 180);
    expect(near).toBeLessThan(far);
    // 有峰时总量变大、其他地方会略快，所以与无锚点时对比放慢倍数
    expect(empty / near).toBeGreaterThan(3);
    expect(p.densityAt(66_000_000)).toBeLessThanOrEqual(6);
  });

  it("rateAt × duration integrates to the whole span", () => {
    const p = buildPacing(scale, [{ yearsAgo: 66_000_000, weight: 1 }]);
    // 数值积分 ∫ rate dt（秒）= 总年数
    const T = 180;
    const steps = 20_000;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      const t = p.fromW((i + 0.5) / steps);
      sum += p.rateAt(t, T) * (T / steps);
    }
    expect(sum / MAX).toBeCloseTo(1, 2);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/timeline/pacing.test.ts` → FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/timeline/pacing.ts`

```ts
import type { TimeScale } from "./TimeScale";

/**
 * 智能倍速的时间扭曲（设计：docs/superpowers/specs/2026-10-19-smart-pacing-design.md）。
 *
 * 在时间轴位置 u（TimeScale，0 = 最古老，1 = 现代）上定义注意力密度 ρ(u) ≥ 1，
 * 积分归一化得扭曲坐标 W(u) ∈ [0, 1]。智能模式在 W 上匀速播放：ρ ≡ 1 时滑块匀速，
 * ρ 大的地方（事件、物种出现 / 灭绝等）放慢。纯 TypeScript，不依赖数据。
 */

export interface PacingAnchor {
  yearsAgo: number;
  weight: number;
}

export interface PacingOptions {
  /** u 的采样点数。 */
  samples: number;
  /** 峰宽（对数时间 ln(t + offsetYears) 上的标准差）。 */
  sigma: number;
  /** 让"现在"附近的对数有限。 */
  offsetYears: number;
  /** 局部最多放慢的倍数（相对时间轴匀速）。 */
  maxSlowdown: number;
}

export const PACING_OPTIONS: PacingOptions = { samples: 8192, sigma: 0.12, offsetYears: 100, maxSlowdown: 6 };

export interface Pacing {
  /** yearsAgo → w ∈ [0, 1]（0 = 最古老）。 */
  toW(yearsAgo: number): number;
  /** w → yearsAgo；w 超出 [0, 1] 时夹取到两端。 */
  fromW(w: number): number;
  /** 在 seconds 秒播完全程时，yearsAgo 处的瞬时倍率（年/秒）。 */
  rateAt(yearsAgo: number, seconds: number): number;
  /** yearsAgo 处的密度 ρ（1 = 时间轴匀速）。 */
  densityAt(yearsAgo: number): number;
}

export function buildPacing(scale: TimeScale, anchors: PacingAnchor[], opts: PacingOptions = PACING_OPTIONS): Pacing {
  const { samples: n, sigma, offsetYears: c, maxSlowdown: S } = opts;
  const peaks = anchors.filter((a) => Number.isFinite(a.yearsAgo) && a.weight > 0).map((a) => ({ l: Math.log(Math.max(0, a.yearsAgo) + c), w: a.weight }));

  const densityAt = (yearsAgo: number) => {
    const l = Math.log(Math.max(0, yearsAgo) + c);
    let s = 0;
    for (const p of peaks) {
      const z = (l - p.l) / sigma;
      if (z > -5 && z < 5) s += p.w * Math.exp(-0.5 * z * z);
    }
    return 1 + (S - 1) * Math.tanh(s);
  };

  const rho = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) rho[i] = densityAt(scale.fromU(i / n));
  const W = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) W[i] = W[i - 1]! + (rho[i - 1]! + rho[i]!) / (2 * n);
  const total = W[n]!;
  for (let i = 1; i <= n; i++) W[i] = W[i]! / total;
  W[n] = 1;

  const cell = (u: number) => Math.min(n - 1, Math.max(0, Math.floor(u * n)));

  const toW = (yearsAgo: number) => {
    const x = scale.toU(yearsAgo) * n;
    const i = cell(x / n);
    return W[i]! + (x - i) * (W[i + 1]! - W[i]!);
  };

  const fromW = (w: number) => {
    if (w <= 0) return scale.fromU(0);
    if (w >= 1) return scale.fromU(1);
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (W[mid]! <= w) lo = mid;
      else hi = mid;
    }
    const span = W[lo + 1]! - W[lo]!;
    const f = span > 0 ? (w - W[lo]!) / span : 0;
    return scale.fromU((lo + f) / n);
  };

  const rateAt = (yearsAgo: number, seconds: number) => {
    const u = scale.toU(yearsAgo);
    const i = cell(u);
    const dWdu = (W[i + 1]! - W[i]!) * n;
    return scale.yearsPerU(u) / dWdu / seconds;
  };

  return { toW, fromW, rateAt, densityAt };
}
```

- [ ] **Step 4: 运行确认通过** — `npx vitest run src/timeline/pacing.test.ts` → PASS

---

### Task 2: 锚点收集

**Files:** Create `src/simulation/pacingAnchors.ts`, `src/simulation/pacingAnchors.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { EVENTS, eventAnchorYearsAgo } from "../data/events";
import { SPECIES } from "../data/species";
import { PACING_WEIGHTS, collectPacingAnchors } from "./pacingAnchors";

describe("collectPacingAnchors", () => {
  const anchors = collectPacingAnchors();
  const has = (t: number, w: number) => anchors.some((a) => a.yearsAgo === t && a.weight === w);

  it("includes every event anchor", () => {
    for (const e of EVENTS) expect(has(eventAnchorYearsAgo(e), PACING_WEIGHTS.event)).toBe(true);
  });

  it("includes species appearances and extinctions, but not 'extant' (0)", () => {
    for (const s of SPECIES) {
      expect(has(s.time.fromYearsAgo, PACING_WEIGHTS.species)).toBe(true);
      if (s.time.toYearsAgo > 0) expect(has(s.time.toYearsAgo, PACING_WEIGHTS.species)).toBe(true);
    }
    expect(anchors.some((a) => a.yearsAgo === 0 && a.weight === PACING_WEIGHTS.species)).toBe(false);
  });

  it("includes period boundaries and reconstruction slices", () => {
    expect(has(66_000_000, PACING_WEIGHTS.period)).toBe(true);
    expect(has(100_000_000, PACING_WEIGHTS.slice)).toBe(true);
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npx vitest run src/simulation/pacingAnchors.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
import { EVENTS, eventAnchorYearsAgo } from "../data/events";
import { RECONSTRUCTION_TIMES_MA } from "../data/geology/reconstruction";
import { GEO_UNITS } from "../data/geology/timescale";
import { maToYearsAgo } from "../data/schema";
import { SPECIES } from "../data/species";
import type { PacingAnchor } from "../timeline/pacing";

/** 智能倍速的放慢权重：事件 > 物种出现 / 灭绝 > 纪的边界 > 古地理切片。 */
export const PACING_WEIGHTS = { event: 1, species: 0.6, period: 0.4, slice: 0.3 } as const;

/** 从数据收集智能倍速的峰值锚点。新增事件 / 物种会自动影响节奏。 */
export function collectPacingAnchors(): PacingAnchor[] {
  const out: PacingAnchor[] = [];
  for (const e of EVENTS) out.push({ yearsAgo: eventAnchorYearsAgo(e), weight: PACING_WEIGHTS.event });
  for (const s of SPECIES) {
    out.push({ yearsAgo: s.time.fromYearsAgo, weight: PACING_WEIGHTS.species });
    // 现生物种的 toYearsAgo = 0，"现在"已经有事件锚点
    if (s.time.toYearsAgo > 0) out.push({ yearsAgo: s.time.toYearsAgo, weight: PACING_WEIGHTS.species });
  }
  for (const p of GEO_UNITS.period) if (p.range.toYearsAgo > 0) out.push({ yearsAgo: p.range.toYearsAgo, weight: PACING_WEIGHTS.period });
  for (const ma of RECONSTRUCTION_TIMES_MA) out.push({ yearsAgo: maToYearsAgo(ma), weight: PACING_WEIGHTS.slice });
  return out;
}
```

- [ ] **Step 4: 运行确认通过**

---

### Task 3: TimeEngine 智能模式

**Files:** Modify `src/timeline/TimeEngine.ts`, `src/timeline/TimeEngine.test.ts`

- [ ] **Step 1: 在 `TimeEngine.test.ts` 末尾追加失败测试**

```ts
import { buildPacing } from "./pacing";
import { TimeScale } from "./TimeScale";

describe("TimeEngine smart mode", () => {
  const pacing = buildPacing(new TimeScale("segmented", EARTH_FORMATION_YEARS_AGO, 0), [{ yearsAgo: 66_000_000, weight: 1 }]);
  const smart = (start = EARTH_FORMATION_YEARS_AGO, dir: "forward" | "backward" = "forward") => {
    fake = 0;
    const e = mk({ startYearsAgo: start, mode: "deep" });
    e.setPacing(pacing);
    e.setSmartDuration(180);
    expect(e.setMode("smart")).toBe(true);
    e.setDirection(dir);
    e.tick(0);
    e.play(0);
    return e;
  };

  it("refuses smart mode without pacing", () => {
    const e = mk();
    expect(e.setMode("smart")).toBe(false);
    expect(e.getSnapshot().mode).toBe("fine");
  });

  it("plays the whole span in smartSeconds", () => {
    const e = smart();
    run(e, 0, 179);
    expect(e.isPlaying).toBe(true);
    run(e, 179_000, 1.5);
    expect(e.isPlaying).toBe(false);
    expect(e.currentTimeYearsAgo).toBe(0);
    expect(e.getSnapshot().boundary).toBe("modern");
  });

  it("follows the warp: position = fromW(elapsed / T)", () => {
    const e = smart();
    run(e, 0, 90);
    expect(pacing.toW(e.currentTimeYearsAgo)).toBeCloseTo(0.5, 3);
  });

  it("reports the instantaneous rate and smartSeconds in snapshots", () => {
    const e = smart();
    run(e, 0, 30);
    const s = e.getSnapshot();
    expect(s.mode).toBe("smart");
    expect(s.smartSeconds).toBe(180);
    expect(s.rate).toBeCloseTo(pacing.rateAt(s.currentTimeYearsAgo, 180), 6);
  });

  it("pause, direction change and duration change keep time continuous", () => {
    const e = smart();
    run(e, 0, 40);
    const before = e.currentTimeYearsAgo;
    e.pause();
    expect(e.currentTimeYearsAgo).toBe(before);
    e.setSmartDuration(600);
    expect(e.currentTimeYearsAgo).toBe(before);
    e.setDirection("backward");
    e.play(fake);
    run(e, fake, 10);
    expect(e.currentTimeYearsAgo).toBeGreaterThan(before);
    expect(pacing.toW(e.currentTimeYearsAgo)).toBeCloseTo(pacing.toW(before) - 10 / 600, 3);
  });

  it("seek keeps smart mode and continues from the new position", () => {
    const e = smart();
    e.seek(66_000_000);
    run(e, 0, 1);
    expect(pacing.toW(e.currentTimeYearsAgo)).toBeCloseTo(pacing.toW(66_000_000) + 1 / 180, 4);
  });

  it("rejects invalid smart durations and setRate in smart mode", () => {
    const e = smart();
    expect(e.setSmartDuration(0)).toBe(false);
    expect(e.setSmartDuration(Number.NaN)).toBe(false);
    expect(e.setRate(5)).toBe(false);
    expect(e.getSnapshot().smartSeconds).toBe(180);
  });
});
```

（`import` 语句放到文件顶部现有 import 之后。）

- [ ] **Step 2: 运行确认失败** — `npx vitest run src/timeline/TimeEngine.test.ts` → FAIL（`setPacing` 不存在）

- [ ] **Step 3: 实现**（`src/timeline/TimeEngine.ts`）

1. 顶部 `import type { Pacing } from "./pacing";`；`PlaybackMode` 改为 `"fine" | "deep" | "smart"`；`DEFAULT_RATES` 类型改为 `Record<"fine" | "deep", number>`；新增 `export const DEFAULT_SMART_SECONDS = 180;`
2. `TimeSnapshot` 增加字段（放在 `deepRate` 之后）：

```ts
  /** 智能模式全程目标秒数。 */
  smartSeconds: number;
```

注释 `rate` 改为：`/** 当前模式下生效的倍率（年/秒）；智能模式下为当前位置的瞬时倍率。 */`

3. 私有字段：

```ts
  private smartSeconds = DEFAULT_SMART_SECONDS;
  private pacing: Pacing | null = null;
```

构造函数中 `this.mode = options.mode ?? "fine";` 改为 `this.mode = options.mode === "smart" ? "fine" : (options.mode ?? "fine");`（构造时还没有 pacing）。

4. 位置计算统一到 `positionAt`，替换 `currentTimeYearsAgo` getter、`rate` getter 与 `unclampedPosition`：

```ts
  get currentTimeYearsAgo(): number {
    if (!this.playing || this.elapsedSec === 0) return this.anchorYearsAgo;
    return this.clamp(this.unclampedPosition());
  }

  get rate(): number {
    if (this.mode === "smart" && this.pacing) return this.pacing.rateAt(this.currentTimeYearsAgo, this.smartSeconds);
    return this.mode === "fine" ? this.fineRate : this.deepRate;
  }
```

```ts
  private unclampedPosition(): number {
    const sign = this.direction === "forward" ? -1 : 1;
    if (this.mode === "smart" && this.pacing) {
      // w 增大 = 走向现代；fromW 在两端夹取，正好落在边界上
      const w = this.pacing.toW(this.anchorYearsAgo) - (sign * this.elapsedSec) / this.smartSeconds;
      return this.pacing.fromW(w);
    }
    return this.anchorYearsAgo + this.rate * this.elapsedSec * sign;
  }
```

5. `getSnapshot` 缓存比较加 `c.smartSeconds === this.smartSeconds &&`；新快照加 `smartSeconds: this.smartSeconds,`。
6. `setMode` 改为返回 boolean：

```ts
  /** 切换模式：不改变当前时间、播放状态与方向（各模式记住自己的倍率）。智能模式需先注入 pacing。 */
  setMode(mode: PlaybackMode): boolean {
    if (mode === this.mode) return true;
    if (mode === "smart" && !this.pacing) return false;
    this.sync();
    this.reanchor();
    this.mode = mode;
    this.emit();
    return true;
  }
```

7. `setRate` 开头加：`if (mode === "smart") return false;`（参数类型不变，默认值仍为 `this.mode`）。
8. 新增方法（放在 `setTargetDuration` 之后）：

```ts
  /** 注入智能倍速的时间扭曲（runtime 用数据构建）。 */
  setPacing(pacing: Pacing): void {
    this.sync();
    this.reanchor();
    this.pacing = pacing;
    this.emit();
  }

  /** 智能模式：全程目标秒数。非法值返回 false。 */
  setSmartDuration(seconds: number): boolean {
    if (!Number.isFinite(seconds) || seconds < MIN_TARGET_SECONDS || seconds > MAX_TARGET_SECONDS) return false;
    if (this.mode === "smart") {
      this.sync();
      this.reanchor();
    }
    this.smartSeconds = seconds;
    this.emit();
    return true;
  }
```

- [ ] **Step 4: 运行** — `npx vitest run src/timeline` → PASS；`npm run typecheck` 会在 timeStore / speeds 报错，下一任务修复。

---

### Task 4: 预设、store 与 runtime

**Files:** Modify `src/timeline/speeds.ts`, `src/state/timeStore.ts`, `src/timeline/runtime.ts`, `src/components/Timeline/PlaybackBar.test.tsx`

- [ ] **Step 1: 改 PlaybackBar 测试**（`speed presets switch mode and rate without moving time` 用例末尾、`fireEvent.change(select, { target: { value: "4" } })` 之前插入）：

```ts
    fireEvent.change(select, { target: { value: "smart-180" } });
    expect(timeEngine.getSnapshot()).toMatchObject({ mode: "smart", smartSeconds: 180, currentTimeYearsAgo: 1000 });
    expect(select).toHaveValue("smart-180");
    fireEvent.change(select, { target: { value: "smart-600" } });
    expect(select).toHaveValue("smart-600");
```

并新增 speeds 单元测试 `src/timeline/speeds.test.ts`：

```ts
import { DEFAULT_SPEED_ID, SPEED_PRESETS, matchSpeedPreset } from "./speeds";

describe("speed presets", () => {
  const base = { maxYearsAgo: 4_540_000_000, minYearsAgo: 0, smartSeconds: 180 };
  it("defaults to smart ~3 min", () => {
    expect(DEFAULT_SPEED_ID).toBe("smart-180");
    expect(SPEED_PRESETS.find((p) => p.id === DEFAULT_SPEED_ID)).toMatchObject({ mode: "smart", smartSeconds: 180 });
  });
  it("matches smart presets by duration regardless of instantaneous rate", () => {
    expect(matchSpeedPreset({ ...base, mode: "smart", rate: 123.4 })?.id).toBe("smart-180");
    expect(matchSpeedPreset({ ...base, mode: "smart", rate: 1, smartSeconds: 600 })?.id).toBe("smart-600");
    expect(matchSpeedPreset({ ...base, mode: "smart", rate: 1, smartSeconds: 77 })).toBeNull();
  });
  it("still matches fixed presets", () => {
    expect(matchSpeedPreset({ ...base, mode: "deep", rate: 1_000_000 })?.id).toBe("1m");
  });
});
```

- [ ] **Step 2: 运行确认失败** — `npx vitest run src/timeline/speeds.test.ts src/components/Timeline` → FAIL

- [ ] **Step 3: 实现 speeds.ts**

```ts
export interface SpeedPreset {
  id: string;
  label: string;
  mode: PlaybackMode;
  /** 年/秒；与 targetSeconds / smartSeconds 三选一。 */
  rate?: number;
  targetSeconds?: number;
  /** 智能模式全程秒数。 */
  smartSeconds?: number;
}

export const SPEED_PRESETS: SpeedPreset[] = [
  { id: "smart-180", label: "智能 · 约 3 分钟", mode: "smart", smartSeconds: 180 },
  { id: "smart-600", label: "智能 · 约 10 分钟", mode: "smart", smartSeconds: 600 },
  { id: "1", label: "1 年/秒", mode: "fine", rate: 1 },
  // …其余既有预设不变…
];

export const DEFAULT_SPEED_ID = "smart-180";

/** 当前快照对应的预设；自定义倍率返回 null。智能模式按全程秒数匹配（rate 为瞬时值）。 */
export function matchSpeedPreset(s: Pick<TimeSnapshot, "mode" | "rate" | "maxYearsAgo" | "minYearsAgo" | "smartSeconds">): SpeedPreset | null {
  if (s.mode === "smart") return SPEED_PRESETS.find((p) => p.mode === "smart" && p.smartSeconds === s.smartSeconds) ?? null;
  const span = s.maxYearsAgo - s.minYearsAgo;
  return SPEED_PRESETS.find((p) => p.mode === s.mode && p.mode !== "smart" && Math.abs(presetRate(p, span) - s.rate) <= s.rate * 1e-9) ?? null;
}

export function applySpeedPreset(
  engine: {
    setMode(m: PlaybackMode): boolean;
    setRate(r: number, m?: PlaybackMode): boolean;
    setTargetDuration(s: number): number | null;
    setSmartDuration(s: number): boolean;
  },
  p: SpeedPreset,
): void {
  if (p.mode === "smart") {
    if (engine.setSmartDuration(p.smartSeconds!)) engine.setMode("smart");
    return;
  }
  engine.setMode(p.mode);
  if (p.targetSeconds !== undefined) engine.setTargetDuration(p.targetSeconds);
  else engine.setRate(p.rate!, p.mode);
}
```

`modeForRate` 返回类型保持 `"fine" | "deep"`。

- [ ] **Step 4: timeStore 初始状态** 加 `smartSeconds: 180,`（`deepRate` 之后）。

- [ ] **Step 5: runtime.ts** 在 `new TimeEngine()` 之后、应用默认预设之前：

```ts
import { collectPacingAnchors } from "../simulation/pacingAnchors";
import { buildPacing } from "./pacing";
import { TimeScale } from "./TimeScale";
import { EARTH_FORMATION_YEARS_AGO, TimeEngine } from "./TimeEngine";

export const timeEngine = new TimeEngine();
// 智能倍速：按事件 / 物种 / 纪 / 切片的密度放慢（节奏与时间轴的分段压缩刻度一致）
timeEngine.setPacing(buildPacing(new TimeScale("segmented", EARTH_FORMATION_YEARS_AGO, 0), collectPacingAnchors()));
// 默认"智能 · 约 3 分钟"：前期空白加速、内容密集处放慢
applySpeedPreset(timeEngine, SPEED_PRESETS.find((p) => p.id === DEFAULT_SPEED_ID)!);
```

- [ ] **Step 6: 运行** — `npx vitest run` 全部 → PASS；`npm run typecheck` → 无错误。PlaybackBar 测试的 beforeEach 若重置到 "1" 预设则不受默认档影响；若有用例依赖 runtime 默认 mode，按新默认（smart）修正断言。

---

### Task 5: 界面——避免每帧重渲染、显示瞬时倍率

**Files:** Modify `src/components/Timeline/PlaybackBar.tsx`, `src/components/SettingsPanel/PlaybackSettings.tsx`, `src/components/SettingsPanel/PlaybackSettings.test.tsx`

- [ ] **Step 1: PlaybackSettings 测试追加**

```ts
  it("shows the smart mode with an approximate instantaneous rate", () => {
    render(<PlaybackSettings />);
    act(() => {
      applySpeedPreset(timeEngine, SPEED_PRESETS.find((p) => p.id === "smart-180")!);
    });
    const el = screen.getByTestId("current-rate");
    expect(el).toHaveAttribute("data-mode", "smart");
    expect(el.textContent).toMatch(/^≈ .+\/秒 · 智能模式$/);
  });
```

（需在测试文件顶部 import `applySpeedPreset, SPEED_PRESETS` from `../../timeline/speeds`。）

- [ ] **Step 2: 运行确认失败**

- [ ] **Step 3: PlaybackSettings** 把"当前倍率"抽成组件，订阅量化后的倍率（两位有效数字），智能模式下只在显示值变化时重渲染：

```tsx
const MODE_LABEL = { fine: "精细模式", deep: "深时模式", smart: "智能模式" } as const;

/** 两位有效数字：智能模式的瞬时倍率每帧都在变，只在显示值变化时重渲染。 */
const roundRate = (r: number) => {
  const p = 10 ** (Math.floor(Math.log10(r)) - 1);
  return Math.round(r / p) * p;
};

function CurrentRate() {
  const mode = useTimeStore((st) => st.mode);
  const rate = useTimeStore((st) => (st.mode === "smart" ? roundRate(st.rate) : st.rate));
  return (
    <span data-testid="current-rate" data-mode={mode}>
      {mode === "smart" ? "≈ " : ""}
      {formatYearsSpan(rate)}/秒 · {MODE_LABEL[mode]}
    </span>
  );
}
```

`PlaybackSettings` 的 `useShallow` 选择器删掉 `mode`、`rate`（若别处不再使用），"当前倍率"字段内替换为 `<CurrentRate />`。

- [ ] **Step 4: PlaybackBar** 选择器中 `rate: st.rate` 改为 `rate: st.mode === "smart" ? 0 : st.rate`，并加入 `smartSeconds: st.smartSeconds`（智能模式下倍率每帧变化，但预设匹配只看全程秒数）。

- [ ] **Step 5: 运行** — `npx vitest run src/components` → PASS；`npm run lint` → 无错误。

---

### Task 6: 调参与 e2e

- [ ] **Step 1: 打印分段耗时表**（临时脚本，不保留）`/tmp/pacing-profile.test.ts` 放在 `src/timeline/pacing.profile.tmp.test.ts`：

```ts
import { collectPacingAnchors } from "../simulation/pacingAnchors";
import { buildPacing } from "./pacing";
import { TimeScale } from "./TimeScale";

it("profile", () => {
  const p = buildPacing(new TimeScale("segmented", 4_540_000_000, 0), collectPacingAnchors());
  const marks = [4.54e9, 538.8e6, 252e6, 66e6, 2.58e6, 11_700, 5_400, 240, 0];
  for (let i = 1; i < marks.length; i++) {
    const s = (p.toW(marks[i]!) - p.toW(marks[i - 1]!)) * 180;
    console.log(`${marks[i - 1]} → ${marks[i]}: ${s.toFixed(1)} s`);
  }
});
```

Run: `npx vitest run src/timeline/pacing.profile.tmp.test.ts`。目标（180 s）：前寒武纪 ≤ 45 s；显生宙至新生代 ≥ 35 s；全新世 ≥ 30 s，其中近 240 年 ≥ 5 s。不达标时调 `PACING_OPTIONS.sigma`（0.08–0.2）与 `PACING_WEIGHTS`，结果记入 TASKS；然后删除该文件。

- [ ] **Step 2: e2e** 检查 `e2e/*.spec.ts` 中依赖默认倍速 / "全史 60 秒"的断言（`grep -n "all-60\|全史\|mode" e2e/*.ts`），改为显式选择所需预设或按新默认断言。后台运行：
`arch -arm64 node node_modules/.bin/playwright test e2e/time.spec.ts e2e/timeline.spec.ts` → PASS。

- [ ] **Step 3: 截图核查**（dev server，播放中观察 Holocene 段确实放慢、前寒武纪快速通过；设置面板显示"≈ … · 智能模式"）。

- [ ] **Step 4: 全量验证** — `npm run typecheck && npm run lint && npm test` → 全部通过。

- [ ] **Step 5: 文档** — TASKS.md 记录完成内容、调参结果、测试结果；HANDOFF.md §1/§5/§6 更新（默认倍速、智能模式说明、细节打磨系列 5 个子项目与进度）。README 底部操作说明的"倍速"补"智能"。

- [ ] **Step 6: 询问用户是否提交。**
