import type { VisualizationAsset } from "../schema";

/**
 * 代表性生物的视觉资产。体长为常见文献量级的近似值，仅用于观察窗中的比例；
 * 模型为程序化低多边形示意，不代表精确的形态复原。
 */
const NOTE = "程序化低多边形示意模型，仅表现大致体型与运动方式，不是精确复原。";

export const VISUALS: VisualizationAsset[] = [
  { id: "viz-trilobite", type: "animal", archetype: "trilobite", sizeM: 0.06, color: "#b7895a", accent: "#e8c38f", animationSet: ["idle", "move", "eat"], locomotion: "crawl", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-haikouichthys", type: "animal", archetype: "fish", sizeM: 0.03, color: "#8fb8c9", accent: "#d6eef7", params: { depth: 0.18, finSize: 0.4 }, animationSet: ["idle", "move"], locomotion: "swim", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-dunkleosteus", type: "animal", archetype: "fish", sizeM: 6, color: "#6f7f8f", accent: "#c9b38a", params: { depth: 0.28, armor: 1, finSize: 0.8 }, animationSet: ["idle", "move", "eat"], locomotion: "swim", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-cooksonia", type: "plant", archetype: "plant", sizeM: 0.05, color: "#6fae5a", accent: "#c9a14a", params: { branches: 3 }, animationSet: ["idle"], locomotion: "none", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-ichthyostega", type: "animal", archetype: "quadruped", sizeM: 1.5, color: "#7d8f6a", accent: "#c7d39a", params: { legLength: 0.25, tail: 1, sprawl: 1, neck: 0 }, animationSet: ["idle", "move"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-eryops", type: "animal", archetype: "quadruped", sizeM: 2, color: "#8a7656", accent: "#d1b98a", params: { legLength: 0.28, tail: 0.8, sprawl: 1, neck: 0 }, animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-tyrannosaurus", type: "animal", archetype: "theropod", sizeM: 12, color: "#7a6a52", accent: "#d59a5a", animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-pteranodon", type: "animal", archetype: "pterosaur", sizeM: 6, color: "#a59a86", accent: "#e07b4f", animationSet: ["idle", "move"], locomotion: "fly", preferredLod: 0, style: "hybrid", note: "翼展约 6 米。" + NOTE },
  { id: "viz-morganucodon", type: "animal", archetype: "quadruped", sizeM: 0.1, color: "#8c7a6b", accent: "#d8c6b4", params: { legLength: 0.35, tail: 0.9, sprawl: 0.3, neck: 0.2 }, animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-mammoth", type: "animal", archetype: "quadruped", sizeM: 5, color: "#6b4e36", accent: "#e8dcc4", params: { legLength: 0.6, tail: 0.15, sprawl: 0, neck: 0.3, trunk: 1, tusks: 1, hump: 1 }, animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: NOTE },
  { id: "viz-afarensis", type: "human", archetype: "hominin", sizeM: 1.1, color: "#7b5e47", accent: "#c9a27e", params: { stoop: 0.15, armLength: 1.15 }, animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: "站立身高约 1.1 米。" + NOTE },
  { id: "viz-erectus", type: "human", archetype: "hominin", sizeM: 1.6, color: "#8a6a50", accent: "#d4b08a", params: { stoop: 0.05, armLength: 1 }, animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: "站立身高约 1.6 米。" + NOTE },
  { id: "viz-sapiens", type: "human", archetype: "hominin", sizeM: 1.7, color: "#9a7a5e", accent: "#e0c2a0", params: { stoop: 0, armLength: 0.95 }, animationSet: ["idle", "move", "eat"], locomotion: "walk", preferredLod: 0, style: "hybrid", note: "站立身高约 1.7 米。" + NOTE },
];

export const VISUAL_BY_ID: Record<string, VisualizationAsset> = Object.fromEntries(VISUALS.map((v) => [v.id, v]));
