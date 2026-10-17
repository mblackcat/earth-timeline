import type { LonLat } from "./schema";

/**
 * 区域型空间范围的近似中心（现代经纬度），用于在地球上放置区域事件的标记。
 * 只是标注位置，不代表区域边界；精确多边形留待后续数据替换（PLAN §5.4）。
 */
export const REGIONS: Record<string, { label: string; center: LonLat }> = {
  oman: { label: "阿曼", center: [57, 21] },
  "ellesmere-island": { label: "埃尔斯米尔岛（加拿大）", center: [-80, 79.5] },
  liaoning: { label: "辽宁（中国）", center: [122.5, 41.3] },
  "fertile-crescent": { label: "新月沃地", center: [41, 35] },
  mesopotamia: { label: "美索不达米亚", center: [45, 32] },
  "great-britain": { label: "大不列颠岛", center: [-2, 54] },
};
