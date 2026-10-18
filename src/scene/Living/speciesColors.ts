import { SPECIES } from "../../data/species";
import { INK, mixHex } from "../Ink/inkPalette";

/** 每个代表性物种的识别色（纸面上可读的中等饱和度）。 */
const PALETTE = [
  "#c0782a", "#3f8f4f", "#2f6fa8", "#b8483f", "#7a5aa6", "#b04f7f", "#2a8a86",
  "#a68a1f", "#4f86b0", "#b0802f", "#5c9a5c", "#a85c5c", "#8a6fb0",
];

export const SPECIES_COLORS: Record<string, string> = Object.fromEntries(
  SPECIES.map((s, i) => [s.id, PALETTE[i % PALETTE.length]!]),
);

/** 降饱和版本：化石点、此时期列表、详情卡片使用。 */
export const SPECIES_COLORS_MUTED: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIES_COLORS).map(([id, c]) => [id, mixHex(c, INK.paper, 0.3)]),
);
