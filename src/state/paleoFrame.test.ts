import { RECONSTRUCTION_SLICES } from "../data/geology/reconstruction";
import type { LonLat } from "../data/schema";
import { useGeographyStore } from "./geographyStore";
import { currentOutlines, currentPaleoFrame } from "./paleoFrame";
import { useTimeStore } from "./timeStore";

const slice100 = RECONSTRUCTION_SLICES.find((s) => s.reconstructionMa === 100)!;
const outlines: LonLat[][] = [[[0, 0], [10, 0]]];
const next: LonLat[][] = [[[20, 0], [30, 0]]];

describe("current paleo state", () => {
  beforeEach(() => {
    useGeographyStore.setState({ slice: slice100, outlines, next });
  });

  it("follows the simulated time", () => {
    useTimeStore.setState({ currentTimeYearsAgo: 90e6 });
    expect(currentPaleoFrame()).toEqual({ kind: "paleo", ma: 100, nextMa: 80, f: 0.5 });
    const a = currentOutlines()!;
    expect(a[0]![0]![0]).toBeCloseTo(10, 6);
    // 时间不变时复用同一结果
    expect(currentOutlines()).toBe(a);
    useTimeStore.setState({ currentTimeYearsAgo: 100e6 });
    expect(currentOutlines()).toBe(outlines);
  });

  it("does not morph without targets", () => {
    useGeographyStore.setState({ next: null });
    useTimeStore.setState({ currentTimeYearsAgo: 90e6 });
    expect(currentOutlines()).toBe(outlines);
  });
});
