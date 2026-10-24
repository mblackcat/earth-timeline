import sitesRaw from "../../../public/data/species/pbdb-sites.json?raw";
import { PBDB_NAMES, SPECIES } from "./index";
import { SOURCES } from "../sources";
import { GEO_UNITS } from "../geology/timescale";
import { VISUAL_BY_ID } from "../visuals";
import { ARCHETYPES } from "../../scene/Models/builders";
import type { FossilSitesFile } from "../schema";

const sitesFile = JSON.parse(sitesRaw) as FossilSitesFile;

describe("representative species (PLAN §5.3)", () => {
  it.each(SPECIES.map((s) => [s.id, s] as const))("%s is well-formed and sourced", (_id, s) => {
    expect(s.time.fromYearsAgo).toBeGreaterThan(s.time.toYearsAgo - 1e-9);
    expect(s.time.toYearsAgo).toBeGreaterThanOrEqual(0);
    expect(s.sourceIds.length).toBeGreaterThan(0);
    for (const id of s.sourceIds) expect(SOURCES[id], `${s.id} → ${id}`).toBeDefined();
    expect(s.evidenceNote).toMatch(/^\[(文献|地层|PBDB)/);
    expect(s.habitatIds.length).toBeGreaterThan(0);
    expect(s.isSample).toBeFalsy();
    expect(PBDB_NAMES[s.id]).toBeDefined();
  });

  it("covers the categories PLAN asks for", () => {
    const ids = SPECIES.map((s) => s.id);
    for (const id of ["trilobita", "haikouichthys", "cooksonia", "eryops", "tyrannosaurus-rex", "pteranodon", "morganucodon", "mammuthus-primigenius", "australopithecus-afarensis", "homo-sapiens"]) {
      expect(ids).toContain(id);
    }
  });

  it("every Paleozoic and Mesozoic period has at least 3 species, including plants overall", () => {
    // 第 1 批覆盖寒武纪至白垩纪；新生代各纪由第 2 批补齐
    for (const p of GEO_UNITS.period.filter((u) => u.range.fromYearsAgo <= 538_800_000 && u.range.toYearsAgo >= 66_000_000)) {
      const living = SPECIES.filter((s) => s.time.fromYearsAgo > p.range.toYearsAgo && s.time.toYearsAgo < p.range.fromYearsAgo);
      expect(living.length, p.name).toBeGreaterThanOrEqual(3);
    }
    // 志留纪起每个纪都有陆生植物
    for (const p of GEO_UNITS.period.filter((u) => u.range.fromYearsAgo <= 443_100_000 && u.range.toYearsAgo >= 66_000_000)) {
      expect(SPECIES.some((s) => s.taxonomy?.kingdom === "Plantae" && s.time.fromYearsAgo > p.range.toYearsAgo && s.time.toYearsAgo < p.range.fromYearsAgo), p.name).toBe(true);
    }
  });

  it("ids are unique and every model archetype is used by some species", () => {
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(SPECIES.length);
    const used = new Set(SPECIES.map((s) => VISUAL_BY_ID[s.visualizationId!]!.archetype));
    for (const a of ARCHETYPES) expect(used, a).toContain(a);
  });

  it("fossil-site data was generated with exactly the same ranges and names", () => {
    expect(sitesFile.format).toBe("ett-fossil-sites/1");
    expect(sitesFile.sourceId).toBe("pbdb");
    for (const s of SPECIES) {
      const entry = sitesFile.species[s.id];
      expect(entry, s.id).toBeDefined();
      expect(entry!.pbdbName).toBe(PBDB_NAMES[s.id]);
      expect(entry!.filterMa[0] * 1e6).toBeCloseTo(s.time.fromYearsAgo, 0);
      expect(entry!.filterMa[1] * 1e6).toBeCloseTo(s.time.toYearsAgo, -1);
      expect(entry!.sites.length).toBeGreaterThan(0);
      for (const [lon, lat] of entry!.sites) {
        expect(Math.abs(lon)).toBeLessThanOrEqual(180);
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
  });
});
