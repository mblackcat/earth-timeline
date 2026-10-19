import { PACING_OPTIONS, buildPacing } from "./pacing";
import { TimeScale } from "./TimeScale";

const MAX = 4_540_000_000;
const scale = new TimeScale("segmented", MAX, 0);

describe("buildPacing", () => {
  it("W is monotonic from 0 (oldest) to 1 (present)", () => {
    const p = buildPacing(scale, [{ yearsAgo: 66_000_000, weight: 1 }]);
    expect(p.toW(MAX)).toBe(0);
    expect(p.toW(0)).toBeCloseTo(1, 12);
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const w = p.toW(scale.fromU(i / 200));
      expect(w).toBeGreaterThanOrEqual(prev);
      prev = w;
    }
  });

  it("fromW inverts toW", () => {
    const p = buildPacing(scale, [{ yearsAgo: 252_000_000, weight: 1 }, { yearsAgo: 10_000, weight: 1 }]);
    for (const t of [MAX, 3e9, 538_800_000, 252_000_000, 66e6, 2.58e6, 11_700, 5_000, 240, 0]) {
      expect(p.fromW(p.toW(t))).toBeCloseTo(t, -Math.max(0, Math.floor(Math.log10(t + 1)) - 6));
    }
    expect(p.fromW(-0.1)).toBe(MAX);
    expect(p.fromW(1.1)).toBe(0);
  });

  it("without anchors and log blend, playback is uniform along the timeline", () => {
    const p = buildPacing(scale, [], { ...PACING_OPTIONS, logBlend: 0 });
    for (const u of [0.1, 0.3, 0.5, 0.7, 0.9]) expect(p.toW(scale.fromU(u))).toBeCloseTo(u, 6);
  });

  it("slows down near anchors, capped at maxSlowdown", () => {
    const p = buildPacing(scale, [{ yearsAgo: 66_000_000, weight: 5 }]);
    const near = p.rateAt(66_000_000, 180);
    const empty = buildPacing(scale, []).rateAt(66_000_000, 180);
    const far = p.rateAt(30_000_000, 180);
    expect(near).toBeLessThan(far);
    // 有峰时总量变大、其他地方会略快，所以与无锚点时对比放慢倍数
    expect(empty / near).toBeGreaterThan(3);
    expect(p.densityAt(66_000_000)).toBeLessThanOrEqual(6);
  });

  it("rateAt × duration integrates to the whole span", () => {
    const p = buildPacing(scale, [{ yearsAgo: 66_000_000, weight: 1 }]);
    // 数值积分 ∫ rate dt（秒）= 总年数
    const T = 180;
    const steps = 20_000;
    let sum = 0;
    for (let i = 0; i < steps; i++) {
      const t = p.fromW((i + 0.5) / steps);
      sum += p.rateAt(t, T) * (T / steps);
    }
    expect(sum / MAX).toBeCloseTo(1, 2);
  });

  it("default base rhythm shortens the Precambrian and gives recent centuries time", () => {
    const p = buildPacing(scale, []);
    const share = (older: number, younger: number) => p.toW(younger) - p.toW(older);
    expect(share(MAX, 538_800_000)).toBeLessThan(0.16);
    expect(share(240, 0)).toBeGreaterThan(0.03);
  });
});
