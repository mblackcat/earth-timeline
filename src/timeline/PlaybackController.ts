import type { TimeEngine } from "./TimeEngine";

/**
 * 拥有 rAF 循环，用单调毫秒时钟驱动 TimeEngine.tick()（TASKS §1.3）。
 *
 * 页面失焦时浏览器会暂停 rAF；恢复可见时重新同步时钟基准，
 * 这样播放中的时间连续，不会把离开的真实时间一次性算进去。
 */
export interface PlaybackEnv {
  now: () => number;
  requestFrame: (cb: (t: number) => void) => number;
  cancelFrame: (id: number) => void;
  /** 可见性变化订阅，返回取消函数；回调参数为当前是否可见。 */
  onVisibilityChange: (cb: (visible: boolean) => void) => () => void;
}

export const browserEnv: PlaybackEnv = {
  now: () => performance.now(),
  requestFrame: (cb) => requestAnimationFrame(cb),
  cancelFrame: (id) => cancelAnimationFrame(id),
  onVisibilityChange: (cb) => {
    const handler = () => cb(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  },
};

export class PlaybackController {
  private frameId: number | null = null;
  private stopVisibility: (() => void) | null = null;

  constructor(
    private readonly engine: TimeEngine,
    private readonly env: PlaybackEnv = browserEnv,
  ) {}

  get running(): boolean {
    return this.frameId !== null;
  }

  start(): void {
    if (this.frameId !== null) return;
    this.engine.resyncClock(this.env.now());
    this.stopVisibility = this.env.onVisibilityChange((visible) => {
      if (visible) this.engine.resyncClock(this.env.now());
    });
    const loop = () => {
      this.engine.tick(this.env.now());
      this.frameId = this.env.requestFrame(loop);
    };
    this.frameId = this.env.requestFrame(loop);
  }

  stop(): void {
    if (this.frameId !== null) this.env.cancelFrame(this.frameId);
    this.frameId = null;
    this.stopVisibility?.();
    this.stopVisibility = null;
  }
}
