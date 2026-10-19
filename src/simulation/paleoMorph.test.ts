import { EVENT_BY_ID } from "../data/events";
import type { LonLat, PaleoGeographySlice, PaleoPointsFile } from "../data/schema";
import { RECONSTRUCTION_SLICES } from "../data/geology/reconstruction";
import {
  fillMissingTargets,
  rejectInconsistentTargets,
  rejectStretchedRuns,
  morphFraction,
  morphOutlines,
  paleoFrame,
  rotateLike,
  slerpLonLat,
} from "./paleoMorph";
import { eventPositionInFrame, speciesSitesInFrame } from "./paleoPositions";

const slice100 = RECONSTRUCTION_SLICES.find((s) => s.reconstructionMa === 100)!;
const slice1 = RECONSTRUCTION_SLICES.find((s) => s.reconstructionMa === 1)!;
const modern = { kind: "modern-schematic", timeRange: { fromYearsAgo: 11_700, toYearsAgo: 0 } } as PaleoGeographySlice;

const close = (a: LonLat, b: LonLat, digits = 6) => {
  expect(a[0]).toBeCloseTo(b[0], digits);
  expect(a[1]).toBeCloseTo(b[1], digits);
};

describe("morphFraction", () => {
  it("is 0 at the slice age, 1 at the next younger age, linear in between", () => {
    expect(slice100.nextReconstructionMa).toBe(80);
    expect(morphFraction(slice100, 100e6)).toBe(0);
    expect(morphFraction(slice100, 90e6)).toBeCloseTo(0.5, 12);
    expect(morphFraction(slice100, 80e6)).toBe(1);
    expect(morphFraction(slice100, 120e6)).toBe(0);
    expect(morphFraction(slice100, 10e6)).toBe(1);
  });

  it("the youngest slice morphs to the present", () => {
    expect(slice1.nextReconstructionMa).toBe(0);
    expect(morphFraction(slice1, 0.5e6)).toBeCloseTo(0.5, 12);
  });
});

describe("slerpLonLat", () => {
  it("returns the endpoints at f = 0 / 1", () => {
    close(slerpLonLat([10, 20], [30, -5], 0), [10, 20]);
    close(slerpLonLat([10, 20], [30, -5], 1), [30, -5]);
  });

  it("follows the great circle (equator midpoint)", () => {
    close(slerpLonLat([0, 0], [90, 0], 0.5), [45, 0]);
  });

  it("takes the short way across the dateline", () => {
    close(slerpLonLat([170, 0], [-170, 0], 0.5), [180, 0]);
  });

  it("handles identical points", () => {
    close(slerpLonLat([12, 34], [12, 34], 0.3), [12, 34]);
  });
});

describe("rotateLike", () => {
  it("moves a nearby point the same way as its neighbour", () => {
    // 沿赤道东移 10°：附近的点也东移约 10°
    const p = rotateLike([0, 0], [10, 0], [1, 1]);
    close(p, [11, 1], 3);
  });
});

describe("fillMissingTargets", () => {
  it("borrows the displacement of the nearest valid vertex in the ring", () => {
    const ring: LonLat[] = [[0, 0], [1, 0], [2, 0], [3, 0]];
    const next: (LonLat | null)[] = [[10, 0], null, null, [13, 0]];
    const out = fillMissingTargets(ring, next);
    close(out[1]!, [11, 0], 3);
    close(out[2]!, [12, 0], 3);
  });

  it("keeps the ring in place when nothing is valid", () => {
    const ring: LonLat[] = [[0, 0], [1, 0]];
    expect(fillMissingTargets(ring, [null, null])).toEqual(ring);
  });
});

describe("rejectInconsistentTargets", () => {
  it("drops a vertex whose displacement disagrees with its ring neighbours (wrong plate assignment)", () => {
    const ring: LonLat[] = Array.from({ length: 12 }, (_, i) => [i, 0] as LonLat);
    // 整个环东移 2°，第 5 个点被错配到别的板块、跳到 40° 外
    const next: (LonLat | null)[] = ring.map(([lon, lat]) => [lon + 2, lat] as LonLat);
    next[5] = [45, 30];
    next[8] = null;
    const out = rejectInconsistentTargets(ring, next);
    expect(out[5]).toBeNull();
    expect(out[8]).toBeNull();
    expect(out.filter((p) => p !== null)).toHaveLength(10);
    expect(out[4]).toEqual([6, 0]);
  });

  it("keeps a ring that moves coherently, even fast", () => {
    const ring: LonLat[] = Array.from({ length: 8 }, (_, i) => [i, 10] as LonLat);
    const next = ring.map(([lon, lat]) => [lon + 25, lat - 5] as LonLat);
    expect(rejectInconsistentTargets(ring, next)).toEqual(next);
  });
});

describe("rejectStretchedRuns", () => {
  it("drops a run of vertices that moved together but tore away from the rest of the ring", () => {
    const ring: LonLat[] = Array.from({ length: 20 }, (_, i) => [i, 0] as LonLat);
    const next = ring.map(([lon, lat]) => [lon + 1, lat] as LonLat);
    for (let i = 6; i <= 9; i++) next[i] = [ring[i]![0] + 40, 20];
    const out = rejectStretchedRuns(ring, next);
    for (let i = 6; i <= 9; i++) expect(out[i]).toBeNull();
    expect(out.filter((p) => p !== null)).toHaveLength(16);
  });

  it("keeps rings without torn edges unchanged", () => {
    const ring: LonLat[] = Array.from({ length: 6 }, (_, i) => [i, 0] as LonLat);
    const next = ring.map(([lon, lat]) => [lon + 5, lat + 3] as LonLat);
    expect(rejectStretchedRuns(ring, next)).toEqual(next);
  });
});

describe("morphOutlines", () => {
  it("matches both ends", () => {
    const a: LonLat[][] = [[[0, 0], [10, 10]]];
    const b: LonLat[][] = [[[5, 0], [15, 10]]];
    expect(morphOutlines(a, b, 0)).toEqual(a);
    morphOutlines(a, b, 1)[0]!.forEach((p, i) => close(p, b[0]![i]!));
  });
});

describe("paleoFrame and interpolated positions", () => {
  const paleo = {
    format: "ett-paleo-points/1",
    model: "CAO2024",
    sourceIds: [],
    generated: "",
    species: { sp: { "100": [[0, 0], null, [5, 5], null], "80": [[10, 0], [20, 0], null, null] } },
    events: { "end-cretaceous-extinction": { "80": [0, 0], "66": [10, 0] } },
  } as PaleoPointsFile;

  it("is modern outside reconstruction slices", () => {
    expect(paleoFrame(modern, 5_000)).toEqual({ kind: "modern" });
    expect(paleoFrame(null, 5_000)).toEqual({ kind: "modern" });
  });

  it("interpolates between both ends; uses the only available end; drops points missing at both", () => {
    const frame = paleoFrame(slice100, 90e6);
    expect(frame).toEqual({ kind: "paleo", ma: 100, nextMa: 80, f: 0.5 });
    const sites = speciesSitesInFrame("sp", [[0, 0], [0, 0], [0, 0], [0, 0]], frame, paleo);
    expect(sites).toHaveLength(3);
    close(sites[0]!, [5, 0]);
    close(sites[1]!, [20, 0]);
    close(sites[2]!, [5, 5]);
  });

  it("uses modern coordinates as the target of the youngest slice", () => {
    const p = { ...paleo, species: { sp: { "1": [[0, 0]] } } } as PaleoPointsFile;
    const sites = speciesSitesInFrame("sp", [[10, 0]], paleoFrame(slice1, 0.5e6), p);
    close(sites[0]!, [5, 0]);
  });

  it("interpolates event positions", () => {
    const slice80 = RECONSTRUCTION_SLICES.find((s) => s.reconstructionMa === 80)!;
    const pos = eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, paleoFrame(slice80, 73e6), paleo);
    close(pos!, [5, 0]);
  });
});
