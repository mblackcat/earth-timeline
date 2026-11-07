import { SPECIES_BY_ID } from "../data/species";
import { VISUAL_BY_ID } from "../data/visuals";
import { clipsFor } from "../scene/Models/animation";
import { habitatGroups, placementNeed, shareHabitat, speciesTier, traitsFor } from "./herdTraits";

const traits = (id: string) => {
  const s = SPECIES_BY_ID[id]!;
  const a = VISUAL_BY_ID[s.visualizationId!]!;
  return traitsFor(s, a, clipsFor(a.archetype));
};

describe("herd traits", () => {
  it("placement need: only marine-only life must be at sea, freshwater / coastal life can be anywhere", () => {
    expect(placementNeed(["marine"])).toBe("water");
    expect(placementNeed(["terrestrial", "forest"])).toBe("land");
    expect(placementNeed(["freshwater", "wetland"])).toBe("any");
    expect(placementNeed(["coastal", "marine"])).toBe("any");
    expect(placementNeed(["marine", "terrestrial"])).toBe("any");
  });

  it("habitat groups for chase pairing", () => {
    expect(habitatGroups(["coastal"])).toEqual({ land: true, water: true });
    expect(habitatGroups(["freshwater"])).toEqual({ land: false, water: true });
    expect(shareHabitat(habitatGroups(["steppe"]), habitatGroups(["marine"]))).toBe(false);
    expect(shareHabitat(habitatGroups(["wetland"]), habitatGroups(["freshwater", "wetland"]))).toBe(true);
  });

  it("tier uses GBIF records for living taxa shown with present-day ranges, PBDB otherwise", () => {
    expect(speciesTier(5000, undefined)).toBe(4);
    expect(speciesTier(5000, 100)).toBe(1);
    expect(speciesTier(0, undefined)).toBe(1);
  });

  it("derives traits from species and visual data", () => {
    const allo = traits("allosaurus");
    expect(allo).toMatchObject({ diet: "carnivore", locomotion: "walk", groups: { land: true, water: false }, canSleep: true, hominin: false, herds: false });
    expect(traits("homo-sapiens").hominin).toBe(true);
    expect(traits("pteranodon").canSleep).toBe(false); // 飞行
    expect(traits("poaceae").canSleep).toBe(false); // 植物
    expect(traits("triceratops").herds).toBe(true);
    expect(traits("balaenoptera-musculus").herds).toBe(true); // 滤食
  });
});
