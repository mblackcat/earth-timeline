import { altitudeToLevel, angularDistanceDeg, graticuleLines, horizonDeg, lonLatToXYZ, offsetLonLat, polylinesToSegments, unwrapRing, xyzToLonLat } from "./geo";

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

describe("spherical helpers", () => {
  it("angular distance", () => {
    expect(angularDistanceDeg([0, 0], [90, 0])).toBeCloseTo(90);
    expect(angularDistanceDeg([10, 20], [10, 20])).toBeCloseTo(0);
    expect(angularDistanceDeg([179, 0], [-179, 0])).toBeCloseTo(2);
  });

  it("offsetLonLat moves along a great circle by the given distance and bearing", () => {
    const north = offsetLonLat([0, 0], 0, 1);
    expect(north[0]).toBeCloseTo(0);
    expect(north[1]).toBeCloseTo(1);
    const east = offsetLonLat([0, 60], Math.PI / 2, 1);
    expect(east[0]).toBeGreaterThan(1.9);
    expect(angularDistanceDeg([0, 60], east)).toBeCloseTo(1);
    expect(offsetLonLat([179.5, 0], Math.PI / 2, 1)[0]).toBeCloseTo(-179.5);
    expect(offsetLonLat([5, 5], 1, 0)).toEqual([5, 5]);
  });

  it("horizon angle shrinks as the camera gets closer", () => {
    expect(horizonDeg(2.4)).toBeCloseTo(72.9, 0);
    expect(horizonDeg(0.5)).toBeLessThan(horizonDeg(2.4));
  });

  it("unwrapRing still lives behind the old import path", async () => {
    const mod = await import("../scene/Ink/landMask");
    expect(mod.unwrapRing).toBe(unwrapRing);
  });
});
