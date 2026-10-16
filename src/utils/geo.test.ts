import { altitudeToLevel, graticuleLines, lonLatToXYZ, polylinesToSegments, xyzToLonLat } from "./geo";

describe("lonLatToXYZ / xyzToLonLat", () => {
  it("maps reference points to the documented axes", () => {
    const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));
    close(lonLatToXYZ(0, 0), [0, 0, 1]);
    close(lonLatToXYZ(90, 0), [1, 0, 0]);
    close(lonLatToXYZ(0, 90), [0, 1, 0]);
  });

  it("round-trips arbitrary coordinates", () => {
    for (const [lon, lat] of [[-179.5, -60], [12.3, 45.6], [120, 0], [-45, 89]] as const) {
      const [lo, la] = xyzToLonLat(...lonLatToXYZ(lon, lat, 2));
      expect(lo).toBeCloseTo(lon, 9);
      expect(la).toBeCloseTo(lat, 9);
    }
  });
});

describe("polylinesToSegments", () => {
  it("keeps every vertex on the requested radius", () => {
    const seg = polylinesToSegments([[[0, 0], [30, 10], [60, -5]]], 1.5);
    expect(seg.length % 6).toBe(0);
    for (let i = 0; i < seg.length; i += 3) {
      expect(Math.hypot(seg[i]!, seg[i + 1]!, seg[i + 2]!)).toBeCloseTo(1.5, 5);
    }
  });

  it("skips segments that cross the antimeridian", () => {
    expect(polylinesToSegments([[[179, 0], [-179, 0]]], 1).length).toBe(0);
  });
});

describe("graticuleLines", () => {
  it("produces 11 parallels and 24 meridians at 15°, with equator and prime meridian as major", () => {
    const { lines, major } = graticuleLines(15);
    expect(lines.length + major.length).toBe(11 + 24);
    expect(major.length).toBe(2);
  });
});

describe("altitudeToLevel", () => {
  it("assigns the five spatial levels by altitude", () => {
    expect(altitudeToLevel(3)).toBe(0);
    expect(altitudeToLevel(1.2)).toBe(0);
    expect(altitudeToLevel(1.19)).toBe(1);
    expect(altitudeToLevel(0.2)).toBe(2);
    expect(altitudeToLevel(0.05)).toBe(3);
    expect(altitudeToLevel(0.001)).toBe(4);
  });

  it("is monotonic (continuous zoom never skips back)", () => {
    let prev = 0;
    for (let h = 5; h > 0.0001; h *= 0.97) {
      const level = altitudeToLevel(h);
      expect(level).toBeGreaterThanOrEqual(prev);
      prev = level;
    }
  });
});
