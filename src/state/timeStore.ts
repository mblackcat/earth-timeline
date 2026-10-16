import { create } from "zustand";

/**
 * 模拟时间的只读镜像。
 *
 * 唯一写入者是 Phase 2 的 TimeEngine / PlaybackController；
 * UI 与场景只能订阅，不得维护自己的模拟时间副本（PLAN §8.4）。
 * Phase 1 中时间固定为现代基准 0。
 */
export interface TimeState {
  currentTimeYearsAgo: number;
}

export const useTimeStore = create<TimeState>()(() => ({
  currentTimeYearsAgo: 0,
}));
