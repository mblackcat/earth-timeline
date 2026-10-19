import type { LonLat, PaleoGeographySlice } from "../data/schema";

/**
 * 板块漂移插值（设计：docs/superpowers/specs/2026-10-19-plate-drift-design.md）。
 *
 * 切片 tᵢ 覆盖 (tᵢ₋₁, tᵢ]：轮廓、化石点与事件从 tᵢ 的位置沿大圆插值到 tᵢ₋₁ 的位置。
 * 纯函数；数据脚本也复用这里的球面工具（null 顶点补位）。
 */

/** 位置参考系：现代坐标，或某个重建切片内的插值（f = 0 在 ma，f = 1 在 nextMa）。 */
export type Frame = { kind: "modern" } | { kind: "paleo"; ma: number; nextMa: number; f: number };

const D = Math.PI / 180;

type V3 = [number, number, number];

function toV(p: LonLat): V3 {
  const c = Math.cos(p[1] * D);
  return [c * Math.cos(p[0] * D), c * Math.sin(p[0] * D), Math.sin(p[1] * D)];
}

function toLonLat(v: V3): LonLat {
  const r = Math.hypot(v[0], v[1], v[2]);
  return [Math.atan2(v[1], v[0]) / D, Math.asin(Math.max(-1, Math.min(1, v[2] / r))) / D];
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** 切片内的形变比例：在 tᵢ 为 0，在 tᵢ₋₁ 为 1，之间线性，两侧夹取。 */
export function morphFraction(slice: PaleoGeographySlice, yearsAgo: number): number {
  const from = slice.reconstructionMa;
  const to = slice.nextReconstructionMa;
  if (from === undefined || to === undefined || from === to) return 0;
  const f = (from - yearsAgo / 1e6) / (from - to);
  return Math.min(1, Math.max(0, f));
}

/** 当前时刻的位置参考系。 */
export function paleoFrame(slice: PaleoGeographySlice | null, yearsAgo: number): Frame {
  if (!slice || slice.reconstructionMa === undefined) return { kind: "modern" };
  return { kind: "paleo", ma: slice.reconstructionMa, nextMa: slice.nextReconstructionMa ?? slice.reconstructionMa, f: morphFraction(slice, yearsAgo) };
}

/** 大圆插值（球面线性插值），走短弧。 */
export function slerpLonLat(a: LonLat, b: LonLat, f: number): LonLat {
  if (f <= 0) return a;
  if (f >= 1) return b;
  const va = toV(a);
  const vb = toV(b);
  const cos = Math.max(-1, Math.min(1, dot(va, vb)));
  const omega = Math.acos(cos);
  if (omega < 1e-9) return a;
  const s = Math.sin(omega);
  const ka = Math.sin((1 - f) * omega) / s;
  const kb = Math.sin(f * omega) / s;
  return toLonLat([ka * va[0] + kb * vb[0], ka * va[1] + kb * vb[1], ka * va[2] + kb * vb[2]]);
}

/** 把 p 按"from → to 的最小旋转"旋转（Rodrigues），用于借用相邻顶点的位移。 */
export function rotateLike(from: LonLat, to: LonLat, p: LonLat): LonLat {
  const a = toV(from);
  const b = toV(to);
  const axis = cross(a, b);
  const sin = Math.hypot(axis[0], axis[1], axis[2]);
  if (sin < 1e-12) return p;
  const k: V3 = [axis[0] / sin, axis[1] / sin, axis[2] / sin];
  const cos = dot(a, b);
  const v = toV(p);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - cos);
  return toLonLat([
    v[0] * cos + kv[0] * sin + k[0] * kd,
    v[1] * cos + kv[1] * sin + k[1] * kd,
    v[2] * cos + kv[2] * sin + k[2] * kd,
  ]);
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** 邻域窗口（环上每侧的顶点数）与容差：偏离邻居位移中位数超过 max(3°, 中位数位移的一半) 视为错配。 */
const NEIGHBOUR_WINDOW = 4;
const MIN_DEVIATION = 3 * D;

/**
 * 去掉位移与环上邻居明显不一致的目标点。反算时板块 / 地体边界附近的顶点偶尔被分到别的板块，
 * 会在 20 Ma 内"跳"几十度；同一环上的相邻顶点通常属于同一板块、位移相近。被去掉的点记为 null，
 * 之后由 fillMissingTargets 借用邻居的位移。
 */
export function rejectInconsistentTargets(ring: LonLat[], next: (LonLat | null)[]): (LonLat | null)[] {
  const n = ring.length;
  const disp: (V3 | null)[] = ring.map((p, i) => {
    const t = next[i];
    if (!t) return null;
    const a = toV(p);
    const b = toV(t);
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  });
  return next.map((t, i) => {
    const d = disp[i];
    if (!t || !d) return null;
    const near: V3[] = [];
    for (let k = 1; k <= NEIGHBOUR_WINDOW; k++) {
      for (const j of [(i + k) % n, (i - k + n) % n]) {
        const o = disp[j];
        if (o && j !== i) near.push(o);
      }
    }
    if (near.length < 2) return t;
    const m: V3 = [median(near.map((v) => v[0])), median(near.map((v) => v[1])), median(near.map((v) => v[2]))];
    const dev = Math.hypot(d[0] - m[0], d[1] - m[1], d[2] - m[2]);
    return dev > Math.max(MIN_DEVIATION, 0.5 * Math.hypot(m[0], m[1], m[2])) ? null : t;
  });
}

const angleDeg = (a: LonLat, b: LonLat) => Math.acos(Math.max(-1, Math.min(1, dot(toV(a), toV(b))))) / D;

/** 形变后边长比原来多出该值（度）视为撕裂：20 Ma 内相邻板块的相对运动远小于此。 */
const MAX_EDGE_STRETCH_DEG = 8;

/**
 * 去掉整段一起错配的顶点：一段连续顶点被分到同一个错误板块时，邻居一致性检查发现不了，
 * 但这段的两端会把边"撕"得很长。在撕裂处把环切成若干段，只保留最长的一段，其余记为 null，
 * 之后由 fillMissingTargets 借用保留段的位移。
 */
export function rejectStretchedRuns(ring: LonLat[], next: LonLat[]): (LonLat | null)[] {
  const n = ring.length;
  const torn: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    if (angleDeg(next[i]!, next[i + 1]!) > angleDeg(ring[i]!, ring[i + 1]!) + MAX_EDGE_STRETCH_DEG) torn.push(i);
  }
  if (!torn.length) return next;
  // 段 = 相邻两个撕裂边之间的顶点（环首尾相接）
  const runs: number[][] = [];
  for (let k = 0; k < torn.length; k++) {
    const start = torn[k]! + 1;
    const end = k + 1 < torn.length ? torn[k + 1]! : torn[0]! + n - 1;
    const run: number[] = [];
    for (let i = start; i <= end; i++) run.push(i % (n - 1));
    runs.push(run);
  }
  const keep = new Set(runs.reduce((a, b) => (b.length > a.length ? b : a)));
  return next.map((p, i) => (keep.has(i % (n - 1)) ? p : null));
}

/** 环上无法重建的顶点：借用环上（按下标）最近的有效顶点的位移；全无效时保持原位。 */
export function fillMissingTargets(ring: LonLat[], next: (LonLat | null)[]): LonLat[] {
  const n = ring.length;
  const valid = next.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  if (!valid.length) return ring.map((p) => [p[0], p[1]]);
  return ring.map((p, i) => {
    const own = next[i];
    if (own) return own;
    let best = valid[0]!;
    let bestD = Infinity;
    for (const j of valid) {
      const d = Math.min(Math.abs(i - j), n - Math.abs(i - j));
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return rotateLike(ring[best]!, next[best]!, p);
  });
}

/** 按比例 f 形变轮廓（outlines 与 next 逐环逐点对应）。 */
export function morphOutlines(outlines: LonLat[][], next: LonLat[][], f: number): LonLat[][] {
  if (f <= 0) return outlines;
  return outlines.map((ring, r) => ring.map((p, i) => slerpLonLat(p, next[r]![i]!, f)));
}
