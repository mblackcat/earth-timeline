import type { LonLat } from "../data/schema";
import { rasterizePolygons, type LandGrid } from "../utils/dissolve";
import { unwrapRing } from "../utils/geo";

export type { LandGrid };

/**
 * 当前切片轮廓 → 粗陆地网格（CPU 侧的海陆判定，散布时用）。
 * 与 drawLandMask 同样的规则：经度展开后在 0、±360° 各放一份；极地环补到极点闭合。
 * 每个环当作独立多边形（并集），湖泊等内环会被填成陆地——对散布无影响。
 */
export function landGridFromOutlines(outlines: LonLat[][], resDeg = 1): LandGrid {
  const polys: LonLat[][][] = [];
  for (const raw of outlines) {
    const ring = unwrapRing(raw);
    if (ring.length < 3) continue;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    let closed = ring;
    if (Math.abs(last[0] - first[0]) >= 359) {
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const p of ring) {
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
      }
      const pole = Math.abs(minLat) >= Math.abs(maxLat) ? -90 : 90;
      closed = [...ring, [last[0], pole], [first[0], pole]];
    }
    for (const off of [0, -360, 360]) polys.push([closed.map(([lon, lat]) => [lon + off, lat] as LonLat)]);
  }
  return rasterizePolygons(polys, resDeg);
}

export function isLandAt(g: LandGrid, [lon, lat]: LonLat): boolean {
  const x = ((((lon + 180) % 360) + 360) % 360) / g.resDeg;
  const i = Math.min(g.width - 1, Math.floor(x));
  const j = Math.min(g.height - 1, Math.max(0, Math.floor((90 - lat) / g.resDeg)));
  return g.cells[j * g.width + i] === 1;
}
