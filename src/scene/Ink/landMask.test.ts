import type { LonLat } from "../../data/schema";
import { drawLandMask, unwrapRing } from "./landMask";

describe("unwrapRing", () => {
  it("leaves an ordinary ring untouched", () => {
    const r: LonLat[] = [[10, 0], [20, 0], [20, 10], [10, 0]];
    expect(unwrapRing(r)).toEqual(r);
  });
  it("makes a ring crossing ±180° continuous", () => {
    const r: LonLat[] = [[170, 0], [-170, 0], [-170, 10], [170, 10], [170, 0]];
    expect(unwrapRing(r).map((p) => p[0])).toEqual([170, 190, 190, 170, 170]);
  });
  it("a polar ring unwraps to a 360° span", () => {
    const r: LonLat[] = [[-180, -70], [-90, -70], [0, -70], [90, -70], [179, -70], [-180, -70]];
    const lons = unwrapRing(r).map((p) => p[0]);
    expect(Math.max(...lons) - Math.min(...lons)).toBeCloseTo(360, 6);
  });
});

/** 记录调用的假 2D 上下文。 */
function fakeCtx() {
  const calls: { op: string; args: number[] }[] = [];
  const ctx = {
    fillStyle: "",
    fillRect: (...a: number[]) => calls.push({ op: "fillRect", args: a }),
    beginPath: () => calls.push({ op: "beginPath", args: [] }),
    moveTo: (...a: number[]) => calls.push({ op: "moveTo", args: a }),
    lineTo: (...a: number[]) => calls.push({ op: "lineTo", args: a }),
    closePath: () => calls.push({ op: "closePath", args: [] }),
    fill: () => calls.push({ op: "fill", args: [] }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("drawLandMask", () => {
  it("clears to black, then draws every ring at offsets 0 and ±360", () => {
    const { ctx, calls } = fakeCtx();
    drawLandMask(ctx, [[[0, 0], [10, 0], [10, 10], [0, 0]]], 360, 180);
    expect(calls[0]).toEqual({ op: "fillRect", args: [0, 0, 360, 180] });
    const moves = calls.filter((c) => c.op === "moveTo").map((c) => c.args);
    // x = (lon + 180) / 360 * w；y = (90 - lat) / 180 * h
    expect(moves).toEqual([[180, 90], [-180, 90], [540, 90]]);
    expect(calls.filter((c) => c.op === "fill")).toHaveLength(3);
  });
  it("closes polar rings down to the pole so Antarctica fills", () => {
    const { ctx, calls } = fakeCtx();
    drawLandMask(ctx, [[[-180, -70], [0, -70], [180, -70]]], 360, 180);
    const ys = calls.filter((c) => c.op === "lineTo").map((c) => c.args[1]);
    expect(ys).toContain(180); // 补到南极
  });
  it("closes to the south pole by extreme latitude even if the first point is at low latitude", () => {
    const { ctx, calls } = fakeCtx();
    drawLandMask(ctx, [[[0, -10], [90, -60], [180, -80], [-90, -60], [0, -10]]], 360, 180);
    const lineYs = calls.filter((c) => c.op === "lineTo").map((c) => c.args[1]);
    expect(lineYs).toContain(180);
    expect(lineYs).not.toContain(0);
  });
  it("closes northern polar rings to the north pole", () => {
    const { ctx, calls } = fakeCtx();
    drawLandMask(ctx, [[[0, 70], [90, 80], [180, 85], [-90, 80], [0, 70]]], 360, 180);
    const lineYs = calls.filter((c) => c.op === "lineTo").map((c) => c.args[1]);
    expect(lineYs).toContain(0);
    expect(lineYs).not.toContain(180);
  });
});
