import type { PaleoGeographySlice } from "../schema";
import { RECONSTRUCTION_SLICES } from "./reconstruction";

/**
 * 古地理时间切片索引。
 *
 * 全新世使用现代海岸线（示意）；更早的时期使用 CAO2024 板块重建切片（见 reconstruction.ts）。
 * 顺序即解析优先级：边界时刻（如 11,700 年前）归属排在前面的切片。
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
  ...RECONSTRUCTION_SLICES,
];
