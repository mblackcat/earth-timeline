import type { LonLat } from "../data/schema";

/** 高度（地球半径）低于该值时在地球上显示生物模型：L1 上沿。 */
export const CREATURE_MAX_ALTITUDE = 1.2;

function angularDistanceDeg(a: LonLat, b: LonLat): number {
  const D = Math.PI / 180;
  const c = Math.sin(a[1] * D) * Math.sin(b[1] * D) + Math.cos(a[1] * D) * Math.cos(b[1] * D) * Math.cos((a[0] - b[0]) * D);
  return Math.acos(Math.min(1, Math.max(-1, c))) / D;
}

/** 选出要显示模型的化石点：按与视野中心的角距离排序，取前 max 个（纯函数，便于测试）。 */
export function pickCreatureSites(
  entries: { speciesId: string; sites: LonLat[] }[],
  center: LonLat,
  altitude: number,
  max: number,
): { speciesId: string; lonLat: LonLat }[] {
  if (altitude >= CREATURE_MAX_ALTITUDE) return [];
  const limit = Math.min(70, 25 + altitude * 40);
  const all: { speciesId: string; lonLat: LonLat; d: number }[] = [];
  for (const e of entries) for (const s of e.sites) {
    const d = angularDistanceDeg(center, s);
    if (d <= limit) all.push({ speciesId: e.speciesId, lonLat: s, d });
  }
  all.sort((a, b) => a.d - b.d);
  // 模型之间保持最小角距离（约 2 个模型的屏幕高度），避免化石点密集处叠成一团
  const minSep = Math.max(0.5, altitude * 6);
  const farEnough = (c: (typeof all)[number], picked: typeof all) => picked.every((o) => angularDistanceDeg(o.lonLat, c.lonLat) >= minSep);
  // 每个物种至少一个、再按距离补足，避免一个化石点密集的物种占满名额
  const out: typeof all = [];
  const seen = new Set<string>();
  for (const c of all) {
    if (!seen.has(c.speciesId) && out.length < max && farEnough(c, out)) {
      seen.add(c.speciesId);
      out.push(c);
    }
  }
  for (const c of all) if (out.length < max && !out.includes(c) && farEnough(c, out)) out.push(c);
  return out.map(({ speciesId, lonLat }) => ({ speciesId, lonLat }));
}
