import { create } from "zustand";
import type { TimeSnapshot } from "../timeline/TimeEngine";

/**
 * 模拟时间的只读镜像。
 *
 * 唯一写入者是 `timeline/runtime` 中把 TimeEngine 快照同步进来的绑定；
 * UI 与场景只能订阅，不得维护自己的模拟时间副本（PLAN §8.4）。
 * 命令（播放 / 跳转 / 倍率…）一律通过 `timeEngine` 发出，不经过 store。
 */
export type TimeState = TimeSnapshot;

export const useTimeStore = create<TimeState>()(() => ({
  currentTimeYearsAgo: 0,
  isPlaying: false,
  direction: "forward",
  mode: "fine",
  rate: 1,
  fineRate: 1,
  deepRate: 1_000_000,
  stepSize: 1,
  boundary: "none",
  minYearsAgo: 0,
  maxYearsAgo: 4_540_000_000,
  resetYearsAgo: 0,
}));

/** 订阅引擎快照并写入 store（仅在快照对象变化时写入）。返回取消函数。 */
export function bindTimeStore(
  engine: { getSnapshot(): TimeSnapshot; subscribe(l: (s: TimeSnapshot) => void): () => void },
  store: typeof useTimeStore = useTimeStore,
): () => void {
  store.setState(engine.getSnapshot());
  return engine.subscribe((snap) => store.setState(snap));
}
