import { bindTimeStore } from "../state/timeStore";
import { PlaybackController } from "./PlaybackController";
import { DEFAULT_SPEED_ID, SPEED_PRESETS, applySpeedPreset } from "./speeds";
import { TimeEngine } from "./TimeEngine";

/** 应用级单例：唯一的时间引擎与它的 rAF 驱动。 */
export const timeEngine = new TimeEngine();
// 默认"全史 60 秒"：首次点播放即可看到完整的地球历史扫过时间轴。
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
