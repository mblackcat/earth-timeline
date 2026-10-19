import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { CanvasTexture, LinearFilter, type MeshLambertMaterial } from "three";
import type { LonLat } from "../../data/schema";
import { useGeographyStore } from "../../state/geographyStore";
import { currentOutlines } from "../../state/paleoFrame";
import { drawLandMask } from "./landMask";
import { setToneLandMask } from "./toneMaterial";

/** 形变（播放）中用的低分辨率遮罩宽度：整张重绘 + 上传约为全分辨率的 1/16。 */
const MORPH_WIDTH = 1024;
/** 形变停止多久后补画全分辨率遮罩（毫秒）。 */
const SETTLE_MS = 250;

interface Target {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: CanvasTexture;
}

function createTarget(width: number): Target | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = width / 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const texture = new CanvasTexture(canvas);
  // 经度 ±180° 处 UV 跳变：不用 mipmap，避免接缝处出现一条采样错误的线
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  return { canvas, ctx, texture };
}

function draw(t: Target, lines: LonLat[][]) {
  drawLandMask(t.ctx, lines, t.canvas.width, t.canvas.height);
  t.texture.needsUpdate = true;
}

/**
 * 当前轮廓 → 地球材质的陆地遮罩（板块漂移时逐帧更新）。
 * 形变中画低分辨率遮罩，停下后补画全分辨率；换切片时直接画全分辨率。没有轮廓时清除遮罩（全海洋）。
 */
export function useMorphingLandMask(material: MeshLambertMaterial, width = 4096): void {
  const targets = useMemo(() => ({ high: createTarget(width), low: createTarget(MORPH_WIDTH) }), [width]);
  // 逐帧状态通过 ref 修改
  const live = useRef<{ lines: LonLat[][] | null; src: LonLat[][] | null; changedAt: number; highFresh: boolean } | null>(null);
  useEffect(() => {
    live.current = { lines: null, src: null, changedAt: 0, highFresh: false };
    return () => {
      targets.high?.texture.dispose();
      targets.low?.texture.dispose();
      setToneLandMask(material, null);
    };
  }, [targets, material]);

  useFrame(() => {
    const st = live.current;
    const { high, low } = targets;
    if (!st || !high || !low) return;
    const lines = currentOutlines();
    if (!lines) {
      if (st.lines) setToneLandMask(material, null);
      st.lines = null;
      st.src = null;
      return;
    }
    const now = performance.now();
    if (lines !== st.lines) {
      const src = useGeographyStore.getState().outlines;
      if (src !== st.src) {
        // 换切片（跳转或跨边界）：直接画全分辨率
        draw(high, lines);
        setToneLandMask(material, high.texture);
        st.highFresh = true;
      } else {
        draw(low, lines);
        setToneLandMask(material, low.texture);
        st.highFresh = false;
      }
      st.lines = lines;
      st.src = src;
      st.changedAt = now;
      return;
    }
    if (!st.highFresh && now - st.changedAt >= SETTLE_MS) {
      draw(high, lines);
      setToneLandMask(material, high.texture);
      st.highFresh = true;
    }
  });
}
