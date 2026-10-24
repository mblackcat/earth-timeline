/**
 * 生物百科的结构化条目。科学记录（年代、分类、栖息环境、证据、来源）仍以 Species 为准，
 * 这里只补充展示用的文字；每个物种都有同一组字段，保证百科页面结构一致。
 */

export type DietType =
  | "herbivore"
  | "carnivore"
  | "omnivore"
  | "insectivore"
  | "filter-feeder"
  | "detritivore"
  | "photosynthetic"
  | "saprotroph"
  | "unknown";

export const DIET_LABELS: Record<DietType, string> = {
  herbivore: "植食",
  carnivore: "肉食",
  omnivore: "杂食",
  insectivore: "食虫",
  "filter-feeder": "滤食",
  detritivore: "食碎屑 / 沉积物",
  photosynthetic: "光合自养",
  saprotroph: "腐生 / 共生",
  unknown: "尚不明确",
};

export interface WikiEntry {
  /** 一句话定位（不超过约 30 字）。 */
  tagline: string;
  /** 体型，简短，用于信息框（如"体长约 12 米，体重约 8 吨"）。 */
  size: string;
  diet: DietType;
  /** 形态特征。 */
  anatomy: string;
  /** 食性与生活方式。 */
  ecology: string;
  /** 发现与研究史。 */
  discovery: string;
  /** 演化意义。 */
  significance: string;
  /** 2–3 条趣闻。 */
  facts: string[];
}

/** 百科分类树的节点：内部节点有 children，叶节点列出物种 id。 */
export interface WikiNode {
  id: string;
  label: string;
  children?: WikiNode[];
  speciesIds?: string[];
}
