import { GEO_RANKS, GEO_UNITS, GEO_UNIT_BY_ID, describeGeoPeriod, geoPathAt, unitAt } from "./timescale";

describe("ICS timescale data", () => {
  it.each(GEO_RANKS)("%s units are contiguous, ordered old → young and well-formed", (rank) => {
    const units = GEO_UNITS[rank];
    for (const [i, u] of units.entries()) {
      expect(u.range.fromYearsAgo).toBeGreaterThan(u.range.toYearsAgo);
      expect(u.color).toMatch(/^#[0-9A-F]{6}$/i);
      const next = units[i + 1];
      if (next) expect(next.range.fromYearsAgo).toBe(u.range.toYearsAgo);
    }
  });

  it("nests every unit inside its parent", () => {
    for (const rank of GEO_RANKS.slice(1)) {
      for (const u of GEO_UNITS[rank]) {
        const parent = GEO_UNIT_BY_ID[u.parentId!]!;
        expect(parent, u.id).toBeDefined();
        expect(u.range.fromYearsAgo).toBeLessThanOrEqual(parent.range.fromYearsAgo);
        expect(u.range.toYearsAgo).toBeGreaterThanOrEqual(parent.range.toYearsAgo);
      }
    }
  });

  it("uses ICS v2024/12 boundary ages", () => {
    const from = (id: string) => GEO_UNIT_BY_ID[id]!.range.fromYearsAgo;
    expect(from("cambrian")).toBe(538_800_000);
    expect(from("ordovician")).toBe(486_850_000);
    expect(from("devonian")).toBe(419_620_000);
    expect(from("triassic")).toBe(251_902_000);
    expect(from("cretaceous")).toBe(143_100_000);
    expect(from("paleogene")).toBe(66_000_000);
    expect(from("neogene")).toBe(23_040_000);
    expect(from("quaternary")).toBe(2_580_000);
    expect(from("holocene")).toBe(11_700);
  });

  it("resolves the units at a given time; boundaries belong to the younger unit", () => {
    expect(unitAt("period", 66_000_000)?.id).toBe("paleogene");
    expect(unitAt("period", 66_000_001)?.id).toBe("cretaceous");
    expect(unitAt("epoch", 0)?.id).toBe("holocene");
    expect(unitAt("epoch", 1_000_000_000)).toBeNull(); // 前寒武纪没有"世"
    expect(geoPathAt(150_000_000)).toMatchObject({
      eon: { id: "phanerozoic" },
      era: { id: "mesozoic" },
      period: { id: "jurassic" },
      epoch: { id: "late-jurassic" },
    });
    expect(describeGeoPeriod(3_000_000_000)).toBe("太古宙 · 中太古代");
  });
});
