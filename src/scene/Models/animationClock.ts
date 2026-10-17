import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useSettingsStore } from "../../state/settingsStore";
import { useTimeStore } from "../../state/timeStore";

export interface ClockInputs {
  animationsEnabled: boolean;
  idleWhenPaused: boolean;
  simPlaying: boolean;
}

/**
 * 动画时钟推进规则（TASKS §2 不变式 5）：
 * 只按真实经过时间推进，与模拟倍率无关；关闭动画时冻结；
 * 模拟时间暂停时，是否继续由"暂停时继续 Idle"决定。单帧最多推进 0.1 秒（失焦恢复不跳变）。
 */
export function advanceAnimationClock(t: number, dt: number, s: ClockInputs): number {
  if (!s.animationsEnabled) return t;
  if (!s.simPlaying && !s.idleWhenPaused) return t;
  return t + Math.min(Math.max(dt, 0), 0.1);
}

/** 在 R3F 场景中使用的动画时钟（ref，不触发 React 渲染）。 */
export function useAnimationClock() {
  const t = useRef(0);
  useFrame((_, dt) => {
    const s = useSettingsStore.getState();
    t.current = advanceAnimationClock(t.current, dt, {
      animationsEnabled: s.animationsEnabled,
      idleWhenPaused: s.idleWhenPaused,
      simPlaying: useTimeStore.getState().isPlaying,
    });
  });
  return t;
}
