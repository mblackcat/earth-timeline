import { bindTimeStore } from "../state/timeStore";
import { PlaybackController } from "./PlaybackController";
import { DEFAULT_SPEED_ID, SPEED_PRESETS, applySpeedPreset } from "./speeds";
import { collectPacingAnchors } from "../simulation/pacingAnchors";
import { buildPacing } from "./pacing";
import { EARTH_FORMATION_YEARS_AGO, TimeEngine } from "./TimeEngine";
import { TimeScale } from "./TimeScale";

/** 应用级单例：唯一的时间引擎与它的 rAF 驱动。 */
export const timeEngine = new TimeEngine();
// 智能倍速：按事件 / 物种 / 纪 / 切片的密度放慢（基础节奏与时间轴的分段压缩刻度一致）
timeEngine.setPacing(buildPacing(new TimeScale("segmented", EARTH_FORMATION_YEARS_AGO, 0), collectPacingAnchors()));
// 默认"智能 · 约 3 分钟"：前期空白加速、内容密集处放慢
applySpeedPreset(timeEngine, SPEED_PRESETS.find((p) => p.id === DEFAULT_SPEED_ID)!);
export const playbackController = new PlaybackController(timeEngine);

/** 在应用挂载时调用：把引擎绑定到 store 并启动播放循环。返回清理函数。 */
export function startTimeRuntime(): () => void {
  const unbind = bindTimeStore(timeEngine);
  playbackController.start();
  return () => {
    playbackController.stop();
    unbind();
  };
}

// 开发 / 测试辅助：让 e2e 直接读取引擎的真实状态（DOM 在主线程繁忙时会滞后）。
if (import.meta.env.DEV) {
  (window as unknown as { __timeEngine?: TimeEngine }).__timeEngine = timeEngine;
}
