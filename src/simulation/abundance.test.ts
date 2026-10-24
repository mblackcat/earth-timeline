import { abundanceTier, globeModelPx } from "./abundance";

describe("abundanceTier", () => {
  it("buckets record counts by order of magnitude", () => {
    expect(abundanceTier(0)).toBe(1);
    expect(abundanceTier(29)).toBe(1);
    expect(abundanceTier(30)).toBe(2);
    expect(abundanceTier(299)).toBe(2);
    expect(abundanceTier(300)).toBe(3);
    expect(abundanceTier(2_999)).toBe(3);
    expect(abundanceTier(3_000)).toBe(4);
    expect(abundanceTier(1e6)).toBe(4);
  });
});

describe("globeModelPx", () => {
  it("maps body size to a compressed, clamped screen size", () => {
    expect(globeModelPx(0.01)).toBe(14);
    expect(globeModelPx(0.06)).toBeCloseTo(14, 0);
    expect(globeModelPx(1.7)).toBeCloseTo(28, 0);
    expect(globeModelPx(12)).toBeCloseTo(42, 0);
    expect(globeModelPx(25)).toBe(48);
    expect(globeModelPx(100)).toBe(48);
  });

  it("is monotonic", () => {
    let prev = 0;
    for (const m of [0.001, 0.05, 0.2, 1, 3, 8, 20, 50]) {
      const px = globeModelPx(m);
      expect(px).toBeGreaterThanOrEqual(prev);
      prev = px;
    }
  });
});
