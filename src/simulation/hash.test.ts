import { hashString } from "./hash";

describe("hashString", () => {
  it("is deterministic, unsigned 32-bit and spreads similar keys", () => {
    expect(hashString("a#1")).toBe(hashString("a#1"));
    expect(hashString("a#1")).not.toBe(hashString("a#2"));
    for (const k of ["", "x", "trilobita#399"]) {
      const h = hashString(k);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
      expect(Number.isInteger(h)).toBe(true);
    }
  });
});
