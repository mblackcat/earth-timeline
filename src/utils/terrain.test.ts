import { contourSegments, makeHeightField } from "./terrain";

describe("terrain", () => {
  it("is deterministic and bounded by the amplitude", () => {
    const h = makeHeightField(2, 10, 3);
    expect(h(1.5, -2)).toBe(makeHeightField(2, 10, 3)(1.5, -2));
    for (let x = -20; x <= 20; x += 1.7) for (let z = -20; z <= 20; z += 1.3) expect(Math.abs(h(x, z))).toBeLessThanOrEqual(2 + 1e-9);
  });

  it("extracts contour segments that lie on their level", () => {
    const h = (x: number) => x; // 平面：等高线是 x = L 的直线
    const seg = contourSegments(h, 5, 10, [0, 2]);
    expect(seg.length).toBeGreaterThan(0);
    expect(seg.length % 6).toBe(0);
    for (let i = 0; i < seg.length; i += 3) {
      const x = seg[i]!;
      const y = seg[i + 1]!;
      expect(Math.abs(x - y)).toBeLessThan(1e-9); // x 坐标等于等高值
    }
  });
});
