import type { LonLat } from "../data/schema";

export const EARTH_RADIUS = 1;

const DEG = Math.PI / 180;

/**
 * 经纬度 → 场景坐标。Y 轴指向地理北极，经度 0° 指向 +Z，东经 90° 指向 +X。
 */
export function lonLatToXYZ(lon: number, lat: number, radius = EARTH_RADIUS): [number, number, number] {
  const phi = lat * DEG;
  const lambda = lon * DEG;
  const c = Math.cos(phi);
  return [radius * c * Math.sin(lambda), radius * Math.sin(phi), radius * c * Math.cos(lambda)];
}

export function xyzToLonLat(x: number, y: number, z: number): LonLat {
  const r = Math.hypot(x, y, z);
  return [Math.atan2(x, z) / DEG, Math.asin(y / r) / DEG];
}

/**
 * 把经纬度折线转换为 LineSegments 用的顶点数组（每段两个端点）。
 * 跨越 ±180° 的线段会被跳过，避免横穿球体的伪线。
 * 长线段按 maxStepDeg 细分，使其贴合球面。
 */
export function polylinesToSegments(lines: LonLat[][], radius: number, maxStepDeg = 2): Float32Array {
  const out: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i]!;
      const b = line[i + 1]!;
      if (Math.abs(a[0] - b[0]) > 180) continue;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])) / maxStepDeg));
      let prev = lonLatToXYZ(a[0], a[1], radius);
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const next = lonLatToXYZ(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, radius);
        out.push(...prev, ...next);
        prev = next;
      }
    }
  }
  return new Float32Array(out);
}

/** 经纬网折线：纬线与经线，单位度。 */
export function graticuleLines(stepDeg: number, resolutionDeg = 2): { lines: LonLat[][]; major: LonLat[][] } {
  const lines: LonLat[][] = [];
  const major: LonLat[][] = [];
  for (let lat = -90 + stepDeg; lat < 90; lat += stepDeg) {
    const ring: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += resolutionDeg) ring.push([lon, lat]);
    (lat === 0 ? major : lines).push(ring);
  }
  for (let lon = -180; lon < 180; lon += stepDeg) {
    const meridian: LonLat[] = [];
    for (let lat = -90; lat <= 90; lat += resolutionDeg) meridian.push([lon, lat]);
    (lon === 0 ? major : lines).push(meridian);
  }
  return { lines, major };
}

/** PLAN §3.3.2 的空间层级。以"相机到地表高度 / 地球半径"划分。 */
export type SpatialLevel = 0 | 1 | 2 | 3 | 4;

export const LEVEL_THRESHOLDS: readonly number[] = [1.2, 0.4, 0.08, 0.015];

export const LEVEL_LABELS: Record<SpatialLevel, string> = {
  0: "L0 全球",
  1: "L1 大陆与海洋",
  2: "L2 区域生态",
  3: "L3 局部场景",
  4: "L4 近距离",
};

export function altitudeToLevel(altitude: number): SpatialLevel {
  let level = 0;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (altitude < threshold) level++;
    else break;
  }
  return level as SpatialLevel;
}

/** 约 6371 km 地球半径，用于把场景单位高度展示为公里。 */
export const EARTH_RADIUS_KM = 6371;
