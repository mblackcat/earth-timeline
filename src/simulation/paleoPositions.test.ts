import { EVENT_BY_ID } from "../data/events";
import type { LonLat, PaleoPointsFile } from "../data/schema";
import type { Frame } from "./paleoMorph";
import { eventPositionInFrame, speciesSitesInFrame } from "./paleoPositions";

/** 停在切片年代本身（f = 0）的参考系。 */
const at = (ma: number, nextMa: number): Frame => ({ kind: "paleo", ma, nextMa, f: 0 });

const paleo: PaleoPointsFile = {
  format: "ett-paleo-points/1",
  model: "CAO2024",
  sourceIds: [],
  generated: "",
  species: { trilobita: { "500": [[10, -20], null, [30, 5]] } },
  events: { "end-cretaceous-extinction": { "66": [-70, 30] } },
};
const modern: LonLat[] = [
  [1, 1],
  [2, 2],
  [3, 3],
];

describe("paleo positions", () => {
  it("uses modern coordinates outside reconstruction slices", () => {
    expect(speciesSitesInFrame("trilobita", modern, { kind: "modern" }, paleo)).toBe(modern);
    expect(eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, { kind: "modern" }, paleo)).toEqual([-89.5, 21.4]);
  });

  it("uses reconstructed coordinates and drops points that cannot be reconstructed", () => {
    expect(speciesSitesInFrame("trilobita", modern, at(500, 480), paleo)).toEqual([
      [10, -20],
      [30, 5],
    ]);
    expect(eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, at(66, 50), paleo)).toEqual([-70, 30]);
  });

  it("never falls back to modern coordinates in a reconstruction frame", () => {
    expect(speciesSitesInFrame("trilobita", modern, at(540, 520), paleo)).toEqual([]);
    expect(speciesSitesInFrame("trilobita", modern, at(500, 480), null)).toEqual([]);
    expect(eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, at(100, 80), paleo)).toBeNull();
    expect(eventPositionInFrame(EVENT_BY_ID["earth-formation"]!, at(66, 50), paleo)).toBeNull();
  });
});
