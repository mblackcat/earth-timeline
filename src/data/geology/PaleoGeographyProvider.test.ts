import type { PaleoGeographySlice } from "../schema";
import { PaleoGeographyProvider } from "./PaleoGeographyProvider";
import { PALEO_SLICES } from "./slices";

const slice = (id: string, from: number, to: number): PaleoGeographySlice => ({
  id,
  label: id,
  timeRange: { fromYearsAgo: from, toYearsAgo: to },
  kind: "reconstruction",
  isSchematic: true,
  dataUrl: `${id}.json`,
  evidenceLevel: "estimated",
  sourceIds: [],
  note: "",
});

describe("PaleoGeographyProvider.resolve", () => {
  const slices = [slice("a", 300e6, 250e6), slice("b", 100e6, 66e6)];

  it("returns the slice covering the time (closed interval)", () => {
    const p = new PaleoGeographyProvider(slices);
    expect(p.resolve(300e6)).toMatchObject({ status: "exact", slice: { id: "a" } });
    expect(p.resolve(66e6)).toMatchObject({ status: "exact", slice: { id: "b" } });
  });

  it("reports missing data by default instead of borrowing another period", () => {
    const p = new PaleoGeographyProvider(slices);
    expect(p.resolve(200e6)).toMatchObject({ status: "missing", slice: null });
    expect(p.resolve(4.5e9).status).toBe("missing");
  });

  it("borrows the nearest slice only within the configured tolerance", () => {
    const p = new PaleoGeographyProvider(slices, { fallbackToleranceYears: 20e6 });
    expect(p.resolve(240e6)).toMatchObject({ status: "fallback", slice: { id: "a" } });
    expect(p.resolve(110e6)).toMatchObject({ status: "fallback", slice: { id: "b" } });
    expect(p.resolve(180e6).status).toBe("missing");
  });

  it("does not present the modern coastline as deep-time geography", () => {
    const p = new PaleoGeographyProvider(PALEO_SLICES);
    expect(p.resolve(0).slice?.kind).toBe("modern-schematic");
    expect(p.resolve(252e6).slice).toBeNull();
    expect(PALEO_SLICES.every((s) => s.kind !== "modern-schematic" || s.isSchematic)).toBe(true);
  });
});

describe("PaleoGeographyProvider.load", () => {
  const valid = { format: "ett-outlines/1", sourceId: "x", outlines: [[[0, 0], [1, 1]]] };

  it("caches successful loads", async () => {
    const fetchJson = vi.fn().mockResolvedValue(valid);
    const p = new PaleoGeographyProvider([slice("a", 1, 0)], { fetchJson });
    const s = p.resolve(0).slice!;
    await p.load(s);
    await p.load(s);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid data and allows retry after failure", async () => {
    const fetchJson = vi.fn().mockResolvedValueOnce({ nope: true }).mockResolvedValueOnce(valid);
    const p = new PaleoGeographyProvider([slice("a", 1, 0)], { fetchJson });
    const s = p.resolve(0).slice!;
    await expect(p.load(s)).rejects.toThrow(/格式无效/);
    await expect(p.load(s)).resolves.toMatchObject({ sourceId: "x" });
  });
});
