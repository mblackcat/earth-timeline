import type { TimeScale } from "./TimeScale";

/**
 * 智能倍速的时间扭曲（设计：docs/superpowers/specs/2026-10-19-smart-pacing-design.md）。
 *
 * 在时间轴位置 u（TimeScale，0 = 最古老，1 = 现代）上定义注意力密度 ρ(u) ≥ 1，
 * 积分归一化得扭曲坐标 W(u) ∈ [0, 1]。智能模式在 W 上匀速播放，ρ 大的地方放慢。
 *
 * ρ = 基础节奏 × 内容峰值：
 * - 基础节奏混合"时间轴匀速"与"对数时间匀速"（每个数量级耗时相同）。只用时间轴时，
 *   前寒武纪占约 1/5、近 240 年不到 1 秒；混入对数时间后前期加快、近现代有时间看清。
 * - 内容峰值：事件、物种出现 / 灭绝等锚点附近放慢，最多 maxSlowdown 倍。
 * 纯 TypeScript，不依赖数据。
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
  /** 局部最多放慢的倍数（相对基础节奏）。 */
  maxSlowdown: number;
  /** 基础节奏中对数时间的占比（0 = 时间轴匀速，1 = 对数时间匀速）。 */
  logBlend: number;
}

export const PACING_OPTIONS: PacingOptions = { samples: 8192, sigma: 0.12, offsetYears: 100, maxSlowdown: 6, logBlend: 0.65 };

export interface Pacing {
  /** yearsAgo → w ∈ [0, 1]（0 = 最古老）。 */
  toW(yearsAgo: number): number;
  /** w → yearsAgo；w 超出 [0, 1] 时夹取到两端。 */
  fromW(w: number): number;
  /** 在 seconds 秒播完全程时，yearsAgo 处的瞬时倍率（年/秒）。 */
  rateAt(yearsAgo: number, seconds: number): number;
  /** yearsAgo 处的内容放慢倍数（1 = 无内容，≤ maxSlowdown）。 */
  densityAt(yearsAgo: number): number;
}

export function buildPacing(scale: TimeScale, anchors: PacingAnchor[], opts: PacingOptions = PACING_OPTIONS): Pacing {
  const { samples: n, sigma, offsetYears: c, maxSlowdown: S, logBlend } = opts;
  const peaks = anchors.filter((a) => Number.isFinite(a.yearsAgo) && a.weight > 0).map((a) => ({ l: Math.log(Math.max(0, a.yearsAgo) + c), w: a.weight }));

  const contentAt = (yearsAgo: number) => {
    const l = Math.log(Math.max(0, yearsAgo) + c);
    let s = 0;
    for (const p of peaks) {
      const z = (l - p.l) / sigma;
      if (z > -5 && z < 5) s += p.w * Math.exp(-0.5 * z * z);
    }
    return 1 + (S - 1) * Math.tanh(s);
  };
  // 对数时间在 u 上的密度 |d ln(t + c) / du|，按全程平均值归一化（平均为 1）
  const logMean = Math.log(scale.maxYearsAgo + c) - Math.log(scale.minYearsAgo + c);
  const baseAt = (yearsAgo: number) => {
    const t = Math.max(0, yearsAgo);
    const logDensity = scale.yearsPerU(scale.toU(t)) / (t + c) / logMean;
    return 1 - logBlend + logBlend * logDensity;
  };
  const densityAt = (yearsAgo: number) => baseAt(yearsAgo) * contentAt(yearsAgo);

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

  return { toW, fromW, rateAt, densityAt: contentAt };
}
