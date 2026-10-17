import pointsRaw from "../../../public/data/geography/cao2024/points.json?raw";
import sitesRaw from "../../../public/data/species/pbdb-sites.json?raw";
import { EVENTS } from "../events";
import type { FossilSitesFile, PaleoGeographyOutlines, PaleoPointsFile } from "../schema";
import { SPECIES } from "../species";
import { RECONSTRUCTION_SLICES } from "./reconstruction";

/** 生成的静态数据（scripts/fetch-paleogeography.mjs）与切片 / 物种定义保持一致。 */
const files = import.meta.glob<string>("/public/data/geography/cao2024/[0-9]*.json", { query: "?raw", import: "default", eager: true });
const points = JSON.parse(pointsRaw) as PaleoPointsFile;
const sites = JSON.parse(sitesRaw) as FossilSitesFile;
const overlaps = (s: (typeof RECONSTRUCTION_SLICES)[number], older: number, younger: number) =>
  s.timeRange.fromYearsAgo >= younger && s.timeRange.toYearsAgo <= older;

describe("generated reconstruction data", () => {
  it.each(RECONSTRUCTION_SLICES.map((s) => [s.reconstructionMa!, s] as const))("%i Ma coastline file is present, valid and compact", (ma) => {
    const raw = files[`/public/data/geography/cao2024/${ma}.json`];
    expect(raw, `${ma}.json`).toBeDefined();
    expect(raw!.length).toBeLessThan(200_000);
    const f = JSON.parse(raw!) as PaleoGeographyOutlines;
    expect(f.format).toBe("ett-outlines/1");
    expect(f.sourceId).toBe("cao-2024");
    expect(f.outlines.length).toBeGreaterThan(5);
    for (const ring of f.outlines) for (const [lon, lat] of ring) expect(Math.abs(lon) <= 180 && Math.abs(lat) <= 90).toBe(true);
  });

  it("has reconstructed fossil sites for every slice a species lives in, aligned with the modern sites", () => {
    expect(points.model).toBe("CAO2024");
    for (const sp of SPECIES) {
      const expected = RECONSTRUCTION_SLICES.filter((s) => overlaps(s, sp.time.fromYearsAgo, sp.time.toYearsAgo)).map((s) => String(s.reconstructionMa));
      expect(Object.keys(points.species[sp.id] ?? {}).sort(), sp.id).toEqual(expected.sort());
      for (const k of expected) expect(points.species[sp.id]![k]!.length).toBe(sites.species[sp.id]!.sites.length);
    }
  });

  it("has reconstructed positions for located events", () => {
    const kpg = points.events["end-cretaceous-extinction"];
    expect(kpg?.["66"]).toBeTruthy();
    expect(Object.keys(points.events).every((id) => EVENTS.some((e) => e.id === id))).toBe(true);
  });
});
