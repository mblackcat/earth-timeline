import { EARTH_FORMATION_YEARS_AGO, TimeEngine, rateForTargetDuration, isValidRate } from "./TimeEngine";
import { PlaybackController, type PlaybackEnv } from "./PlaybackController";

/** 以固定帧间隔驱动引擎；返回结束时的虚拟毫秒。 */
function run(engine: TimeEngine, startMs: number, seconds: number, fps = 60): number {
  const frames = Math.round(seconds * fps);
  let t = startMs;
  fake = t;
  engine.tick(t);
  for (let i = 0; i < frames; i++) {
    t += 1000 / fps;
    fake = t;
    engine.tick(t);
  }
  return t;
}

function playing(opts: ConstructorParameters<typeof TimeEngine>[0], dir: "forward" | "backward" = "forward") {
  fake = 0;
  const e = mk(opts);
  e.setDirection(dir);
  e.tick(0);
  e.play(0);
  return e;
}

/** 虚拟时钟：测试中引擎命令读取的"此刻"。run() 与显式 tick 之前需同步到相同时刻。 */
let fake = 0;
const mk = (opts: ConstructorParameters<typeof TimeEngine>[0] = {}) => new TimeEngine({ ...opts, clock: () => fake });
beforeEach(() => {
  fake = 0;
});

describe("TimeEngine playback", () => {
  it("advances from the formation of the Earth toward the present", () => {
    const e = playing({ startYearsAgo: EARTH_FORMATION_YEARS_AGO, mode: "deep" });
    e.setRate(1_000_000);
    run(e, 0, 10);
    expect(e.currentTimeYearsAgo).toBeCloseTo(EARTH_FORMATION_YEARS_AGO - 10_000_000, -1);
  });

  it("advances from the present toward the past when backward", () => {
    const e = playing({ startYearsAgo: 0 }, "backward");
    run(e, 0, 5);
    expect(e.currentTimeYearsAgo).toBeCloseTo(5, 6);
  });

  it("is independent of frame rate", () => {
    const results = [30, 60, 144, 7].map((fps) => {
      const e = playing({ startYearsAgo: 1000 });
      e.setRate(4);
      run(e, 0, 10, fps);
      return e.currentTimeYearsAgo;
    });
    for (const r of results) expect(r).toBeCloseTo(960, 6);
  });

  it.each([1, 2, 4, 8])("supports %i yr/s in fine mode", (rate) => {
    const e = playing({ startYearsAgo: 1000 });
    e.setRate(rate);
    run(e, 0, 10);
    expect(e.currentTimeYearsAgo).toBeCloseTo(1000 - rate * 10, 6);
  });

  it("pauses and resumes continuously", () => {
    const e = playing({ startYearsAgo: 1000 });
    let t = run(e, 0, 2);
    e.pause();
    const paused = e.currentTimeYearsAgo;
    expect(paused).toBeCloseTo(998, 6);
    t = run(e, t, 30); // 暂停期间时钟照常走
    expect(e.currentTimeYearsAgo).toBe(paused);
    e.play(t);
    run(e, t, 3);
    expect(e.currentTimeYearsAgo).toBeCloseTo(995, 6);
  });

  it("does not jump after the window loses focus (resyncClock)", () => {
    const e = playing({ startYearsAgo: 1000 });
    run(e, 0, 1);
    const before = e.currentTimeYearsAgo;
    // 失焦 10 分钟：rAF 停止，恢复时重新同步时钟
    e.resyncClock(600_000);
    e.tick(600_016);
    expect(e.currentTimeYearsAgo).toBeCloseTo(before - 0.016, 6);
  });

  it("pause / rate change include the time since the last (slow) frame", () => {
    const e = playing({ startYearsAgo: 1000 });
    e.tick(0);
    // 主线程卡顿：上一帧在 t=0，下一帧还没来，用户在 t=1.5s 点了暂停
    fake = 1500;
    e.pause();
    expect(e.currentTimeYearsAgo).toBeCloseTo(998.5, 9);
    expect(e.isPlaying).toBe(false);

    const f = playing({ startYearsAgo: 1000 });
    f.tick(0);
    fake = 2000;
    f.setRate(8); // 变速前先结算 2 秒的 1 年/秒
    expect(f.currentTimeYearsAgo).toBeCloseTo(998, 9);
    fake = 3000;
    f.pause();
    expect(f.currentTimeYearsAgo).toBeCloseTo(998 - 8, 9);
  });

  it("reverses correctly mid-play", () => {
    const e = playing({ startYearsAgo: 500 });
    e.setRate(2);
    let t = run(e, 0, 5);
    expect(e.currentTimeYearsAgo).toBeCloseTo(490, 6);
    e.setDirection("backward");
    t = run(e, t, 5);
    expect(e.currentTimeYearsAgo).toBeCloseTo(500, 6);
    expect(t).toBeGreaterThan(0);
  });

  it("keeps playing from the new time after a seek", () => {
    const e = playing({ startYearsAgo: 1000 });
    const t = run(e, 0, 1);
    e.seek(5000);
    expect(e.currentTimeYearsAgo).toBe(5000);
    run(e, t, 2);
    expect(e.currentTimeYearsAgo).toBeCloseTo(4998, 6);
    expect(e.isPlaying).toBe(true);
  });

  it("handles random seeks and stays within bounds", () => {
    const e = mk();
    let seed = 12345;
    const rand = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    for (let i = 0; i < 500; i++) {
      const target = (rand() * 1.4 - 0.2) * EARTH_FORMATION_YEARS_AGO;
      e.seek(target);
      expect(e.currentTimeYearsAgo).toBe(Math.min(EARTH_FORMATION_YEARS_AGO, Math.max(0, target)));
    }
  });

  it("ignores invalid seek values", () => {
    const e = mk({ startYearsAgo: 100 });
    expect(e.seek(Number.NaN)).toBe(false);
    expect(e.seek(Infinity)).toBe(false);
    expect(e.currentTimeYearsAgo).toBe(100);
  });
});

describe("TimeEngine boundaries", () => {
  it("stops at the present without overflowing", () => {
    const e = playing({ startYearsAgo: 5 });
    e.setRate(8);
    run(e, 0, 10);
    expect(e.currentTimeYearsAgo).toBe(0);
    expect(e.isPlaying).toBe(false);
    expect(e.getSnapshot().boundary).toBe("modern");
  });

  it("stops at the formation of the Earth when playing backward", () => {
    const e = playing({ startYearsAgo: EARTH_FORMATION_YEARS_AGO - 1_000 }, "backward");
    e.setMode("deep");
    e.setRate(1_000_000);
    run(e, 0, 1);
    expect(e.currentTimeYearsAgo).toBe(EARTH_FORMATION_YEARS_AGO);
    expect(e.isPlaying).toBe(false);
    expect(e.getSnapshot().boundary).toBe("origin");
  });

  it("refuses to play past a boundary but can play the other way", () => {
    const e = mk({ startYearsAgo: 0 });
    expect(e.play(0)).toBe(false);
    expect(e.getSnapshot().boundary).toBe("modern");
    e.setDirection("backward");
    expect(e.getSnapshot().boundary).toBe("none");
    expect(e.play(0)).toBe(true);
  });

  it("playOrRestart restarts from the other end when already at the end", () => {
    const e = mk({ startYearsAgo: 0 });
    expect(e.playOrRestart(0)).toBe(true);
    expect(e.currentTimeYearsAgo).toBe(EARTH_FORMATION_YEARS_AGO);
    expect(e.isPlaying).toBe(true);
    e.pause();
    e.seek(1000);
    expect(e.playOrRestart(0)).toBe(false);
    expect(e.currentTimeYearsAgo).toBe(1000);
    e.pause();
    e.setDirection("backward");
    e.seek(EARTH_FORMATION_YEARS_AGO);
    expect(e.playOrRestart(0)).toBe(true);
    expect(e.currentTimeYearsAgo).toBe(0);
  });

  it("clamps a single huge frame instead of overshooting", () => {
    const e = playing({ startYearsAgo: 10 });
    e.tick(3_600_000);
    expect(e.currentTimeYearsAgo).toBe(0);
  });

  it("clamps single steps at the boundaries", () => {
    const e = mk({ startYearsAgo: 3 });
    e.setStepSize(10);
    e.step("forward");
    expect(e.currentTimeYearsAgo).toBe(0);
    expect(e.getSnapshot().boundary).toBe("modern");
    e.step("backward");
    expect(e.currentTimeYearsAgo).toBe(10);
    expect(e.getSnapshot().boundary).toBe("none");
  });
});

describe("TimeEngine steps and modes", () => {
  it("steps forward and backward by the configured size and pauses", () => {
    const e = playing({ startYearsAgo: 1000 });
    e.setStepSize(100);
    e.step("backward");
    expect(e.currentTimeYearsAgo).toBe(1100);
    expect(e.isPlaying).toBe(false);
    e.step("forward");
    e.step("forward");
    expect(e.currentTimeYearsAgo).toBe(900);
    expect(e.setStepSize(0)).toBe(false);
    expect(e.setStepSize(1000)).toBe(true);
  });

  it("keeps the current time when switching between fine and deep mode", () => {
    const e = playing({ startYearsAgo: 123_456 });
    const t = run(e, 0, 1);
    const before = e.currentTimeYearsAgo;
    e.setMode("deep");
    expect(e.currentTimeYearsAgo).toBe(before);
    expect(e.getSnapshot().rate).toBe(1_000_000);
    e.setMode("fine");
    expect(e.currentTimeYearsAgo).toBe(before);
    expect(e.getSnapshot().rate).toBe(1);
    expect(t).toBeGreaterThan(0);
  });

  it("computes the deep-time rate from a target duration", () => {
    const e = mk({ startYearsAgo: EARTH_FORMATION_YEARS_AGO, mode: "deep" });
    const rate = e.setTargetDuration(60);
    expect(rate).toBeCloseTo(EARTH_FORMATION_YEARS_AGO / 60, 3);
    e.setDirection("forward");
    e.tick(0);
    e.play(0);
    run(e, 0, 60);
    expect(e.currentTimeYearsAgo).toBeLessThan(1);
    expect(e.getSnapshot().boundary).toBe("modern");
  });

  it("validates custom and target-duration inputs", () => {
    const e = mk();
    for (const bad of [0, -5, Number.NaN, Infinity, 1e12, 1e-9]) {
      expect(isValidRate(bad)).toBe(false);
      expect(e.setRate(bad)).toBe(false);
    }
    expect(e.getSnapshot().rate).toBe(1);
    expect(e.setTargetDuration(0)).toBeNull();
    expect(e.setTargetDuration(1e9)).toBeNull();
    expect(rateForTargetDuration(100, 10)).toBe(10);
    expect(rateForTargetDuration(0, 10)).toBeNull();
  });

  it("changes the rate mid-play without moving the current time", () => {
    const e = playing({ startYearsAgo: 1000 });
    run(e, 0, 2);
    const before = e.currentTimeYearsAgo;
    e.setRate(8);
    expect(e.currentTimeYearsAgo).toBeCloseTo(before, 9);
  });

  it("resets to the configured start point and pauses", () => {
    const e = playing({ startYearsAgo: 1000 });
    run(e, 0, 5);
    e.setResetPoint(2000);
    e.reset();
    expect(e.currentTimeYearsAgo).toBe(2000);
    expect(e.isPlaying).toBe(false);
  });

  it("notifies subscribers and exposes a stable snapshot between changes", () => {
    const e = mk({ startYearsAgo: 10 });
    const seen: number[] = [];
    const off = e.subscribe((s) => seen.push(s.currentTimeYearsAgo));
    expect(e.getSnapshot()).toBe(e.getSnapshot());
    e.seek(20);
    e.seek(30);
    off();
    e.seek(40);
    expect(seen).toEqual([20, 30]);
  });
});

describe("TimeEngine numerical stability", () => {
  it("has no accumulated drift over a long run", () => {
    const e = playing({ startYearsAgo: EARTH_FORMATION_YEARS_AGO, mode: "deep" });
    e.setRate(1_000_000);
    // 约 1 小时的 60fps 帧，带抖动
    let t = 0;
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 216_000; i++) {
      t += 14 + rand() * 5;
      e.tick(t);
    }
    const expected = EARTH_FORMATION_YEARS_AGO - (t / 1000) * 1_000_000;
    // 在该时间尺度上，位置在 1 年以内与解析解一致
    expect(Math.abs(e.currentTimeYearsAgo - Math.max(0, expected))).toBeLessThan(1);
  });

  it("keeps year-level precision in fine mode for a long run", () => {
    const e = playing({ startYearsAgo: 2_000_000 });
    run(e, 0, 3600, 60);
    expect(e.currentTimeYearsAgo).toBeCloseTo(2_000_000 - 3600, 3);
  });
});

describe("PlaybackController", () => {
  function fakeEnv() {
    let now = 0;
    let cb: ((t: number) => void) | null = null;
    let visibility: ((v: boolean) => void) | null = null;
    let nextId = 1;
    const env: PlaybackEnv = {
      now: () => now,
      requestFrame: (c) => ((cb = c), nextId++),
      cancelFrame: () => {
        cb = null;
      },
      onVisibilityChange: (c) => {
        visibility = c;
        return () => {
          visibility = null;
        };
      },
    };
    return {
      env,
      advance(ms: number) {
        now += ms;
        const c = cb;
        cb = null;
        c?.(now);
      },
      jump(ms: number) {
        now += ms;
      },
      setVisible(v: boolean) {
        visibility?.(v);
      },
      hasFrame: () => cb !== null,
      hasVisibilityListener: () => visibility !== null,
    };
  }

  it("drives the engine from the clock and stops cleanly", () => {
    const f = fakeEnv();
    const engine = mk({ startYearsAgo: 100 });
    const ctrl = new PlaybackController(engine, f.env);
    ctrl.start();
    engine.play(f.env.now());
    for (let i = 0; i < 60; i++) f.advance(1000 / 60);
    expect(engine.currentTimeYearsAgo).toBeCloseTo(99, 6);
    ctrl.stop();
    expect(f.hasFrame()).toBe(false);
    expect(f.hasVisibilityListener()).toBe(false);
  });

  it("resumes continuously after the page becomes visible again", () => {
    const f = fakeEnv();
    const engine = mk({ startYearsAgo: 100 });
    const ctrl = new PlaybackController(engine, f.env);
    ctrl.start();
    engine.play(f.env.now());
    f.advance(1000);
    const before = engine.currentTimeYearsAgo;
    f.jump(300_000); // 标签页在后台 5 分钟，rAF 不触发
    f.setVisible(true);
    f.advance(16);
    expect(engine.currentTimeYearsAgo).toBeCloseTo(before - 0.016, 6);
    ctrl.stop();
  });
});
