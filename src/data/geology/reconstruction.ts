import type { PaleoGeographySlice } from "../schema";

/**
 * 板块重建切片（GPlates Web Service · CAO2024 模型，0–1800 Ma，数据 CC BY 4.0）。
 *
 * 重建年代近期密、深时疏。切片 tᵢ 覆盖 (tᵢ₋₁, tᵢ]：从 tᵢ 的轮廓开始，
 * 逐顶点形变到下一个更年轻的重建年代 tᵢ₋₁（见 simulation/paleoMorph.ts），大陆连续漂移。
 * 重建"海岸线"是现今陆块边界随板块旋转到该年代的位置：表示大陆的大致位置与形态，
 * 不是当时的真实海岸线（海平面、陆地边缘与造山带都不同）。
 */
export const RECONSTRUCTION_MODEL = "CAO2024";
export const RECONSTRUCTION_MAX_MA = 1800;

export const RECONSTRUCTION_TIMES_MA = [
  1, 5, 10, 20, 35, 50, 66, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420, 440,
  460, 480, 500, 520, 540, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800,
] as const;

/** 最年轻的重建切片向下接到全新世底界（之后由现代海岸线切片负责）。 */
const HOLOCENE_BASE_YEARS = 11_700;

/** 下一个更年轻的重建年代（Ma）；最年轻的切片形变到现今位置（0）。 */
export function nextReconstructionMa(i: number): number {
  return i > 0 ? RECONSTRUCTION_TIMES_MA[i - 1]! : 0;
}

function rangeFor(i: number): { fromYearsAgo: number; toYearsAgo: number } {
  const younger = i > 0 ? RECONSTRUCTION_TIMES_MA[i - 1]! * 1e6 : HOLOCENE_BASE_YEARS;
  return { fromYearsAgo: RECONSTRUCTION_TIMES_MA[i]! * 1e6, toYearsAgo: younger };
}

export function reconstructionDataUrl(ma: number): string {
  return `data/geography/cao2024/${ma}.json`;
}

export const PALEO_POINTS_URL = "data/geography/cao2024/points.json";

export const RECONSTRUCTION_SLICES: PaleoGeographySlice[] = RECONSTRUCTION_TIMES_MA.map((ma, i) => ({
  id: `cao2024-${ma}`,
  label: `板块重建 · ${ma} → ${nextReconstructionMa(i)} Ma`,
  timeRange: rangeFor(i),
  kind: "reconstruction",
  isSchematic: false,
  dataUrl: reconstructionDataUrl(ma),
  evidenceLevel: ma <= 540 ? "estimated" : "uncertain",
  sourceIds: ["cao-2024", "gplates-web-service"],
  note:
    "现今陆块边界随板块运动旋转到该年代的位置，表示大陆的大致位置；不是当时的真实海岸线。" +
    "两个重建年代之间按各点的板块运动沿大圆插值，是平滑过渡的近似。" +
    (ma > 540 ? "前寒武纪的重建不确定性显著更大。" : ""),
  reconstructionMa: ma,
  nextReconstructionMa: nextReconstructionMa(i),
}));
