import type { LonLat, PaleoGeographySlice } from "../data/schema";
import { morphFraction, morphOutlines, paleoFrame, type Frame } from "../simulation/paleoMorph";
import { useGeographyStore } from "./geographyStore";
import { useTimeStore } from "./timeStore";

/**
 * 当前时刻的板块漂移状态（逐帧读取，不触发 React 渲染）。
 * 场景组件在 useFrame 里调用；跨 store 的动作（相机定位）也用它取当前位置。
 */

/** 当前时刻的位置参考系。 */
export function currentPaleoFrame(): Frame {
  return paleoFrameNow(useGeographyStore.getState().slice);
}

/** 指定切片在当前时刻的参考系（组件按订阅到的切片重新计算时用）。 */
export function paleoFrameNow(slice: PaleoGeographySlice | null): Frame {
  return paleoFrame(slice, useTimeStore.getState().currentTimeYearsAgo);
}

/** 形变比例量化步长：20 Ma 的切片约 1 万年一档，足够平滑，又能在细微时间变化时复用结果。 */
const F_STEPS = 2000;

let cache: { src: LonLat[][] | null; f: number; out: LonLat[][] | null } = { src: null, f: -1, out: null };

/** 当前时刻形变后的轮廓；没有轮廓时为 null。f 未变化时返回同一个数组（调用方可按引用判断是否需要更新）。 */
export function currentOutlines(): LonLat[][] | null {
  const { outlines, next, slice } = useGeographyStore.getState();
  if (!outlines) return null;
  const f = next && slice ? Math.round(morphFraction(slice, useTimeStore.getState().currentTimeYearsAgo) * F_STEPS) / F_STEPS : 0;
  if (cache.src === outlines && cache.f === f) return cache.out;
  cache = { src: outlines, f, out: next && f > 0 ? morphOutlines(outlines, next, f) : outlines };
  return cache.out;
}
