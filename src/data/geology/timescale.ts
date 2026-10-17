import type { TimeRange } from "../schema";

/**
 * 地质年代表：宙 / 代 / 纪 / 世（PLAN §4.2）。
 *
 * 边界数值取自 ICS International Chronostratigraphic Chart v2024/12
 * （来源 id `ics-chart-2024-12`），单位 Ma，载入时转换为 yearsAgo。
 * 带 "~" 的近似边界用 `approximate: true` 标注。
 * 颜色遵循 CGMW 配色（十六进制为常用近似值）；
 * "世"一级只收录显生宙，前寒武纪没有正式的世。
 */

export type GeoRank = "eon" | "era" | "period" | "epoch";

export interface GeoUnit {
  id: string;
  rank: GeoRank;
  name: string;
  nameEn: string;
  parentId: string | null;
  range: TimeRange;
  color: string;
  approximate?: boolean;
}

export const GEO_RANKS: GeoRank[] = ["eon", "era", "period", "epoch"];
export const GEO_RANK_LABELS: Record<GeoRank, string> = { eon: "宙", era: "代", period: "纪", epoch: "世" };
export const TIMESCALE_SOURCE_ID = "ics-chart-2024-12";

type Row = [id: string, name: string, nameEn: string, parentId: string | null, fromMa: number, toMa: number, color: string, approx?: true];

const EONS: Row[] = [
  ["hadean", "冥古宙", "Hadean", null, 4567, 4031, "#AE027E"],
  ["archean", "太古宙", "Archean", null, 4031, 2500, "#F0047F"],
  ["proterozoic", "元古宙", "Proterozoic", null, 2500, 538.8, "#F73563"],
  ["phanerozoic", "显生宙", "Phanerozoic", null, 538.8, 0, "#9AD9DD"],
];

const ERAS: Row[] = [
  ["eoarchean", "始太古代", "Eoarchean", "archean", 4031, 3600, "#DA037F"],
  ["paleoarchean", "古太古代", "Paleoarchean", "archean", 3600, 3200, "#F444A9"],
  ["mesoarchean", "中太古代", "Mesoarchean", "archean", 3200, 2800, "#F768A9"],
  ["neoarchean", "新太古代", "Neoarchean", "archean", 2800, 2500, "#F99BC1"],
  ["paleoproterozoic", "古元古代", "Paleoproterozoic", "proterozoic", 2500, 1600, "#F74370"],
  ["mesoproterozoic", "中元古代", "Mesoproterozoic", "proterozoic", 1600, 1000, "#FDB462"],
  ["neoproterozoic", "新元古代", "Neoproterozoic", "proterozoic", 1000, 538.8, "#FEB342"],
  ["paleozoic", "古生代", "Paleozoic", "phanerozoic", 538.8, 251.902, "#99C08D"],
  ["mesozoic", "中生代", "Mesozoic", "phanerozoic", 251.902, 66.0, "#67C5CA"],
  ["cenozoic", "新生代", "Cenozoic", "phanerozoic", 66.0, 0, "#F2F91D"],
];

const PERIODS: Row[] = [
  ["siderian", "成铁纪", "Siderian", "paleoproterozoic", 2500, 2300, "#F74F7C"],
  ["rhyacian", "层侵纪", "Rhyacian", "paleoproterozoic", 2300, 2050, "#F75B89"],
  ["orosirian", "造山纪", "Orosirian", "paleoproterozoic", 2050, 1800, "#F76898"],
  ["statherian", "固结纪", "Statherian", "paleoproterozoic", 1800, 1600, "#F875A7"],
  ["calymmian", "盖层纪", "Calymmian", "mesoproterozoic", 1600, 1400, "#FDC07A"],
  ["ectasian", "延展纪", "Ectasian", "mesoproterozoic", 1400, 1200, "#F3CC8A"],
  ["stenian", "狭带纪", "Stenian", "mesoproterozoic", 1200, 1000, "#FED99A"],
  ["tonian", "拉伸纪", "Tonian", "neoproterozoic", 1000, 720, "#FEBF4E", true],
  ["cryogenian", "成冰纪", "Cryogenian", "neoproterozoic", 720, 635, "#FECC5C", true],
  ["ediacaran", "埃迪卡拉纪", "Ediacaran", "neoproterozoic", 635, 538.8, "#FED96A"],
  ["cambrian", "寒武纪", "Cambrian", "paleozoic", 538.8, 486.85, "#7FA056"],
  ["ordovician", "奥陶纪", "Ordovician", "paleozoic", 486.85, 443.1, "#009270"],
  ["silurian", "志留纪", "Silurian", "paleozoic", 443.1, 419.62, "#B3E1B6"],
  ["devonian", "泥盆纪", "Devonian", "paleozoic", 419.62, 358.86, "#CB8C37"],
  ["carboniferous", "石炭纪", "Carboniferous", "paleozoic", 358.86, 298.9, "#67A599"],
  ["permian", "二叠纪", "Permian", "paleozoic", 298.9, 251.902, "#F04028"],
  ["triassic", "三叠纪", "Triassic", "mesozoic", 251.902, 201.4, "#812B92"],
  ["jurassic", "侏罗纪", "Jurassic", "mesozoic", 201.4, 143.1, "#34B2C9"],
  ["cretaceous", "白垩纪", "Cretaceous", "mesozoic", 143.1, 66.0, "#7FC64E"],
  ["paleogene", "古近纪", "Paleogene", "cenozoic", 66.0, 23.04, "#FD9A52"],
  ["neogene", "新近纪", "Neogene", "cenozoic", 23.04, 2.58, "#FFE619"],
  ["quaternary", "第四纪", "Quaternary", "cenozoic", 2.58, 0, "#F9F97F"],
];

const EPOCHS: Row[] = [
  ["terreneuvian", "纽芬兰世", "Terreneuvian", "cambrian", 538.8, 521.0, "#8CB06C", true],
  ["cambrian-series-2", "第二世", "Series 2", "cambrian", 521.0, 506.5, "#99C078", true],
  ["miaolingian", "苗岭世", "Miaolingian", "cambrian", 506.5, 497.0, "#A6CF86", true],
  ["furongian", "芙蓉世", "Furongian", "cambrian", 497.0, 486.85, "#B3E095", true],
  ["early-ordovician", "早奥陶世", "Early Ordovician", "ordovician", 486.85, 471.3, "#1A9D6F"],
  ["middle-ordovician", "中奥陶世", "Middle Ordovician", "ordovician", 471.3, 458.2, "#4DB47E"],
  ["late-ordovician", "晚奥陶世", "Late Ordovician", "ordovician", 458.2, 443.1, "#7FCA93"],
  ["llandovery", "兰多维列世", "Llandovery", "silurian", 443.1, 432.9, "#99D7B3"],
  ["wenlock", "温洛克世", "Wenlock", "silurian", 432.9, 426.7, "#B3E1C2"],
  ["ludlow", "罗德洛世", "Ludlow", "silurian", 426.7, 422.7, "#BFE6CF"],
  ["pridoli", "普里道利世", "Pridoli", "silurian", 422.7, 419.62, "#E6F5E1"],
  ["early-devonian", "早泥盆世", "Early Devonian", "devonian", 419.62, 393.47, "#E5AC4D"],
  ["middle-devonian", "中泥盆世", "Middle Devonian", "devonian", 393.47, 382.31, "#F1C868"],
  ["late-devonian", "晚泥盆世", "Late Devonian", "devonian", 382.31, 358.86, "#F1E19D"],
  ["mississippian", "密西西比亚纪", "Mississippian", "carboniferous", 358.86, 323.4, "#678F66"],
  ["pennsylvanian", "宾夕法尼亚亚纪", "Pennsylvanian", "carboniferous", 323.4, 298.9, "#99C2B5"],
  ["cisuralian", "乌拉尔世", "Cisuralian", "permian", 298.9, 274.4, "#EF5845"],
  ["guadalupian", "瓜德鲁普世", "Guadalupian", "permian", 274.4, 259.51, "#FB745C"],
  ["lopingian", "乐平世", "Lopingian", "permian", 259.51, 251.902, "#FBA794"],
  ["early-triassic", "早三叠世", "Early Triassic", "triassic", 251.902, 246.7, "#983999"],
  ["middle-triassic", "中三叠世", "Middle Triassic", "triassic", 246.7, 237, "#B168B1", true],
  ["late-triassic", "晚三叠世", "Late Triassic", "triassic", 237, 201.4, "#BD8CC3", true],
  ["early-jurassic", "早侏罗世", "Early Jurassic", "jurassic", 201.4, 174.7, "#42AED0"],
  ["middle-jurassic", "中侏罗世", "Middle Jurassic", "jurassic", 174.7, 161.5, "#80CFD8"],
  ["late-jurassic", "晚侏罗世", "Late Jurassic", "jurassic", 161.5, 143.1, "#B3E3EE"],
  ["early-cretaceous", "早白垩世", "Early Cretaceous", "cretaceous", 143.1, 100.5, "#8CCD57"],
  ["late-cretaceous", "晚白垩世", "Late Cretaceous", "cretaceous", 100.5, 66.0, "#A6D84A"],
  ["paleocene", "古新世", "Paleocene", "paleogene", 66.0, 56.0, "#FDA75F"],
  ["eocene", "始新世", "Eocene", "paleogene", 56.0, 33.9, "#FDB46C"],
  ["oligocene", "渐新世", "Oligocene", "paleogene", 33.9, 23.04, "#FDC07A"],
  ["miocene", "中新世", "Miocene", "neogene", 23.04, 5.333, "#FFFF00"],
  ["pliocene", "上新世", "Pliocene", "neogene", 5.333, 2.58, "#FFFF99"],
  ["pleistocene", "更新世", "Pleistocene", "quaternary", 2.58, 0.0117, "#FFF2AE"],
  ["holocene", "全新世", "Holocene", "quaternary", 0.0117, 0, "#FEF2E0"],
];

function build(rank: GeoRank, rows: Row[]): GeoUnit[] {
  return rows.map(([id, name, nameEn, parentId, fromMa, toMa, color, approx]) => ({
    id,
    rank,
    name,
    nameEn,
    parentId,
    // 用整数年避免 0.0117 × 1e6 之类的浮点尾差
    range: { fromYearsAgo: Math.round(fromMa * 1e6), toYearsAgo: Math.round(toMa * 1e6) },
    color,
    ...(approx ? { approximate: true } : {}),
  }));
}

export const GEO_UNITS: Record<GeoRank, GeoUnit[]> = {
  eon: build("eon", EONS),
  era: build("era", ERAS),
  period: build("period", PERIODS),
  epoch: build("epoch", EPOCHS),
};

export const GEO_UNIT_BY_ID: Record<string, GeoUnit> = Object.fromEntries(
  GEO_RANKS.flatMap((r) => GEO_UNITS[r]).map((u) => [u.id, u]),
);

/**
 * 某一时刻所处的各级单位。边界时刻归属较年轻的单位
 * （例如恰好 66.0 Ma 属于古近纪，因为该边界是古近纪的底界）。
 */
export function unitAt(rank: GeoRank, yearsAgo: number): GeoUnit | null {
  for (const u of GEO_UNITS[rank]) {
    if (yearsAgo <= u.range.fromYearsAgo && yearsAgo > u.range.toYearsAgo) return u;
  }
  // 现代基准 0 属于最年轻的单位
  const youngest = GEO_UNITS[rank].at(-1);
  return youngest && yearsAgo === youngest.range.toYearsAgo ? youngest : null;
}

export function geoPathAt(yearsAgo: number): Partial<Record<GeoRank, GeoUnit>> {
  const path: Partial<Record<GeoRank, GeoUnit>> = {};
  for (const r of GEO_RANKS) {
    const u = unitAt(r, yearsAgo);
    if (u) path[r] = u;
  }
  return path;
}

/** 当前时期的简短描述，例如 "显生宙 · 中生代 · 白垩纪 · 晚白垩世"。 */
export function describeGeoPeriod(yearsAgo: number): string {
  const p = geoPathAt(yearsAgo);
  return GEO_RANKS.map((r) => p[r]?.name)
    .filter(Boolean)
    .join(" · ");
}
