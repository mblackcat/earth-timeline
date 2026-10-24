import { EVENTS } from "../data/events";
import { SPECIES } from "../data/species";
import { isWithinTimeRange } from "../data/schema";
import {
  eventAnchorLonLat,
  eventEmphasisAt,
  eventWindowYears,
  isSpeciesAlive,
  resolveVisible,
  sphericalCentroid,
  visibleSetKey,
} from "./VisibilityResolver";

const byId = <T extends { id: string }>(xs: T[], id: string) => xs.find((x) => x.id === id)!;
const visibleAt = (yearsAgo: number, playingRate = 0) =>
  resolveVisible(EVENTS, SPECIES, { yearsAgo, playingRate, showEvents: true, showSpecies: true });

describe("species visibility", () => {
  it("shows species only within their range (inclusive) and never outside", () => {
    const trex = byId(SPECIES, "tyrannosaurus-rex");
    expect(isSpeciesAlive(trex, 72_200_000)).toBe(true);
    expect(isSpeciesAlive(trex, 66_000_000)).toBe(true);
    expect(isSpeciesAlive(trex, 65_999_999)).toBe(false);
    expect(isSpeciesAlive(trex, 72_200_001)).toBe(false);
  });

  it("different periods show different species", () => {
    const ids = (t: number) => visibleAt(t).species.map((s) => s.id);
    // 恰好是生存范围包含该时刻的物种（严格按范围，PLAN §2.1）
    const expected = (t: number) => SPECIES.filter((s) => isWithinTimeRange(s.time, t)).map((s) => s.id);
    for (const t of [500e6, 300e6, 150e6, 68e6, 1e6, 200_000, 0, 4e9]) expect(ids(t), String(t)).toEqual(expected(t));
    expect(ids(500e6)).toContain("trilobita");
    expect(ids(68e6)).toContain("tyrannosaurus-rex");
    expect(ids(68e6)).not.toContain("trilobita");
    expect(ids(200_000)).toEqual(expect.arrayContaining(["mammuthus-primigenius", "homo-erectus", "homo-sapiens"]));
    expect(ids(0)).toContain("homo-sapiens");
    expect(ids(0)).not.toContain("tyrannosaurus-rex");
    expect(ids(4e9)).toEqual([]);
  });

  it("respects the layer switches", () => {
    const v = resolveVisible(EVENTS, SPECIES, { yearsAgo: 68e6, playingRate: 0, showEvents: false, showSpecies: false });
    expect(v.events).toEqual([]);
    expect(v.species).toEqual([]);
  });
});

describe("event visibility", () => {
  const kpg = byId(EVENTS, "end-cretaceous-extinction");

  it("is active within the true range (including uncertainty) and near within the display window", () => {
    expect(eventEmphasisAt(kpg, 66_000_000)).toBe("active");
    expect(eventEmphasisAt(kpg, 66_010_000)).toBe("active"); // ± 11 ka
    expect(eventEmphasisAt(kpg, 67_000_000)).toBe("near");
    expect(eventEmphasisAt(kpg, 80_000_000)).toBeNull();
  });

  it("widens the window while playing fast so instant events stay visible ~3 s", () => {
    expect(eventWindowYears(kpg, 0)).toBeCloseTo(2_640_000, 0);
    expect(eventWindowYears(kpg, 10_000_000)).toBe(30_000_000);
    expect(eventEmphasisAt(kpg, 90_000_000, 10_000_000)).toBe("near");
  });

  it("sorts visible events by distance to the current time", () => {
    const ev = visibleAt(0).events.map((e) => e.event.id);
    expect(ev[0]).toBe("present");
  });

  it("produces a stable key that changes only with the visible set", () => {
    expect(visibleSetKey(visibleAt(68e6))).toBe(visibleSetKey(visibleAt(68.1e6)));
    expect(visibleSetKey(visibleAt(68e6))).not.toBe(visibleSetKey(visibleAt(500e6)));
  });
});

describe("geo helpers", () => {
  it("places events by point, sites or region centre; global events have no anchor", () => {
    expect(eventAnchorLonLat(byId(EVENTS, "end-cretaceous-extinction"))).toEqual([-89.5, 21.4]);
    expect(eventAnchorLonLat(byId(EVENTS, "early-dinosaurs"))).toEqual([-67.8, -30.0]);
    expect(eventAnchorLonLat(byId(EVENTS, "early-writing"))).toEqual([45, 32]);
    expect(eventAnchorLonLat(byId(EVENTS, "earth-formation"))).toBeNull();
  });

  it("computes a spherical centroid that handles the antimeridian", () => {
    const [lon, lat] = sphericalCentroid([
      [179, 10],
      [-179, 10],
    ])!;
    expect(Math.abs(lon)).toBeCloseTo(180, 6);
    expect(lat).toBeCloseTo(10, 1);
    expect(sphericalCentroid([])).toBeNull();
  });
});
