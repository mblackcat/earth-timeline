import type { LonLat } from "../data/schema";
import { isLandAt, landGridFromOutlines } from "./landGrid";

describe("land grid from coastlines", () => {
  it("fills a simple ring", () => {
    const g = landGridFromOutlines([[[-10, -10], [10, -10], [10, 10], [-10, 10]] as LonLat[]]);
    expect(g.resDeg).toBe(1);
    expect(isLandAt(g, [0, 0])).toBe(true);
    expect(isLandAt(g, [20, 0])).toBe(false);
  });

  it("handles rings across the antimeridian and wraps longitudes", () => {
    const g = landGridFromOutlines([[[170, -5], [-170, -5], [-170, 5], [170, 5]] as LonLat[]]);
    expect(isLandAt(g, [179, 0])).toBe(true);
    expect(isLandAt(g, [-179, 0])).toBe(true);
    expect(isLandAt(g, [189, 0])).toBe(true); // 经度 > 180 回绕（189 → -171，在环内）
    expect(isLandAt(g, [0, 0])).toBe(false);
  });

  it("closes polar rings to the pole", () => {
    const ring: LonLat[] = [];
    for (let lon = -180; lon <= 180; lon += 10) ring.push([lon, -70]);
    const g = landGridFromOutlines([ring]);
    expect(isLandAt(g, [0, -85])).toBe(true);
    expect(isLandAt(g, [0, -60])).toBe(false);
  });
});
