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

  it("rasterizes a huge ring quickly and correctly", () => {
    const ring: LonLat[] = Array.from({ length: 40000 }, (_, i) => {
      const a = (i / 40000) * Math.PI * 2;
      return [60 * Math.cos(a), 60 * Math.sin(a)] as LonLat;
    });
    // 取 3 次最快的一次，避免首次 JIT / 并行负载导致偶发超时
    let best = Infinity;
    let g = landGridFromOutlines([ring]);
    for (let k = 0; k < 3; k++) {
      const t0 = performance.now();
      g = landGridFromOutlines([ring]);
      best = Math.min(best, performance.now() - t0);
    }
    expect(best).toBeLessThan(60);
    expect(isLandAt(g, [0, 0])).toBe(true);
    expect(isLandAt(g, [170, 0])).toBe(false);
  });
});
