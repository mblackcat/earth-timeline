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

export interface Species {
  id: string;
  scientificName: string;
  commonName: string;
  /** 用于展示的近似生存范围，不代表精确起源/灭绝时间。 */
  time: TimeRange;
  taxonomy?: { kingdom?: string; class?: string; order?: string; family?: string };
  habitatIds: string[];
  distribution: SpatialExtent[];
  visualizationId: string;
  evidenceLevel: EvidenceLevel;
  sourceIds: string[];
  isSample?: boolean;
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

export function isWithinTimeRange(range: TimeRange, yearsAgo: number): boolean {
  return yearsAgo <= range.fromYearsAgo && yearsAgo >= range.toYearsAgo;
}
