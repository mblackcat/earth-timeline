/**
 * 丰度等级与地球上的模型尺寸（设计：docs/superpowers/specs/2026-10-19-species-expansion-design.md）。
 */

export type AbundanceTier = 1 | 2 | 3 | 4;

/** 各数据源的分档下限（等级 2 / 3 / 4）。GBIF 观测记录比化石记录多约两个数量级。 */
const TIER_THRESHOLDS = { pbdb: [30, 300, 3_000], gbif: [3_000, 30_000, 300_000] } as const;

/**
 * 记录数的数量级 → 丰度等级。PBDB 化石记录：1 < 30；2 = 30–299；3 = 300–2,999；4 ≥ 3,000。
 * GBIF 现代观测：门槛各高两个数量级。记录数受保存条件、调查强度影响，只是丰度的粗略代理。
 */
export function abundanceTier(records: number, source: keyof typeof TIER_THRESHOLDS = "pbdb"): AbundanceTier {
  const [t2, t3, t4] = TIER_THRESHOLDS[source];
  if (records >= t4) return 4;
  if (records >= t3) return 3;
  if (records >= t2) return 2;
  return 1;
}

/**
 * 地球上模型外形最大尺寸对应的屏幕像素：按体长压缩（指数 0.21），保留大小关系又让小生物看得见。
 * 6 cm ≈ 14 px，1.7 m ≈ 28 px，12 m ≈ 42 px，≥ 25 m 封顶 48 px。
 */
export function globeModelPx(sizeM: number): number {
  return Math.min(48, Math.max(14, 25 * Math.max(0, sizeM) ** 0.21));
}

/**
 * 生物群的屏幕尺寸：远景（高度 ≥ 1.2）把 globeModelPx 的 14–48 px 线性压到 6–12 px，
 * 高度 1.2 → 0.6 之间线性恢复到 globeModelPx。保留大小关系。
 */
export function herdModelPx(sizeM: number, altitude: number): number {
  const full = globeModelPx(sizeM);
  const far = 6 + ((full - 14) / 34) * 6;
  const k = Math.min(1, Math.max(0, (1.2 - altitude) / 0.6));
  return far + (full - far) * k;
}
