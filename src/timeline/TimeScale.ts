/**
 * 时间轴映射：真实年代（yearsAgo）↔ 归一化位置 u ∈ [0, 1] ↔ 像素（TASKS 风险 R3）。
 *
 * u = 0 在最左（最古老），u = 1 在最右（现代）。
 * - "segmented"：分段线性压缩。每段内部是线性的，段与段之间压缩比例不同，
 *   使 45 亿年的深时与几千年的文明史都能在同一条轴上操作。
 * - "linear"：整条轴线性（用于直观感受真实时间比例）。
 * 刻度始终标注真实年代，段边界额外标出，提示视觉长度不等于真实时间间隔（PLAN §4.3）。
 * 纯 TypeScript，不依赖 React。
 */

import { yearsAgoToAstronomicalYear } from "./CalendarAdapter";

export type ScaleKind = "segmented" | "linear";

interface Breakpoint {
  yearsAgo: number;
  u: number;
}

export interface ScaleSegment {
  fromYearsAgo: number;
  toYearsAgo: number;
  u0: number;
  u1: number;
}

/** 分段断点：前寒武纪 | 古生代+中生代早期 | 至新生代 | 新生代 | 第四纪 | 全新世。 */
const SEGMENTED_BREAKS: Breakpoint[] = [
  { yearsAgo: 538_800_000, u: 0.2 }, // 显生宙开始
  { yearsAgo: 66_000_000, u: 0.42 }, // 新生代开始
  { yearsAgo: 2_580_000, u: 0.58 }, // 第四纪开始
  { yearsAgo: 11_700, u: 0.76 }, // 全新世开始
];

export class TimeScale {
  readonly segments: ScaleSegment[];

  constructor(
    readonly kind: ScaleKind,
    readonly maxYearsAgo: number,
    readonly minYearsAgo = 0,
  ) {
    const inner = kind === "segmented" ? SEGMENTED_BREAKS.filter((b) => b.yearsAgo < maxYearsAgo && b.yearsAgo > minYearsAgo) : [];
    const pts: Breakpoint[] = [{ yearsAgo: maxYearsAgo, u: 0 }, ...inner, { yearsAgo: minYearsAgo, u: 1 }];
    this.segments = pts.slice(1).map((p, i) => ({
      fromYearsAgo: pts[i]!.yearsAgo,
      toYearsAgo: p.yearsAgo,
      u0: pts[i]!.u,
      u1: p.u,
    }));
  }

  /** 内部断点（不含两端），用于绘制分段分隔线。 */
  get breakpoints(): number[] {
    return this.segments.slice(1).map((s) => s.fromYearsAgo);
  }

  toU(yearsAgo: number): number {
    const t = Math.min(this.maxYearsAgo, Math.max(this.minYearsAgo, yearsAgo));
    const seg = this.segments.find((s) => t <= s.fromYearsAgo && t >= s.toYearsAgo) ?? this.segments.at(-1)!;
    const f = (seg.fromYearsAgo - t) / (seg.fromYearsAgo - seg.toYearsAgo);
    return seg.u0 + f * (seg.u1 - seg.u0);
  }

  fromU(u: number): number {
    const v = Math.min(1, Math.max(0, u));
    const seg = this.segments.find((s) => v >= s.u0 && v <= s.u1) ?? this.segments.at(-1)!;
    const f = (v - seg.u0) / (seg.u1 - seg.u0);
    return seg.fromYearsAgo - f * (seg.fromYearsAgo - seg.toYearsAgo);
  }

  /** u 处每单位 u 对应的年数（局部密度）。 */
  yearsPerU(u: number): number {
    const v = Math.min(1, Math.max(0, u));
    const seg = this.segments.find((s) => v >= s.u0 && v <= s.u1) ?? this.segments.at(-1)!;
    return (seg.fromYearsAgo - seg.toYearsAgo) / (seg.u1 - seg.u0);
  }
}

// ───────────── 视窗（缩放 / 平移） ─────────────

/** 可见窗口 [u0, u1]，0 ≤ u0 < u1 ≤ 1。 */
export interface ViewWindow {
  u0: number;
  u1: number;
}

export const FULL_VIEW: ViewWindow = { u0: 0, u1: 1 };
/** 最大放大：窗口内至少显示这么多年。 */
export const MIN_VISIBLE_YEARS = 20;

function clampWindow(u0: number, span: number): ViewWindow {
  const s = Math.min(1, span);
  const start = Math.min(1 - s, Math.max(0, u0));
  return { u0: start, u1: start + s };
}

/** 以 anchorU 为不动点缩放；factor > 1 放大。 */
export function zoomView(scale: TimeScale, view: ViewWindow, factor: number, anchorU: number): ViewWindow {
  if (!Number.isFinite(factor) || factor <= 0) return view;
  const span = view.u1 - view.u0;
  const minSpan = Math.min(1, MIN_VISIBLE_YEARS / scale.yearsPerU(anchorU));
  const next = Math.min(1, Math.max(minSpan, span / factor));
  const ratio = (anchorU - view.u0) / span;
  return clampWindow(anchorU - ratio * next, next);
}

export function panView(view: ViewWindow, du: number): ViewWindow {
  return clampWindow(view.u0 + du, view.u1 - view.u0);
}

/** 让窗口刚好容纳 [olderYearsAgo, youngerYearsAgo]，两侧留 pad 比例的边距。 */
export function fitView(scale: TimeScale, olderYearsAgo: number, youngerYearsAgo: number, pad = 0.04): ViewWindow {
  const a = scale.toU(olderYearsAgo);
  const b = scale.toU(youngerYearsAgo);
  const minSpan = Math.min(1, MIN_VISIBLE_YEARS / scale.yearsPerU((a + b) / 2));
  const span = Math.max(minSpan, (b - a) * (1 + 2 * pad));
  return clampWindow((a + b) / 2 - span / 2, span);
}

/** 若 u 不在窗口内（含 margin 比例），平移窗口使其回到视野中。 */
export function ensureVisible(view: ViewWindow, u: number, margin = 0.05): ViewWindow {
  const span = view.u1 - view.u0;
  const lo = view.u0 + span * margin;
  const hi = view.u1 - span * margin;
  if (u >= lo && u <= hi) return view;
  return clampWindow(u < lo ? u - span * margin : u - span * (1 - margin), span);
}

export function uToX(view: ViewWindow, width: number, u: number): number {
  return ((u - view.u0) / (view.u1 - view.u0)) * width;
}

export function xToU(view: ViewWindow, width: number, x: number): number {
  return view.u0 + (x / width) * (view.u1 - view.u0);
}

// ───────────── 刻度 ─────────────

/** 距今 1 万年以内用公元纪年刻度，更早用 ka / Ma / Ga。 */
export const CALENDAR_TICK_LIMIT = 10_000;

export interface Tick {
  yearsAgo: number;
  x: number;
  label: string;
  /** 分段边界刻度（提示比例变化）。 */
  boundary: boolean;
}

function niceStep(raw: number): number {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function trim(n: number): string {
  return String(Number(n.toFixed(6)));
}

/** 刻度文本：公元纪年（无 0 年）或 ka / Ma / Ga。 */
export function formatTick(yearsAgo: number, step = 1): string {
  if (yearsAgo === 0) return "现代";
  if (yearsAgo < 0) return `+${trim(-yearsAgo)} 年`;
  if (yearsAgo <= CALENDAR_TICK_LIMIT) {
    const astro = Math.round(yearsAgoToAstronomicalYear(yearsAgo));
    return astro >= 1 ? `${astro}` : `前${1 - astro}`;
  }
  const unit = yearsAgo >= 1e9 && step >= 1e7 ? 1e9 : yearsAgo >= 1e6 && step >= 1e4 ? 1e6 : 1e3;
  const name = unit === 1e9 ? "Ga" : unit === 1e6 ? "Ma" : "ka";
  return `${trim(yearsAgo / unit)} ${name}`;
}

/** 公元刻度：在"历史年份"空间取整（…, 前200, 前100, 100, 200, …），跳过不存在的公元 0 年。 */
function calendarTicks(older: number, younger: number, step: number): number[] {
  const toHist = (ya: number) => {
    const astro = yearsAgoToAstronomicalYear(ya);
    return astro >= 1 ? astro : astro - 1;
  };
  const toYa = (h: number) => 2000 - (h > 0 ? h : h + 1);
  const out: number[] = [];
  const hOld = toHist(older);
  const hNew = toHist(younger);
  for (let h = Math.ceil(hOld / step) * step; h <= hNew; h += step) {
    if (h === 0) continue;
    out.push(toYa(h));
  }
  return out;
}

function deepTicks(older: number, younger: number, step: number): number[] {
  const out: number[] = [];
  const start = Math.ceil(younger / step) * step;
  for (let t = start; t <= older; t += step) out.push(t);
  return out;
}

/**
 * 生成当前窗口的刻度。每个可见分段独立选择步长（1-2-5 序列），
 * 保证相邻刻度间距 ≥ minSpacingPx；分段边界始终作为刻度给出。
 */
export function computeTicks(scale: TimeScale, view: ViewWindow, width: number, minSpacingPx = 90): Tick[] {
  if (width <= 0) return [];
  const pxPerU = width / (view.u1 - view.u0);
  const candidates: { yearsAgo: number; step: number; boundary: boolean }[] = [];

  for (const seg of scale.segments) {
    const a = Math.max(seg.u0, view.u0);
    const b = Math.min(seg.u1, view.u1);
    if (b <= a) continue;
    const older = scale.fromU(a);
    const younger = scale.fromU(b);
    const yearsPerPx = (seg.fromYearsAgo - seg.toYearsAgo) / ((seg.u1 - seg.u0) * pxPerU);
    const step = niceStep(Math.max(1, yearsPerPx * minSpacingPx));
    const cal = Math.min(older, CALENDAR_TICK_LIMIT);
    if (younger < CALENDAR_TICK_LIMIT) {
      for (const t of calendarTicks(cal, younger, step)) candidates.push({ yearsAgo: t, step, boundary: false });
    }
    if (older > CALENDAR_TICK_LIMIT) {
      for (const t of deepTicks(older, Math.max(younger, CALENDAR_TICK_LIMIT + 1), step)) {
        candidates.push({ yearsAgo: t, step, boundary: false });
      }
    }
  }
  // 两端与分段边界：按自身量级选单位（step = 自身），例如 "4.54 Ga" 而不是 "4540000 ka"
  for (const b of [scale.maxYearsAgo, ...scale.breakpoints, scale.minYearsAgo]) {
    const u = scale.toU(b);
    if (u >= view.u0 && u <= view.u1) candidates.push({ yearsAgo: b, step: b, boundary: scale.breakpoints.includes(b) });
  }

  // 去重：按位置排序，过近时保留边界刻度
  const ticks = candidates
    .map((c) => ({ ...c, x: uToX(view, width, scale.toU(c.yearsAgo)) }))
    .sort((p, q) => p.x - q.x || Number(q.boundary) - Number(p.boundary));
  const out: Tick[] = [];
  const minGap = minSpacingPx * 0.6;
  for (const t of ticks) {
    const prev = out.at(-1);
    if (prev && t.x - prev.x < minGap) {
      if (t.boundary && !prev.boundary) out.pop();
      else continue;
    }
    out.push({ yearsAgo: t.yearsAgo, x: t.x, label: formatTick(t.yearsAgo, t.step), boundary: t.boundary });
  }
  return out;
}
