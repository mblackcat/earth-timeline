/**
 * 观察窗中的小块示意地形：确定性的平滑高度场 + 等高线（PLAN §6.1）。
 * 不代表任何真实地点的地形。
 */

export type HeightFn = (x: number, z: number) => number;

/** 若干正弦叠加的平滑起伏；amp 为最大起伏，wavelength 为主波长（同一单位）。 */
export function makeHeightField(amp: number, wavelength: number, seed = 1): HeightFn {
  const k = (2 * Math.PI) / wavelength;
  const s = seed * 1.618;
  return (x, z) =>
    amp *
    (0.5 * Math.sin(k * x + s) * Math.cos(k * 0.8 * z - s) +
      0.3 * Math.sin(k * 1.9 * (x + z) + 2 * s) +
      0.2 * Math.cos(k * 3.1 * x - k * 2.3 * z + s));
}

/**
 * 在 [-half, half]² 的 n×n 网格上用 marching squares 提取等高线，
 * 返回 LineSegments 可直接使用的顶点数组（每段两个端点，y 取等高值 + lift）。
 */
export function contourSegments(h: HeightFn, half: number, n: number, levels: number[], lift = 0): Float32Array {
  const step = (2 * half) / n;
  const grid: number[] = [];
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) grid.push(h(-half + i * step, -half + j * step));
  const at = (i: number, j: number) => grid[j * (n + 1) + i]!;
  const out: number[] = [];
  for (const L of levels) {
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const c = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
        const p: [number, number][] = [
          [i, j],
          [i + 1, j],
          [i + 1, j + 1],
          [i, j + 1],
        ];
        const pts: [number, number][] = [];
        for (let e = 0; e < 4; e++) {
          const a = c[e]!;
          const b = c[(e + 1) % 4]!;
          if (a < L !== b < L) {
            const t = (L - a) / (b - a);
            const pa = p[e]!;
            const pb = p[(e + 1) % 4]!;
            pts.push([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t]);
          }
        }
        for (let k = 0; k + 1 < pts.length; k += 2) {
          for (const [gi, gj] of [pts[k]!, pts[k + 1]!]) out.push(-half + gi * step, L + lift, -half + gj * step);
        }
      }
    }
  }
  return new Float32Array(out);
}
