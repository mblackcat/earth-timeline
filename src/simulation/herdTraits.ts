import type { AnimationClipName, Diet, HabitatId, Species, VisualizationAsset } from "../data/schema";
import { abundanceTier, type AbundanceTier } from "./abundance";

const LAND: HabitatId[] = ["terrestrial", "forest", "steppe", "wetland"];

/** 散布时的海陆要求：只有纯海洋生物必须在海里；淡水 / 滨海生物不检查（内陆水体在遮罩上是陆地）。 */
export type HabitatNeed = "land" | "water" | "any";

export function placementNeed(h: HabitatId[]): HabitatNeed {
  if (h.includes("coastal") || h.includes("freshwater")) return "any";
  const land = h.some((x) => LAND.includes(x));
  const sea = h.includes("marine");
  if (land && sea) return "any";
  return land ? "land" : sea ? "water" : "any";
}

/** 追逐配对用的生境组：陆生 / 水生，滨海两者都算。 */
export interface HabitatGroups {
  land: boolean;
  water: boolean;
}

export function habitatGroups(h: HabitatId[]): HabitatGroups {
  const coastal = h.includes("coastal");
  return { land: coastal || h.some((x) => LAND.includes(x)), water: coastal || h.includes("marine") || h.includes("freshwater") };
}

export function shareHabitat(a: HabitatGroups, b: HabitatGroups): boolean {
  return (a.land && b.land) || (a.water && b.water);
}

/** 丰度等级：使用 GBIF 现代分布显示的现生类群按 GBIF 记录数，其余按 PBDB 化石记录数。 */
export function speciesTier(pbdbOccurrences: number, gbifRecords: number | undefined): AbundanceTier {
  return gbifRecords !== undefined ? abundanceTier(gbifRecords, "gbif") : abundanceTier(pbdbOccurrences);
}

/** 行为系统需要的个体特征（与渲染无关）。clips 为该原型实际实现的动画片段。 */
export interface HerdTraits {
  speciesId: string;
  diet: Diet | undefined;
  sizeM: number;
  locomotion: VisualizationAsset["locomotion"];
  groups: HabitatGroups;
  canEat: boolean;
  canSleep: boolean;
  /** 古人类不参与追逐（避免不当暗示）。 */
  hominin: boolean;
  /** 植食 / 滤食：同一点位的个体成群移动。 */
  herds: boolean;
}

export function traitsFor(species: Species, asset: VisualizationAsset, clips: AnimationClipName[]): HerdTraits {
  return {
    speciesId: species.id,
    diet: species.diet,
    sizeM: asset.sizeM,
    locomotion: asset.locomotion,
    groups: habitatGroups(species.habitatIds),
    canEat: clips.includes("eat") && asset.animationSet.includes("eat"),
    canSleep: clips.includes("sleep") && asset.locomotion !== "fly" && asset.locomotion !== "none",
    hominin: asset.archetype === "hominin",
    herds: asset.locomotion !== "none" && (species.diet === "herbivore" || species.diet === "filter"),
  };
}
