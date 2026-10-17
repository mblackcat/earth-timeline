/**
 * 唯一权威的模拟时间（PLAN §4、TASKS §1.3）。纯 TypeScript，不依赖 React / Three。
 *
 * - 内部单位 `yearsAgo`（距今年数）。"向前播放" = 历史前进 = yearsAgo 减小。
 * - 推进依据是真实经过时间（毫秒时钟），不是帧数，因此速度与帧率无关。
 * - 采用"锚点 + 已播放秒数"计算当前时间：position = anchor ∓ rate × elapsed，
 *   不在每帧上累加大数，长时间运行也没有累积漂移。
 * - 改变速率 / 方向 / 跳转 / 单步都会重新锚定。
 */

export const EARTH_FORMATION_YEARS_AGO = 4_540_000_000;

export type PlaybackMode = "fine" | "deep";
/** forward = 历史向现代前进（yearsAgo 减小）；backward = 回溯过去。 */
export type PlaybackDirection = "forward" | "backward";
export type TimeBoundary = "none" | "modern" | "origin";

/** 精细模式倍率（年/秒，PLAN §4.5 模式 A）。 */
export const FINE_RATES = [1, 2, 4, 8] as const;
/** 深时模式预设（年/秒，PLAN §4.5 模式 B）。 */
export const DEEP_RATE_PRESETS = [1_000, 10_000, 1_000_000] as const;
/** 单步步长预设（年）。 */
export const STEP_SIZES = [1, 10, 100, 1_000] as const;

export const MIN_RATE = 1e-3;
export const MAX_RATE = 1e10;
/** 目标时长（秒）的有效范围：1 秒 – 24 小时。 */
export const MIN_TARGET_SECONDS = 1;
export const MAX_TARGET_SECONDS = 86_400;

export const DEFAULT_RATES: Record<PlaybackMode, number> = { fine: 1, deep: 1_000_000 };

export interface TimeSnapshot {
  currentTimeYearsAgo: number;
  isPlaying: boolean;
  direction: PlaybackDirection;
  mode: PlaybackMode;
  /** 当前模式下生效的倍率（年/秒）。 */
  rate: number;
  fineRate: number;
  deepRate: number;
  stepSize: number;
  /** 最近一次因到达边界而停止所在的边界；离开边界后恢复为 "none"。 */
  boundary: TimeBoundary;
  minYearsAgo: number;
  maxYearsAgo: number;
  /** 重置按钮回到的时间。 */
  resetYearsAgo: number;
}

export interface TimeEngineOptions {
  /** 最新（最小 yearsAgo）边界，默认 0 = 现代。 */
  minYearsAgo?: number;
  /** 最古老（最大 yearsAgo）边界，默认地球形成。 */
  maxYearsAgo?: number;
  startYearsAgo?: number;
  mode?: PlaybackMode;
  /** 单调毫秒时钟，默认 `performance.now()`；测试中可注入。 */
  clock?: () => number;
}

export function isValidRate(rate: number): boolean {
  return Number.isFinite(rate) && rate >= MIN_RATE && rate <= MAX_RATE;
}

/** 按"在 seconds 秒内播完 span 年"计算倍率；非法输入返回 null。 */
export function rateForTargetDuration(spanYears: number, seconds: number): number | null {
  if (!Number.isFinite(spanYears) || spanYears <= 0) return null;
  if (!Number.isFinite(seconds) || seconds < MIN_TARGET_SECONDS || seconds > MAX_TARGET_SECONDS) return null;
  const rate = spanYears / seconds;
  return isValidRate(rate) ? rate : null;
}

type Listener = (snapshot: TimeSnapshot) => void;

export class TimeEngine {
  private readonly minYearsAgo: number;
  private readonly maxYearsAgo: number;
  private resetYearsAgo: number;

  private anchorYearsAgo: number;
  /** 自锚点起已播放的秒数（仅播放中累加）。 */
  private elapsedSec = 0;
  private lastTickMs: number | null = null;

  private playing = false;
  private direction: PlaybackDirection = "forward";
  private mode: PlaybackMode;
  private fineRate: number = DEFAULT_RATES.fine;
  private deepRate: number = DEFAULT_RATES.deep;
  private stepSize: number = STEP_SIZES[0];
  private boundary: TimeBoundary = "none";

  private readonly clock: () => number;
  private listeners = new Set<Listener>();
  private cached: TimeSnapshot | null = null;

  constructor(options: TimeEngineOptions = {}) {
    this.minYearsAgo = options.minYearsAgo ?? 0;
    this.maxYearsAgo = options.maxYearsAgo ?? EARTH_FORMATION_YEARS_AGO;
    if (!(this.minYearsAgo < this.maxYearsAgo)) throw new RangeError("minYearsAgo must be < maxYearsAgo");
    this.clock = options.clock ?? (() => performance.now());
    this.mode = options.mode ?? "fine";
    this.anchorYearsAgo = this.clamp(options.startYearsAgo ?? this.minYearsAgo);
    this.resetYearsAgo = this.anchorYearsAgo;
  }

  // ───────────── 读取 ─────────────

  get currentTimeYearsAgo(): number {
    if (!this.playing || this.elapsedSec === 0) return this.anchorYearsAgo;
    const delta = this.rate * this.elapsedSec * (this.direction === "forward" ? -1 : 1);
    return this.clamp(this.anchorYearsAgo + delta);
  }

  get rate(): number {
    return this.mode === "fine" ? this.fineRate : this.deepRate;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  getSnapshot(): TimeSnapshot {
    const now = this.currentTimeYearsAgo;
    const c = this.cached;
    if (
      c &&
      c.currentTimeYearsAgo === now &&
      c.isPlaying === this.playing &&
      c.direction === this.direction &&
      c.mode === this.mode &&
      c.fineRate === this.fineRate &&
      c.deepRate === this.deepRate &&
      c.stepSize === this.stepSize &&
      c.boundary === this.boundary &&
      c.resetYearsAgo === this.resetYearsAgo
    ) {
      return c;
    }
    this.cached = {
      currentTimeYearsAgo: now,
      isPlaying: this.playing,
      direction: this.direction,
      mode: this.mode,
      rate: this.rate,
      fineRate: this.fineRate,
      deepRate: this.deepRate,
      stepSize: this.stepSize,
      boundary: this.boundary,
      minYearsAgo: this.minYearsAgo,
      maxYearsAgo: this.maxYearsAgo,
      resetYearsAgo: this.resetYearsAgo,
    };
    return this.cached;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ───────────── 推进 ─────────────

  /**
   * 以单调毫秒时钟（如 `performance.now()`）推进一帧。
   * 暂停时只更新时钟基准，不推进时间。
   */
  tick(nowMs: number = this.clock()): void {
    if (this.advance(nowMs)) this.emit();
  }

  /** 推进到 nowMs；返回是否发生了推进（需要通知订阅者）。 */
  private advance(nowMs: number): boolean {
    const last = this.lastTickMs;
    this.lastTickMs = nowMs;
    if (!this.playing || last === null) return false;
    const dtSec = Math.max(0, nowMs - last) / 1000;
    this.elapsedSec += dtSec;

    const t = this.unclampedPosition();
    const hitBoundary = this.direction === "forward" ? t <= this.minYearsAgo : t >= this.maxYearsAgo;
    if (hitBoundary) {
      this.anchorYearsAgo = this.direction === "forward" ? this.minYearsAgo : this.maxYearsAgo;
      this.boundary = this.direction === "forward" ? "modern" : "origin";
      this.elapsedSec = 0;
      this.playing = false;
    }
    return true;
  }

  /**
   * 命令执行前先把时间推进到"此刻"：主线程繁忙、rAF 较慢时，
   * 暂停 / 变速 / 换向不会丢掉上一帧到命令之间的那段真实时间。
   */
  private sync(): void {
    if (this.playing) this.advance(this.clock());
  }

  /**
   * 重新同步时钟基准而不推进时间：页面失焦恢复后调用，
   * 避免把"离开的这段真实时间"一次性算进模拟时间（时间连续）。
   */
  resyncClock(nowMs: number): void {
    this.lastTickMs = nowMs;
  }

  // ───────────── 命令 ─────────────

  /** 开始 / 继续播放。已在当前方向的边界上时不播放，返回 false。 */
  play(nowMs?: number): boolean {
    if (this.playing) return true;
    const t = this.anchorYearsAgo;
    if (this.direction === "forward" ? t <= this.minYearsAgo : t >= this.maxYearsAgo) {
      this.boundary = this.direction === "forward" ? "modern" : "origin";
      this.emit();
      return false;
    }
    this.playing = true;
    this.boundary = "none";
    this.lastTickMs = nowMs ?? this.clock();
    this.emit();
    return true;
  }

  /**
   * 播放按钮语义：若已停在播放方向的终点（如现代），先跳回另一端再播放，
   * 与视频播放器"播完后再点播放 = 从头开始"一致。返回是否发生了重新开始。
   */
  playOrRestart(nowMs?: number): boolean {
    if (this.playing) return false;
    const t = this.anchorYearsAgo;
    const atEnd = this.direction === "forward" ? t <= this.minYearsAgo : t >= this.maxYearsAgo;
    if (atEnd) this.seek(this.direction === "forward" ? this.maxYearsAgo : this.minYearsAgo);
    this.play(nowMs);
    return atEnd;
  }

  pause(): void {
    this.sync();
    if (!this.playing) return;
    this.reanchor();
    this.playing = false;
    this.emit();
  }

  toggle(nowMs?: number): void {
    if (this.playing) this.pause();
    else this.play(nowMs);
  }

  setDirection(direction: PlaybackDirection): void {
    if (direction === this.direction) return;
    this.sync();
    this.reanchor();
    this.direction = direction;
    // 若停在边界上，换到可前进的方向后清除边界提示。
    if (this.boundary !== "none") {
      const atMin = this.anchorYearsAgo <= this.minYearsAgo;
      const atMax = this.anchorYearsAgo >= this.maxYearsAgo;
      const blocked = direction === "forward" ? atMin : atMax;
      if (!blocked) this.boundary = "none";
    }
    this.emit();
  }

  /** 跳转到指定时间（超出范围时夹取到边界）；保持播放状态与方向。非法值被忽略。 */
  seek(yearsAgo: number): boolean {
    if (!Number.isFinite(yearsAgo)) return false;
    this.anchorYearsAgo = this.clamp(yearsAgo);
    this.elapsedSec = 0;
    this.boundary = "none";
    // 跳到当前方向的边界上时，播放没有意义，停下并提示。
    if (this.playing) {
      const t = this.anchorYearsAgo;
      if (this.direction === "forward" ? t <= this.minYearsAgo : t >= this.maxYearsAgo) {
        this.playing = false;
        this.boundary = this.direction === "forward" ? "modern" : "origin";
      }
    }
    this.emit();
    return true;
  }

  /** 单步：按步长前进（向现代）或后退（向过去）。先暂停。 */
  step(direction: PlaybackDirection): void {
    this.sync();
    this.reanchor();
    this.playing = false;
    const delta = this.stepSize * (direction === "forward" ? -1 : 1);
    const target = this.clamp(this.anchorYearsAgo + delta);
    this.anchorYearsAgo = target;
    this.elapsedSec = 0;
    this.boundary =
      target <= this.minYearsAgo && direction === "forward"
        ? "modern"
        : target >= this.maxYearsAgo && direction === "backward"
          ? "origin"
          : "none";
    this.emit();
  }

  setStepSize(years: number): boolean {
    if (!Number.isFinite(years) || years <= 0) return false;
    this.stepSize = years;
    this.emit();
    return true;
  }

  /** 切换模式：不改变当前时间、播放状态与方向（各模式记住自己的倍率）。 */
  setMode(mode: PlaybackMode): void {
    if (mode === this.mode) return;
    this.sync();
    this.reanchor();
    this.mode = mode;
    this.emit();
  }

  /** 设置当前模式或指定模式的倍率（年/秒）。非法值返回 false，状态不变。 */
  setRate(rate: number, mode: PlaybackMode = this.mode): boolean {
    if (!isValidRate(rate)) return false;
    if (mode === this.mode) {
      this.sync();
      this.reanchor();
    }
    if (mode === "fine") this.fineRate = rate;
    else this.deepRate = rate;
    this.emit();
    return true;
  }

  /** 深时模式：设置"在 seconds 秒内播完整个时间范围"。返回采用的倍率或 null。 */
  setTargetDuration(seconds: number): number | null {
    const rate = rateForTargetDuration(this.maxYearsAgo - this.minYearsAgo, seconds);
    if (rate === null) return null;
    this.setRate(rate, "deep");
    return rate;
  }

  /** 设定"重置"回到的起始时间（默认为构造时的起点）。 */
  setResetPoint(yearsAgo: number): boolean {
    if (!Number.isFinite(yearsAgo)) return false;
    this.resetYearsAgo = this.clamp(yearsAgo);
    this.emit();
    return true;
  }

  /** 暂停并回到起始时间。 */
  reset(): void {
    this.playing = false;
    this.seek(this.resetYearsAgo);
  }

  // ───────────── 内部 ─────────────

  private clamp(t: number): number {
    return Math.min(this.maxYearsAgo, Math.max(this.minYearsAgo, t));
  }

  private unclampedPosition(): number {
    return this.anchorYearsAgo + this.rate * this.elapsedSec * (this.direction === "forward" ? -1 : 1);
  }

  /** 把已播放的位移固化进锚点（改变速率 / 方向 / 暂停前调用）。 */
  private reanchor(): void {
    if (this.elapsedSec === 0) return;
    this.anchorYearsAgo = this.currentTimeYearsAgo;
    this.elapsedSec = 0;
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const snap = this.getSnapshot();
    for (const l of this.listeners) l(snap);
  }
}
