import type { LonLat } from "../data/schema";
import { angularDistanceDeg, horizonDeg, offsetLonLat } from "../utils/geo";
import type { AbundanceTier } from "./abundance";
import { seededRandom } from "./BehaviorSystem";
import { hashString } from "./hash";
import type { HabitatNeed } from "./herdTraits";
import { isLandAt, type LandGrid } from "./landGrid";

/**
 * 按丰度散布的生物群（设计：docs/superpowers/specs/2026-11-07-herds-design.md §2）。纯函数。
 * 个体挂在"物种 + 点下标 + 序号"上，偏移（方位角 + 角距离）固定，随点位漂移整体移动。
 */

/** 相机高度（地球半径）低于该值时显示生物群（实例档）。 */
export const HERD_MAX_ALTITUDE = 4;
/** 低于该高度为洲视图：植物更茂密，动物可升为完整档。 */
export const CONTINENT_ALTITUDE = 1.2;

const FAR_COUNT: Record<AbundanceTier, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };

export function individualsPerSite(tier: AbundanceTier, stationary: boolean, continental: boolean): number {
  return FAR_COUNT[tier] * (continental && stationary ? 3 : 1);
}

/** 散布半径（度）：0.3°–1.2°，按丰度等级线性增大。 */
export function scatterRadiusDeg(tier: AbundanceTier): number {
  return (3 * tier) / 10; // 避免 0.3 * 3 的浮点误差
}

export interface HerdSpeciesInput {
  speciesId: string;
  /** 当前参考系下可重建的点位。 */
  sites: LonLat[];
  /** 与 sites 一一对应：点在原始点列表（化石点或 GBIF 点）中的下标。 */
  siteIndex: number[];
  perSite: number;
  radiusDeg: number;
  need: HabitatNeed;
  /** 点列表来源（默认化石点）：写进个体键，GBIF 点与化石点的同一下标不会撞键。不影响散布种子。 */
  source?: "fossil" | "gbif";
}

/** 个体键：物种 + 来源标记（f = 化石点，g = GBIF 点）与点下标 + 序号。 */
export function herdKey(speciesId: string, source: HerdSpeciesInput["source"], siteIndex: number, k: number): string {
  return `${speciesId}#${source === "gbif" ? "g" : "f"}${siteIndex}#${k}`;
}

export interface HerdIndividual {
  key: string;
  speciesId: string;
  siteIndex: number;
  k: number;
  /** 相对点位的方位角（弧度）与角距离（度）。 */
  bearing: number;
  distDeg: number;
  /** 模型朝向（弧度，从北向东）与动画相位。 */
  heading: number;
  phase: number;
}

const fits = (g: LandGrid, p: LonLat, need: HabitatNeed) => need === "any" || isLandAt(g, p) === (need === "land");

function scatterSite(s: HerdSpeciesInput, i: number, grid: LandGrid | null, count = s.perSite): HerdIndividual[] {
  const siteIndex = s.siteIndex[i]!;
  const center = s.sites[i]!;
  const rand = seededRandom(hashString(`${s.speciesId}@${siteIndex}`));
  // 点位本身不符合生境（粗分辨率海岸线下常见）时不检查周围个体
  const check = grid !== null && s.need !== "any" && fits(grid, center, s.need);
  const out: HerdIndividual[] = [];
  for (let k = 0; k < count; k++) {
    let bearing = 0;
    let distDeg = 0;
    let ok = k === 0;
    for (let t = 0; !ok && t < 3; t++) {
      bearing = rand() * Math.PI * 2;
      distDeg = Math.sqrt(rand()) * s.radiusDeg;
      ok = !check || fits(grid!, offsetLonLat(center, bearing, distDeg), s.need);
    }
    const heading = rand() * Math.PI * 2;
    const phase = rand() * 10;
    if (ok) out.push({ key: herdKey(s.speciesId, s.source, siteIndex, k), speciesId: s.speciesId, siteIndex, k, bearing, distDeg, heading, phase });
  }
  return out;
}

/**
 * 选点并散布：只取地平线以内的点；每个物种先保留哈希排名最靠前的一个点，
 * 其余点按固定哈希排名依次加入，直到个体总数达到 cap。排名与视角无关，相机小幅移动时选点稳定。
 */
export function buildHerd(species: HerdSpeciesInput[], view: { center: LonLat; altitude: number }, cap: number, grid: LandGrid | null): HerdIndividual[] {
  const limit = horizonDeg(view.altitude) + 3;
  type C = { s: HerdSpeciesInput; i: number; rank: number };
  const firsts: C[] = [];
  const rest: C[] = [];
  for (const s of species) {
    let best: C | null = null;
    for (let i = 0; i < s.sites.length; i++) {
      if (angularDistanceDeg(view.center, s.sites[i]!) > limit) continue;
      const c: C = { s, i, rank: hashString(`${s.speciesId}#${s.siteIndex[i]}`) };
      if (!best || c.rank < best.rank) {
        if (best) rest.push(best);
        best = c;
      } else rest.push(c);
    }
    if (best) firsts.push(best);
  }
  rest.sort((a, b) => a.rank - b.rank);
  const out: HerdIndividual[] = [];
  // 每个物种至少 1 个个体；首个点的个数也受 cap 约束（截断时保留相同的前几个个体）
  for (const c of firsts) out.push(...scatterSite(c.s, c.i, grid, Math.max(1, Math.min(c.s.perSite, cap - out.length))));
  for (const c of rest) if (out.length + c.s.perSite <= cap) out.push(...scatterSite(c.s, c.i, grid));
  return out;
}
