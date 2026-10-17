import { EVENT_BY_ID } from "../data/events";
import type { LonLat, PaleoPointsFile } from "../data/schema";
import { eventPositionInFrame, frameFor, speciesSitesInFrame } from "./paleoPositions";

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
    expect(frameFor(undefined)).toEqual({ kind: "modern" });
    expect(speciesSitesInFrame("trilobita", modern, frameFor(undefined), paleo)).toBe(modern);
    expect(eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, { kind: "modern" }, paleo)).toEqual([-89.5, 21.4]);
  });

  it("uses reconstructed coordinates and drops points that cannot be reconstructed", () => {
    expect(speciesSitesInFrame("trilobita", modern, frameFor(500), paleo)).toEqual([
      [10, -20],
      [30, 5],
    ]);
    expect(eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, frameFor(66), paleo)).toEqual([-70, 30]);
  });

  it("never falls back to modern coordinates in a reconstruction frame", () => {
    expect(speciesSitesInFrame("trilobita", modern, frameFor(520), paleo)).toEqual([]);
    expect(speciesSitesInFrame("trilobita", modern, frameFor(500), null)).toEqual([]);
    expect(eventPositionInFrame(EVENT_BY_ID["end-cretaceous-extinction"]!, frameFor(80), paleo)).toBeNull();
    expect(eventPositionInFrame(EVENT_BY_ID["earth-formation"]!, frameFor(66), paleo)).toBeNull();
  });
});
