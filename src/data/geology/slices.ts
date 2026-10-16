import type { PaleoGeographySlice } from "../schema";

/**
 * 古地理时间切片索引。
 *
 * 第一阶段只有一个"现代示意"切片。Phase 7 在此追加古地理重建切片
 * （如二叠纪盘古大陆、白垩纪等），并逐一核对数据许可。
 */
export const PALEO_SLICES: PaleoGeographySlice[] = [
  {
    id: "modern-ne110m",
    label: "现代海岸线（示意）",
    // 全新世开始约 11,700 年前（ICS），至现代基准。
    timeRange: { fromYearsAgo: 11_700, toYearsAgo: 0 },
    kind: "modern-schematic",
    isSchematic: true,
    dataUrl: "data/geography/modern-ne110m.json",
    evidenceLevel: "estimated",
    sourceIds: ["natural-earth-110m-land"],
    note: "使用现代海岸线表示全新世。全新世早期海平面较低，当时的海岸线与现代存在差异。",
  },
];
