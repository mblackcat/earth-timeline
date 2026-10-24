import type { EvidenceLevel } from "../../data/schema";

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  "well-established": "证据充分",
  estimated: "估计值",
  uncertain: "不确定",
};

export const RANK_LABELS = { class: "纲", family: "科", genus: "属", species: "种" } as const;

export const KINGDOM_LABELS: Record<string, string> = { Animalia: "动物界", Plantae: "植物界", Fungi: "真菌界" };
