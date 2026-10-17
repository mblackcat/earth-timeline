import {
  FULL_VIEW,
  MIN_VISIBLE_YEARS,
  TimeScale,
  computeTicks,
  ensureVisible,
  fitView,
  formatTick,
  panView,
  uToX,
  xToU,
  zoomView,
} from "./TimeScale";

const MAX = 4_540_000_000;

describe("TimeScale mapping", () => {
  it.each(["segmented", "linear"] as const)("%s: maps ends and round-trips", (kind) => {
    const s = new TimeScale(kind, MAX);
    expect(s.toU(MAX)).toBe(0);
    expect(s.toU(0)).toBe(1);
    for (const t of [0, 1, 999, 11_700, 315_000, 66e6, 251.902e6, 1e9, MAX]) {
      expect(s.fromU(s.toU(t))).toBeCloseTo(t, kind === "linear" ? -1 : 3);
    }
  });

  it("is strictly monotonic (older → further left)", () => {
    const s = new TimeScale("segmented", MAX);
    let prev = -1;
    for (const t of [MAX, 3e9, 538.8e6, 300e6, 66e6, 1e6, 2.58e6 - 1, 11_700, 5000, 100, 1, 0].sort((a, b) => b - a)) {
      const u = s.toU(t);
      expect(u).toBeGreaterThan(prev);
      prev = u;
    }
  });

  it("gives modern history a usable width in segmented mode but not in linear mode", () => {
    const seg = new TimeScale("segmented", MAX);
    const lin = new TimeScale("linear", MAX);
    const widthOfLast5000 = (s: TimeScale) => (s.toU(0) - s.toU(5000)) * 1000;
    expect(widthOfLast5000(seg)).toBeGreaterThan(80); // 1000px 宽时 > 80px
    expect(widthOfLast5000(lin)).toBeLessThan(0.01);
  });

  it("clamps out-of-range input", () => {
    const s = new TimeScale("segmented", MAX);
    expect(s.toU(-50)).toBe(1);
    expect(s.toU(1e12)).toBe(0);
  });
});

describe("view window", () => {
  const s = new TimeScale("segmented", MAX);

  it("zooms around an anchor that stays fixed on screen", () => {
    const anchor = s.toU(66e6);
    const before = uToX(FULL_VIEW, 1000, anchor);
    const v = zoomView(s, FULL_VIEW, 4, anchor);
    expect(v.u1 - v.u0).toBeCloseTo(0.25, 9);
    expect(uToX(v, 1000, anchor)).toBeCloseTo(before, 6);
  });

  it("limits zoom-in to a minimum number of visible years and zoom-out to the full range", () => {
    let v = FULL_VIEW;
    for (let i = 0; i < 200; i++) v = zoomView(s, v, 2, s.toU(500));
    const years = s.fromU(v.u0) - s.fromU(v.u1);
    expect(years).toBeGreaterThanOrEqual(MIN_VISIBLE_YEARS * 0.999);
    for (let i = 0; i < 200; i++) v = zoomView(s, v, 0.5, 0.5);
    expect(v).toEqual(FULL_VIEW);
  });

  it("pans within bounds and keeps the span", () => {
    const v = { u0: 0.4, u1: 0.5 };
    expect(panView(v, 1)).toEqual({ u0: 0.9, u1: 1 });
    const left = panView(v, -1);
    expect(left.u0).toBe(0);
    expect(left.u1).toBeCloseTo(0.1, 12);
  });

  it("keeps an event at the same true-time position after zooming (x ↔ u ↔ years)", () => {
    const v = fitView(s, 251.941e6, 251.88e6);
    const x = uToX(v, 800, s.toU(251.902e6));
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(800);
    expect(s.fromU(xToU(v, 800, x))).toBeCloseTo(251.902e6, 0);
  });

  it("ensureVisible pans only when the point leaves the window", () => {
    const v = { u0: 0.2, u1: 0.4 };
    expect(ensureVisible(v, 0.3)).toBe(v);
    const moved = ensureVisible(v, 0.7);
    expect(0.7).toBeLessThanOrEqual(moved.u1);
    expect(moved.u1 - moved.u0).toBeCloseTo(0.2, 12);
  });
});

describe("ticks", () => {
  const s = new TimeScale("segmented", MAX);

  it("labels calendar years without a year 0", () => {
    expect(formatTick(0)).toBe("现代");
    expect(formatTick(1000)).toBe("1000");
    expect(formatTick(1999)).toBe("1");
    expect(formatTick(2000)).toBe("前1");
    expect(formatTick(2499)).toBe("前500");
    expect(formatTick(66e6, 1e6)).toBe("66 Ma");
    expect(formatTick(MAX, MAX)).toBe("4.54 Ga");
    expect(formatTick(11_700, 11_700)).toBe("11.7 ka");
  });

  it("produces readable, non-overlapping ticks at every zoom level", () => {
    let v = FULL_VIEW;
    for (let i = 0; i < 40; i++) {
      const ticks = computeTicks(s, v, 1000, 90);
      expect(ticks.length).toBeGreaterThanOrEqual(2);
      for (let k = 1; k < ticks.length; k++) expect(ticks[k]!.x - ticks[k - 1]!.x).toBeGreaterThanOrEqual(54);
      for (const t of ticks) {
        expect(t.x).toBeGreaterThanOrEqual(-0.001);
        expect(t.x).toBeLessThanOrEqual(1000.001);
        expect(t.label).not.toMatch(/NaN|undefined/);
      }
      v = zoomView(s, v, 1.6, s.toU(1200));
    }
  });

  it("shows segment boundaries in the full view", () => {
    const labels = computeTicks(s, FULL_VIEW, 1200).filter((t) => t.boundary).map((t) => t.label);
    expect(labels).toEqual(["538.8 Ma", "66 Ma", "2.58 Ma", "11.7 ka"]);
    const all = computeTicks(s, FULL_VIEW, 1200);
    expect(all[0]!.label).toBe("4.54 Ga");
    expect(all.at(-1)!.label).toBe("现代");
  });

  it("never emits a calendar tick for year 0 when crossing BCE/CE", () => {
    const v = fitView(s, 2600, 1400); // 约 前600 – 600
    const ticks = computeTicks(s, v, 1000, 60);
    expect(ticks.some((t) => t.label === "0" || t.label === "前0")).toBe(false);
    expect(ticks.some((t) => t.label.startsWith("前"))).toBe(true);
    expect(ticks.some((t) => /^\d+$/.test(t.label))).toBe(true);
  });
});
