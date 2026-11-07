import type { LonLat } from "../../data/schema";
import { unwrapRing } from "../../utils/geo";

export { unwrapRing };

/**
 * 在等距圆柱 canvas 上填充陆地（白 = 陆地，黑 = 海洋）。每个环在 0、±360° 偏移各画一次，
 * 处理跨 ±180° 的环；展开后首尾经度相差 360° 的环（极地环）补到极点闭合。
 */
export function drawLandMask(ctx: CanvasRenderingContext2D, outlines: LonLat[][], width: number, height: number) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  const x = (lon: number) => ((lon + 180) / 360) * width;
  const y = (lat: number) => ((90 - lat) / 180) * height;
  for (const raw of outlines) {
    const ring = unwrapRing(raw);
    if (ring.length < 3) continue;
    const first = ring[0]!;
    const last = ring[ring.length - 1]!;
    const polar = Math.abs(last[0] - first[0]) >= 359;
    // 按极值纬度判断包围的是哪个极（首点可能在低纬度）
    let poleY = 0;
    if (polar) {
      let minLat = Infinity;
      let maxLat = -Infinity;
      for (const p of ring) {
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
      }
      poleY = y(Math.abs(minLat) >= Math.abs(maxLat) ? -90 : 90);
    }
    for (const off of [0, -360, 360]) {
      ctx.beginPath();
      ctx.moveTo(x(first[0] + off), y(first[1]));
      for (let i = 1; i < ring.length; i++) ctx.lineTo(x(ring[i]![0] + off), y(ring[i]![1]));
      if (polar) {
        ctx.lineTo(x(last[0] + off), poleY);
        ctx.lineTo(x(first[0] + off), poleY);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}
