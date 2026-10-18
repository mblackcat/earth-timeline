import { useEffect, useMemo } from "react";
import { CanvasTexture, LinearFilter, type Texture } from "three";
import type { LonLat } from "../../data/schema";

/** 经度展开为连续值：相邻点差超过 180° 时加减 360°（跨日界线的环不再横穿地图）。 */
export function unwrapRing(ring: LonLat[]): LonLat[] {
  if (!ring.length) return [];
  const out: LonLat[] = [[ring[0]![0], ring[0]![1]]];
  let offset = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = ring[i]![0] - ring[i - 1]![0];
    if (d > 180) offset -= 360;
    else if (d < -180) offset += 360;
    out.push([ring[i]![0] + offset, ring[i]![1]]);
  }
  return out;
}

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

/** 轮廓 → 陆地遮罩纹理。轮廓变化时重建并释放旧纹理；没有轮廓时返回 null（着色器退化为全海洋）。 */
export function useLandMaskTexture(outlines: LonLat[][] | null, width = 4096): Texture | null {
  const texture = useMemo(() => {
    if (!outlines || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = width / 2;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    drawLandMask(ctx, outlines, canvas.width, canvas.height);
    const t = new CanvasTexture(canvas);
    // 经度 ±180° 处 UV 跳变：不用 mipmap，避免接缝处出现一条采样错误的线
    t.generateMipmaps = false;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    return t;
  }, [outlines, width]);
  useEffect(() => () => texture?.dispose(), [texture]);
  return texture;
}
