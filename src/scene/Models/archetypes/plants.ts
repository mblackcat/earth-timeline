import type { AnimationClipName } from "../../../data/schema";
import { p, type Params } from "../parts";
import { rot, S, type Pose } from "../pose";
import type { RigBuilder } from "../rig";

/**
 * 植物原型：乔木（各种冠型）与草本 / 早期有花植物。高度 = 1，地面 y = 0。
 */

/** 乔木冠型。 */
export const TREE_FORMS = {
  /** 鳞木：笔直粗干，顶端二歧分叉的短枝簇。 */
  lycopsid: 0,
  /** 芦木：分节的干，每节一轮细枝。 */
  horsetail: 1,
  /** 阔叶 / 舌羊齿 / 二叉羊齿：干 + 团状冠。 */
  broadleaf: 2,
  /** 针叶 / 古羊齿：层叠的锥形冠。 */
  conifer: 3,
  /** 银杏：干 + 几簇扇形叶团。 */
  ginkgo: 4,
  /** 原杉藻：无枝的粗柱。 */
  trunk: 5,
} as const;

/** 乔木。参数：form（TREE_FORMS）；trunk 干粗（相对高度）；crown 冠宽。 */
function tree(b: RigBuilder, params?: Params): number {
  const form = Math.round(p(params, "form", TREE_FORMS.broadleaf));
  const girth = p(params, "trunk", form === TREE_FORMS.trunk ? 0.12 : 0.05);
  const crownW = p(params, "crown", 0.45);
  const base = b.joint("base", b.root);
  const trunk = b.joint("trunk", base);
  const trunkH = form === TREE_FORMS.trunk ? 1 : form === TREE_FORMS.lycopsid ? 0.85 : form === TREE_FORMS.horsetail ? 1 : 0.55;
  if (form === TREE_FORMS.horsetail) {
    const nodes = b.lod === 0 ? 6 : 3;
    const segH = trunkH / nodes;
    for (let i = 0; i < nodes; i++) {
      b.part(trunk, b.cyl("body", 0.92), 0, segH * (i + 0.5), 0, girth * 2, segH * 0.96, girth * 2);
      const whorl = b.joint(`branch${i}`, trunk, 0, segH * (i + 1), 0);
      const twigs = b.lod === 0 ? 6 : 3;
      for (let k = 0; k < twigs; k++) {
        const a = (k / twigs) * Math.PI * 2;
        const m = b.part(whorl, b.cone("accent", 3), Math.sin(a) * 0.06, 0.02, Math.cos(a) * 0.06, 0.012, 0.14 * (1 - i / nodes / 2), 0.012);
        m.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
      }
    }
    return 1;
  }
  b.part(trunk, b.cyl("body", form === TREE_FORMS.trunk ? 0.9 : 0.6), 0, trunkH / 2, 0, girth * 2, trunkH, girth * 2);
  if (form === TREE_FORMS.trunk) {
    b.part(trunk, b.blob(), 0, trunkH - 0.02, 0, girth * 2, 0.08, girth * 2);
    return 1;
  }
  const crown = b.joint("crown", trunk, 0, trunkH, 0);
  if (form === TREE_FORMS.lycopsid) {
    const n = b.lod === 0 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const br = b.joint(`branch${i}`, crown, 0, 0, 0);
      br.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
      b.part(br, b.cyl("body", 0.7), 0, 0.06, 0, 0.03, 0.12, 0.03);
      for (const side of [1, -1]) {
        const tip = b.part(br, b.blob("accent"), side * 0.03, 0.15, 0, 0.05, 0.08, 0.05);
        tip.rotation.z = side * 0.4;
      }
    }
    return 1.05;
  }
  if (form === TREE_FORMS.conifer) {
    const layers = b.lod === 0 ? 4 : 2;
    for (let i = 0; i < layers; i++) {
      const br = b.joint(`branch${i}`, crown, 0, -0.12 + i * (0.5 / layers), 0);
      const w = crownW * (1 - i / (layers + 1));
      b.part(br, b.cone("accent", b.lod === 0 ? 7 : 5), 0, 0.12, 0, w, 0.26, w);
    }
    return 1;
  }
  if (form === TREE_FORMS.ginkgo) {
    const n = b.lod === 0 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const br = b.joint(`branch${i}`, crown, 0, -0.05 + (i % 2) * 0.12, 0);
      br.rotation.set(Math.cos(a) * 0.7, 0, -Math.sin(a) * 0.7);
      b.part(br, b.cyl("body", 0.6), 0, 0.08, 0, 0.025, 0.16, 0.025);
      const fan = b.part(br, b.cone("accent", 3), 0, 0.22, 0, crownW * 0.45, 0.16, 0.04);
      fan.rotation.x = Math.PI; // 扇形：宽边朝外
    }
    return 1;
  }
  // 阔叶 / 舌羊齿：几团叶冠
  const n = b.lod === 0 ? 4 : 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const br = b.joint(`branch${i}`, crown, Math.sin(a) * crownW * 0.25, 0.1 + (i % 2) * 0.06, Math.cos(a) * crownW * 0.25);
    b.part(br, b.blob("accent"), 0, 0.1, 0, crownW * 0.65, 0.3, crownW * 0.65);
  }
  return 1;
}

/** 草本 / 早期有花植物。参数：stems 茎数；flower 花 / 果（0 / 1）；leaves 每茎叶对数。 */
function herb(b: RigBuilder, params?: Params): number {
  const n = Math.max(1, Math.round(p(params, "stems", 3)));
  const leaves = b.lod === 0 ? Math.round(p(params, "leaves", 3)) : 1;
  const flower = p(params, "flower", 1) > 0;
  const base = b.joint("base", b.root);
  for (let i = 0; i < n; i++) {
    const stem = b.joint(`stem${i}`, base, (i - (n - 1) / 2) * 0.06, 0, 0);
    stem.rotation.z = (i - (n - 1) / 2) * 0.22;
    const h = 0.75 + 0.2 * ((i * 37) % 3) / 2;
    b.part(stem, b.cyl("body", 0.7), 0, h / 2, 0, 0.025, h, 0.025);
    for (let k = 0; k < leaves; k++) {
      const y = h * (0.25 + (k / Math.max(1, leaves)) * 0.55);
      for (const side of [1, -1]) {
        const leaf = b.part(stem, b.blob("accent"), side * 0.06, y, 0, 0.12, 0.02, 0.05);
        leaf.rotation.z = side * 0.5;
      }
    }
    if (flower) b.part(stem, b.blob("accent"), 0, h + 0.03, 0, 0.09, 0.09, 0.09);
  }
  return 1;
}

export const PLANT_BUILDERS = { tree, herb };

export const PLANT_CLIPS: Record<"tree" | "herb", Partial<Record<AnimationClipName, Pose>>> = {
  tree: {
    idle: (r, t, ph) => {
      rot(r, "trunk", 0.012 * S(t * 0.6 + ph), 0, 0.015 * S(t * 0.5 + ph));
      rot(r, "crown", 0.03 * S(t * 0.9 + ph), 0, 0.03 * S(t * 0.7 + ph));
      for (let i = 0; i < 6; i++) rot(r, `branch${i}`, 0.04 * S(t * 1.3 + i + ph), 0, 0.04 * S(t * 1.1 + i * 0.6 + ph));
    },
  },
  herb: {
    idle: (r, t, ph) => {
      for (let i = 0; i < 6; i++) rot(r, `stem${i}`, 0.05 * S(t * 1.2 + i + ph), 0, 0.07 * S(t * 0.9 + i * 0.7 + ph));
    },
  },
};
