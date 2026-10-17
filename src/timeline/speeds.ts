import type { PlaybackMode, TimeSnapshot } from "./TimeEngine";

/**
 * 底部"倍速"下拉的预设：把精细模式与深时模式合并成一个列表（PLAN §4.5）。
 * 选择预设时同时切换模式；"全史 N 秒"按目标时长计算倍率。
 */
export interface SpeedPreset {
  id: string;
  label: string;
  mode: PlaybackMode;
  /** 年/秒；与 targetSeconds 二选一。 */
  rate?: number;
  targetSeconds?: number;
}

export const SPEED_PRESETS: SpeedPreset[] = [
  { id: "1", label: "1 年/秒", mode: "fine", rate: 1 },
  { id: "2", label: "2 年/秒", mode: "fine", rate: 2 },
  { id: "4", label: "4 年/秒", mode: "fine", rate: 4 },
  { id: "8", label: "8 年/秒", mode: "fine", rate: 8 },
  { id: "1k", label: "1 千年/秒", mode: "deep", rate: 1_000 },
  { id: "10k", label: "1 万年/秒", mode: "deep", rate: 10_000 },
  { id: "1m", label: "100 万年/秒", mode: "deep", rate: 1_000_000 },
  { id: "all-600", label: "全史 10 分钟", mode: "deep", targetSeconds: 600 },
  { id: "all-60", label: "全史 60 秒", mode: "deep", targetSeconds: 60 },
];

export const DEFAULT_SPEED_ID = "all-60";

function presetRate(p: SpeedPreset, spanYears: number): number {
  return p.rate ?? spanYears / p.targetSeconds!;
}

/** 当前快照对应的预设；自定义倍率返回 null。 */
export function matchSpeedPreset(s: Pick<TimeSnapshot, "mode" | "rate" | "maxYearsAgo" | "minYearsAgo">): SpeedPreset | null {
  const span = s.maxYearsAgo - s.minYearsAgo;
  return (
    SPEED_PRESETS.find((p) => p.mode === s.mode && Math.abs(presetRate(p, span) - s.rate) <= s.rate * 1e-9) ?? null
  );
}

/** 应用预设到引擎（只改模式与倍率，不改时间与播放状态）。 */
export function applySpeedPreset(
  engine: { setMode(m: PlaybackMode): void; setRate(r: number, m?: PlaybackMode): boolean; setTargetDuration(s: number): number | null },
  p: SpeedPreset,
): void {
  engine.setMode(p.mode);
  if (p.targetSeconds !== undefined) engine.setTargetDuration(p.targetSeconds);
  else engine.setRate(p.rate!, p.mode);
}

/** 自定义倍率归入哪种模式：≤ 8 年/秒属于精细模式。 */
export function modeForRate(rate: number): PlaybackMode {
  return rate <= 8 ? "fine" : "deep";
}
