import { SPECIES } from "../../data/species";

/** 每个代表性物种的化石点颜色（同时用于场景图例与详情）。 */
const PALETTE = [
  "#f6ad55",
  "#68d391",
  "#63b3ed",
  "#fc8181",
  "#b794f4",
  "#f687b3",
  "#4fd1c5",
  "#faf089",
  "#90cdf4",
  "#fbd38d",
  "#9ae6b4",
  "#feb2b2",
  "#e9d8fd",
];

export const SPECIES_COLORS: Record<string, string> = Object.fromEntries(
  SPECIES.map((s, i) => [s.id, PALETTE[i % PALETTE.length]!]),
);
