/**
 * 数据契约（PLAN §5）。
 *
 * 权威时间单位是 `yearsAgo`（距今年数，0 = 现代基准，正数 = 过去，负数 = 未来）。
 * 数据文件中可以用 Ma 书写，载入时通过 `maToYearsAgo` 统一转换。
 * 科学记录只通过 id 引用视觉资产，不包含任何模型、材质或动画信息。
 */

/** 经度、纬度（度），与 GeoJSON 顺序一致。 */
export type LonLat = [lon: number, lat: number];

export type EvidenceLevel = "well-established" | "estimated" | "uncertain";

/**
 * 时间范围：`fromYearsAgo >= toYearsAgo`（起点更古老），两端闭区间。
 * 瞬时事件 from === to。
 */
export interface TimeRange {
  fromYearsAgo: number;
  toYearsAgo: number;
  /** 起止时间的不确定范围（年），用于展示"约数/范围"。 */
  uncertaintyYears?: { older: number; younger: number };
}

/** PLAN §5.4：区分精确坐标、区域、全球、化石点、推测分布。 */
export interface SpatialExtent {
  kind: "point" | "region" | "global" | "fossil-sites" | "inferred-range";
  coordinates?: LonLat;
  /** 多个闭合环。 */
  polygon?: LonLat[][];
  /** 多个化石发现点。 */
  sites?: LonLat[];
  regionId?: string;
  /** 坐标是现代地理坐标还是古地理重建坐标（风险 R5）。 */
  coordinateFrame: "modern" | "paleo";
  note?: string;
}

export interface Source {
  id: string;
  title: string;
  publisher?: string;
  url?: string;
  license?: string;
  accessed?: string;
  note?: string;
}

export type EventCategory =
  | "geology"
  | "life"
  | "extinction"
  | "human"
  | "civilization"
  | "climate";

export interface HistoricalEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  time: TimeRange;
  location?: SpatialExtent;
  evidenceLevel: EvidenceLevel;
  evidenceNote?: string;
  sourceIds: string[];
  visualizationIds: string[];
  /** 示例数据必须显式标注。 */
  isSample?: boolean;
}

export type HabitatId = "marine" | "freshwater" | "coastal" | "terrestrial" | "forest" | "steppe" | "wetland";

export interface Species {
  id: string;
  /** 学名；高级分类单元（如三叶虫纲）也可作为代表性类群。 */
  scientificName: string;
  commonName: string;
  /** 分类等级说明，例如"纲"、"属"、"种"。 */
  rank: "class" | "genus" | "species";
  description: string;
  /** 用于展示的近似生存范围，不代表精确起源/灭绝时间。 */
  time: TimeRange;
  taxonomy?: { kingdom?: string; class?: string; order?: string; family?: string };
  habitatIds: HabitatId[];
  distribution: SpatialExtent[];
  /** Phase 6 接入低多边形模型后填写。 */
  visualizationId?: string;
  evidenceLevel: EvidenceLevel;
  /** 年代范围的取得方式与不确定性说明。 */
  evidenceNote: string;
  sourceIds: string[];
  isSample?: boolean;
}

/** 化石点数据文件（由 scripts/fetch-pbdb-sites.mjs 生成）。 */
export interface FossilSitesFile {
  format: "ett-fossil-sites/1";
  sourceId: string;
  generated: string;
  note: string;
  species: Record<
    string,
    {
      pbdbName: string;
      /** 生成时使用的年代过滤范围（Ma），应与 Species.time 一致。 */
      filterMa: [fromMa: number, toMa: number];
      /** 匹配到的 PBDB 化石记录数（去重前）。 */
      occurrences: number;
      /** 去重后的化石点（现代经纬度，四舍五入到 0.5°）。 */
      sites: LonLat[];
    }
  >;
}

export interface VisualizationAsset {
  id: string;
  type: "terrain" | "plant" | "animal" | "human" | "building" | "effect";
  modelPath?: string;
  animationSet?: string[];
  preferredLod: 0 | 1 | 2;
  style: "wireframe" | "solid" | "hybrid";
}

/**
 * 一个时间区间内的地理轮廓（古地理重建或现代示意）的元数据。
 * 轮廓几何体积较大，按需从 `dataUrl` 加载（见 PaleoGeographyOutlines）。
 */
export interface PaleoGeographySlice {
  id: string;
  label: string;
  timeRange: TimeRange;
  kind: "reconstruction" | "modern-schematic";
  /** 示意性/艺术化数据必须为 true，UI 需提示。 */
  isSchematic: boolean;
  dataUrl: string;
  evidenceLevel: EvidenceLevel;
  sourceIds: string[];
  note: string;
}

/** `dataUrl` 指向的文件格式。 */
export interface PaleoGeographyOutlines {
  format: "ett-outlines/1";
  sourceId: string;
  note?: string;
  /** 轮廓线（经纬度折线，闭合环首尾相同）。 */
  outlines: LonLat[][];
}

export const YEARS_PER_MA = 1_000_000;

export function maToYearsAgo(ma: number): number {
  return ma * YEARS_PER_MA;
}

/** 现代基准（yearsAgo = 0）对应的公历年份：公元 2000 年初（与 b2k 一致）。 */
export const MODERN_BASELINE_CE_YEAR = 2000;

/**
 * 放射性碳"BP"年（以公元 1950 年为 0）→ yearsAgo（以 2000 年为 0）。
 * 文献中的 cal BP 必须经此转换，否则会差 50 年（TASKS 风险 R6）。
 */
export function calBpToYearsAgo(bp: number): number {
  return bp + (MODERN_BASELINE_CE_YEAR - 1950);
}

/**
 * 公元纪年（无公元 0 年）→ yearsAgo。`year` 为正整数，`era` 区分公元前后。
 * 数据层的轻量版本；完整的双向换算与格式化见 timeline/CalendarAdapter。
 */
export function ceToYearsAgo(year: number, era: "BCE" | "CE" = "CE"): number {
  if (!Number.isInteger(year) || year < 1) throw new RangeError("there is no year 0");
  const astronomical = era === "CE" ? year : 1 - year;
  return MODERN_BASELINE_CE_YEAR - astronomical;
}

export function isWithinTimeRange(range: TimeRange, yearsAgo: number): boolean {
  return yearsAgo <= range.fromYearsAgo && yearsAgo >= range.toYearsAgo;
}
