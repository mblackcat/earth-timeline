import type { LonLat } from "../data/schema";
import { contourLines, rasterizePolygons } from "./dissolve";

const square = (lon0: number, lat0: number, lon1: number, lat1: number): LonLat[] => [
  [lon0, lat0],
  [lon1, lat0],
  [lon1, lat1],
  [lon0, lat1],
  [lon0, lat0],
];

describe("dissolve", () => {
  it("rasterizes polygons with holes using the even-odd rule", () => {
    const g = rasterizePolygons([[square(0, 0, 10, 10), square(4, 4, 6, 6)]], 1);
    const land = (lon: number, lat: number) => g.cells[Math.floor(90 - lat) * g.width + Math.floor(lon + 180)];
    expect(land(1.5, 1.5)).toBe(1);
    expect(land(5.5, 5.5)).toBe(0);
    expect(land(11.5, 1.5)).toBe(0);
  });

  it("merges adjacent polygons into one outline without the shared internal edge", () => {
    const g = rasterizePolygons([[square(0, 0, 10, 10)], [square(10, 0, 20, 10)]], 1);
    const lines = contourLines(g);
    expect(lines).toHaveLength(1);
    const ring = lines[0]!;
    expect(ring[0]).toEqual(ring.at(-1)); // 闭合
    // 共享边 lon = 10 不应出现在轮廓内部（轮廓只沿外边界）
    const interior = ring.filter(([lon, lat]) => Math.abs(lon - 10) < 0.6 && lat > 1 && lat < 9);
    expect(interior).toHaveLength(0);
    const lons = ring.map((p) => p[0]);
    expect(Math.min(...lons)).toBeCloseTo(0, 0);
    expect(Math.max(...lons)).toBeCloseTo(20, 0);
  });

  it("produces separate outlines for separate land masses and handles the antimeridian", () => {
    const g = rasterizePolygons([[square(-40, -10, -30, 0)], [square(30, 10, 40, 20)], [square(170, 0, 180, 10)], [square(-180, 0, -170, 10)]], 1);
    const lines = contourLines(g);
    expect(lines).toHaveLength(3); // 跨 180° 的两块合为一块
    for (const l of lines) for (const [lon, lat] of l) expect(Math.abs(lon) <= 180 && Math.abs(lat) <= 90).toBe(true);
  });
});
