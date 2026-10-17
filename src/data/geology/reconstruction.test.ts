import { PaleoGeographyProvider } from "./PaleoGeographyProvider";
import { RECONSTRUCTION_MAX_MA, RECONSTRUCTION_SLICES, RECONSTRUCTION_TIMES_MA } from "./reconstruction";
import { PALEO_SLICES } from "./slices";

describe("plate reconstruction slices", () => {
  it("stay within the model range and are strictly increasing", () => {
    for (let i = 1; i < RECONSTRUCTION_TIMES_MA.length; i++) {
      expect(RECONSTRUCTION_TIMES_MA[i]).toBeGreaterThan(RECONSTRUCTION_TIMES_MA[i - 1]!);
    }
    expect(Math.max(...RECONSTRUCTION_TIMES_MA)).toBeLessThanOrEqual(RECONSTRUCTION_MAX_MA);
  });

  it("tile the timeline without gaps from the Holocene base to 1800 Ma, each containing its own reconstruction age", () => {
    const sorted = [...RECONSTRUCTION_SLICES].sort((a, b) => a.timeRange.toYearsAgo - b.timeRange.toYearsAgo);
    expect(sorted[0]!.timeRange.toYearsAgo).toBe(11_700);
    expect(sorted.at(-1)!.timeRange.fromYearsAgo).toBe(1_800_000_000);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.timeRange.toYearsAgo).toBe(sorted[i - 1]!.timeRange.fromYearsAgo);
    for (const s of RECONSTRUCTION_SLICES) {
      const t = s.reconstructionMa! * 1e6;
      expect(t).toBeLessThanOrEqual(s.timeRange.fromYearsAgo);
      expect(t).toBeGreaterThanOrEqual(s.timeRange.toYearsAgo);
      expect(s.isSchematic).toBe(false);
      expect(s.sourceIds).toContain("cao-2024");
    }
  });

  it("resolves: Holocene → modern coastline, deep time → reconstruction, beyond 1.8 Ga → missing", () => {
    const p = new PaleoGeographyProvider(PALEO_SLICES);
    expect(p.resolve(0).slice?.kind).toBe("modern-schematic");
    expect(p.resolve(11_700).slice?.kind).toBe("modern-schematic");
    expect(p.resolve(20_000).slice?.reconstructionMa).toBe(1);
    expect(p.resolve(251.9e6).slice?.reconstructionMa).toBe(260);
    expect(p.resolve(66e6).slice?.reconstructionMa).toBe(66);
    expect(p.resolve(1.8e9).status).toBe("exact");
    expect(p.resolve(2.5e9)).toMatchObject({ slice: null, status: "missing" });
  });
});
