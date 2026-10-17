import type { Object3D } from "three";
import type { ModelArchetype, VisualizationAsset } from "../../data/schema";
import { RigBuilder, type Lod, type Rig, type Style } from "./rig";

/**
 * 各体型原型的程序化低多边形构建器。
 * 约定：体长归一化为 1（翼龙为翼展、人族为身高），前方 +Z，上方 +Y，地面 y = 0。
 * 关节命名在同一原型内固定，供 animation.ts 使用。
 */

type Params = Record<string, number>;
const p = (params: Params | undefined, key: string, fallback: number) => params?.[key] ?? fallback;

/** 从关节向下（-Y）伸出的肢体段（上粗下细的圆柱），返回该段关节。 */
function limb(b: RigBuilder, parent: Object3D, name: string, length: number, radius: number, tone: "body" | "accent" = "body") {
  const j = b.joint(name, parent);
  b.part(j, b.cyl(tone), 0, -length / 2, 0, radius * 2, length, radius * 2);
  return j;
}

/** 关节下方的末段肢体（圆柱，下端更细），用于小腿 / 前臂。 */
function lowerLimb(b: RigBuilder, j: Object3D, length: number, radius: number) {
  b.part(j, b.cyl("body", 0.75), 0, -length / 2, 0, radius * 2, length, radius * 2);
}

/** 向后（-Z）延伸的锥形链（尾巴），返回各节关节。 */
function tailChain(b: RigBuilder, parent: Object3D, prefix: string, segments: number, length: number, radius: number) {
  const joints: Object3D[] = [];
  let cur = parent;
  const seg = length / segments;
  for (let i = 0; i < segments; i++) {
    const j = b.joint(`${prefix}${i}`, cur, 0, 0, i === 0 ? 0 : -seg);
    const r = radius * (1 - i / segments);
    const m = b.part(j, b.cone(), 0, 0, -seg / 2, r * 2, seg, r * 2);
    m.rotation.x = -Math.PI / 2;
    joints.push(j);
    cur = j;
  }
  return joints;
}

function trilobite(b: RigBuilder): number {
  const body = b.joint("body", b.root, 0, 0.07, 0);
  b.part(body, b.blob(), 0, 0, 0.3, 0.62, 0.12, 0.38); // 头甲
  const segs = b.lod === 0 ? 8 : 3;
  for (let i = 0; i < segs; i++) {
    const z = 0.12 - (i / (segs - 1)) * 0.42;
    const w = 0.56 - i * (0.18 / segs);
    b.part(body, b.box(), 0, 0, z, w, 0.06, 0.42 / segs);
  }
  b.part(body, b.box("accent"), 0, 0.035, -0.08, 0.14, 0.05, 0.55); // 中轴叶
  b.part(body, b.blob(), 0, 0, -0.38, 0.36, 0.08, 0.2); // 尾甲
  const pairs = b.lod === 0 ? 6 : 3;
  for (let i = 0; i < pairs; i++) {
    const z = 0.15 - (i / (pairs - 1)) * 0.45;
    for (const side of [1, -1]) {
      const j = b.joint(`leg${side > 0 ? "L" : "R"}${i}`, body, side * 0.22, -0.03, z);
      const m = b.part(j, b.cone("accent", 3), side * 0.08, -0.02, 0, 0.03, 0.18, 0.03);
      m.rotation.z = side * (Math.PI / 2 + 0.3);
    }
  }
  for (const side of [1, -1]) {
    const a = b.joint(`antenna${side > 0 ? "L" : "R"}`, body, side * 0.08, 0.01, 0.48);
    const m = b.part(a, b.cone("accent", 3), side * 0.06, 0, 0.1, 0.015, 0.25, 0.015);
    m.rotation.set(Math.PI / 2, 0, -side * 0.5);
  }
  return 0.15;
}

function fish(b: RigBuilder, params?: Params): number {
  const depth = p(params, "depth", 0.2);
  const armor = p(params, "armor", 0);
  const fin = p(params, "finSize", 0.5);
  const body = b.joint("body", b.root, 0, depth / 2 + 0.02, 0);
  b.part(body, b.blob(), 0, 0, 0.1, 0.2, depth, 0.75);
  if (armor > 0) {
    b.part(body, b.box("accent"), 0, depth * 0.05, 0.36, 0.2, depth * 0.85, 0.26); // 头胸甲
    const jaw = b.joint("jaw", body, 0, -depth * 0.3, 0.42);
    b.part(jaw, b.box("accent"), 0, -0.02, 0.04, 0.16, 0.05, 0.16);
  }
  const tailRoot = b.joint("tailRoot", body, 0, 0, -0.25);
  b.part(tailRoot, b.blob(), 0, 0, -0.12, 0.1, depth * 0.6, 0.32);
  const tailFin = b.joint("tailFin", tailRoot, 0, 0, -0.27);
  const tf = b.part(tailFin, b.cone("accent", 3), 0, 0, -0.08, 0.02, 0.18 * fin + 0.08, depth * 1.3);
  tf.rotation.x = -Math.PI / 2;
  for (const side of [1, -1]) {
    const j = b.joint(`pectoral${side > 0 ? "L" : "R"}`, body, side * 0.09, -depth * 0.25, 0.2);
    const m = b.part(j, b.cone("accent", 3), side * 0.06, 0, -0.02, 0.01, 0.15 * fin, 0.08 * fin);
    m.rotation.z = side * (Math.PI / 2 + 0.4);
  }
  if (b.lod === 0) b.part(body, b.cone("accent", 3), 0, depth * 0.55, 0.05, 0.02, depth * 0.5, 0.15); // 背鳍
  return depth + 0.04;
}

function plant(b: RigBuilder, params?: Params): number {
  const n = Math.round(p(params, "branches", 3));
  const base = b.joint("base", b.root);
  for (let i = 0; i < n; i++) {
    const stem = b.joint(`stem${i}`, base, (i - (n - 1) / 2) * 0.08, 0, 0);
    stem.rotation.z = (i - (n - 1) / 2) * 0.18;
    b.part(stem, b.cone("body", 4), 0, 0.3, 0, 0.03, 0.6, 0.03);
    const levels = b.lod === 0 ? [-1, 1] : [0];
    for (const side of levels) {
      const tip = b.joint(`tip${i}_${side}`, stem, 0, 0.58, 0);
      tip.rotation.z = side * 0.4;
      b.part(tip, b.cone("body", 4), 0, 0.18, 0, 0.02, 0.36, 0.02);
      b.part(tip, b.blob("accent"), 0, 0.38, 0, 0.07, 0.09, 0.07); // 孢子囊
    }
  }
  return 1;
}

function quadruped(b: RigBuilder, params?: Params): number {
  const legLen = p(params, "legLength", 0.4);
  const sprawl = p(params, "sprawl", 0);
  const hump = p(params, "hump", 0);
  const bodyH = 0.26 + hump * 0.12;
  const bodyY = legLen * (1 - sprawl * 0.5) + bodyH * 0.35;
  const body = b.joint("body", b.root, 0, bodyY, 0);
  b.part(body, b.blob(), 0, 0, 0, 0.36 + sprawl * 0.08, bodyH, 0.72);
  if (hump > 0) b.part(body, b.blob(), 0, bodyH * 0.35, 0.15, 0.3, bodyH * 0.5, 0.35);
  const neck = b.joint("neck", body, 0, bodyH * 0.15, 0.34);
  neck.rotation.x = -0.2 * p(params, "neck", 0);
  const head = b.joint("head", neck, 0, 0.02, 0.1);
  b.part(head, b.blob(), 0, 0, 0.06, 0.22, 0.2 + hump * 0.05, 0.26);
  if (b.lod === 0) for (const side of [1, -1]) b.part(head, b.blob("accent"), side * 0.08, 0.05, 0.12, 0.03, 0.03, 0.03);
  if (p(params, "trunk", 0) > 0) {
    const t1 = b.joint("trunk0", head, 0, -0.04, 0.17);
    const m1 = b.part(t1, b.cone(), 0, -0.1, 0.02, 0.07, 0.22, 0.07);
    m1.rotation.x = Math.PI - 0.2;
    const t2 = b.joint("trunk1", t1, 0, -0.2, 0.04);
    const m2 = b.part(t2, b.cone(), 0, -0.09, 0, 0.05, 0.18, 0.05);
    m2.rotation.x = Math.PI;
  }
  if (p(params, "tusks", 0) > 0) {
    for (const side of [1, -1]) {
      const m = b.part(head, b.cone("accent", 4), side * 0.06, -0.08, 0.2, 0.035, 0.32, 0.035);
      m.rotation.set(Math.PI / 2 + 0.6, 0, side * 0.25);
    }
  }
  const legY = -bodyH * 0.3;
  for (const [name, x, z] of [
    ["legFL", 1, 1],
    ["legFR", -1, 1],
    ["legBL", 1, -1],
    ["legBR", -1, -1],
  ] as const) {
    const hip = b.joint(name, body, x * (0.12 + sprawl * 0.1), legY, z * 0.24);
    hip.rotation.z = x * sprawl * 0.9;
    const r = 0.05 + hump * 0.03;
    const knee = limb(b, hip, `${name}Upper`, legLen * 0.55, r);
    const lower = b.joint(`${name}Lower`, knee, 0, -legLen * 0.55, 0);
    lower.rotation.z = -x * sprawl * 0.9;
    lowerLimb(b, lower, legLen * 0.5, r * 0.85);
    if (b.lod === 0) b.part(lower, b.cyl("accent", 1.1), 0, -legLen * 0.5, 0, r * 2.1, 0.03, r * 2.1); // 足
  }
  const tail = p(params, "tail", 0.5);
  if (tail > 0.05) tailChain(b, b.joint("tailBase", body, 0, 0, -0.34), "tail", b.lod === 0 ? 3 : 2, 0.45 * tail, 0.07);
  return bodyY + bodyH * 0.6 + 0.1;
}

function theropod(b: RigBuilder): number {
  const pelvis = b.joint("body", b.root, 0, 0.4, 0);
  b.part(pelvis, b.blob(), 0, 0.02, 0.08, 0.22, 0.24, 0.48);
  const neck = b.joint("neck", pelvis, 0, 0.06, 0.3);
  neck.rotation.x = -0.25;
  b.part(neck, b.blob(), 0, 0.03, 0.04, 0.12, 0.14, 0.14);
  const head = b.joint("head", neck, 0, 0.06, 0.08);
  head.rotation.x = 0.25;
  b.part(head, b.box(), 0, 0.02, 0.1, 0.13, 0.12, 0.24);
  if (b.lod === 0) for (const side of [1, -1]) b.part(head, b.blob("accent"), side * 0.06, 0.06, 0.1, 0.025, 0.025, 0.025);
  const jaw = b.joint("jaw", head, 0, -0.04, 0.0);
  b.part(jaw, b.box("accent"), 0, -0.015, 0.11, 0.11, 0.035, 0.22);
  for (const side of [1, -1]) {
    const arm = b.joint(`arm${side > 0 ? "L" : "R"}`, pelvis, side * 0.08, -0.04, 0.26);
    const m = b.part(arm, b.cone(), 0, -0.04, 0.02, 0.025, 0.09, 0.025);
    m.rotation.x = Math.PI - 0.6;
  }
  tailChain(b, b.joint("tailBase", pelvis, 0, 0.02, -0.15), "tail", b.lod === 0 ? 3 : 2, 0.55, 0.1);
  for (const side of [1, -1]) {
    const name = `leg${side > 0 ? "L" : "R"}`;
    const hip = b.joint(name, pelvis, side * 0.09, -0.02, 0);
    hip.rotation.x = -0.3;
    const knee = limb(b, hip, `${name}Upper`, 0.22, 0.06);
    const shinJ = b.joint(`${name}Lower`, knee, 0, -0.22, 0);
    shinJ.rotation.x = 0.6;
    lowerLimb(b, shinJ, 0.21, 0.035);
    b.part(shinJ, b.box("accent"), 0, -0.21, 0.04, 0.06, 0.02, 0.1);
  }
  return 0.62;
}

function pterosaur(b: RigBuilder): number {
  const body = b.joint("body", b.root, 0, 0.08, 0);
  b.part(body, b.blob(), 0, 0, 0, 0.07, 0.07, 0.2);
  const head = b.joint("head", body, 0, 0.03, 0.1);
  const beak = b.part(head, b.cone("accent", 4), 0, 0, 0.12, 0.035, 0.24, 0.035);
  beak.rotation.x = Math.PI / 2;
  const crest = b.part(head, b.cone("accent", 3), 0, 0.02, -0.08, 0.01, 0.16, 0.05);
  crest.rotation.x = -Math.PI / 2 - 0.3;
  for (const side of [1, -1]) {
    const tag = side > 0 ? "L" : "R";
    const inner = b.joint(`wing${tag}`, body, side * 0.03, 0.01, 0.02);
    b.part(inner, b.box(), side * 0.11, 0, -0.02, 0.22, 0.008, 0.11);
    const outer = b.joint(`wing${tag}Outer`, inner, side * 0.22, 0, 0.02);
    const m = b.part(outer, b.cone(), side * 0.13, 0, -0.03, 0.08, 0.27, 0.005);
    m.rotation.z = -side * (Math.PI / 2);
  }
  return 0.12;
}

function hominin(b: RigBuilder, params?: Params): number {
  const stoop = p(params, "stoop", 0);
  const arm = p(params, "armLength", 1);
  const hips = b.joint("body", b.root, 0, 0.5, 0);
  b.part(hips, b.box(), 0, 0, 0, 0.17, 0.08, 0.1);
  const torso = b.joint("torso", hips, 0, 0.03, 0);
  torso.rotation.x = stoop * 0.6;
  b.part(torso, b.box(), 0, 0.15, 0, 0.2, 0.28, 0.11);
  const head = b.joint("head", torso, 0, 0.32, 0.01);
  b.part(head, b.blob(), 0, 0.07, 0.01, 0.12, 0.14, 0.13);
  for (const side of [1, -1]) {
    const tag = side > 0 ? "L" : "R";
    const shoulder = b.joint(`arm${tag}`, torso, side * 0.13, 0.27, 0);
    const elbow = limb(b, shoulder, `arm${tag}Upper`, 0.16 * arm, 0.03);
    const fore = b.joint(`arm${tag}Lower`, elbow, 0, -0.16 * arm, 0);
    lowerLimb(b, fore, 0.15 * arm, 0.024);
    const hip = b.joint(`leg${tag}`, hips, side * 0.055, -0.03, 0);
    const knee = limb(b, hip, `leg${tag}Upper`, 0.24, 0.045);
    const shin = b.joint(`leg${tag}Lower`, knee, 0, -0.24, 0);
    lowerLimb(b, shin, 0.22, 0.035);
    b.part(shin, b.box("accent"), 0, -0.225, 0.03, 0.05, 0.02, 0.1);
  }
  return 1;
}

const BUILDERS: Record<ModelArchetype, (b: RigBuilder, params?: Params) => number> = {
  trilobite,
  fish,
  plant,
  quadruped,
  theropod,
  pterosaur,
  hominin,
};

/** 构建一个模型实例（局部单位：体长 = 1）。调用方负责 dispose。 */
export function buildRig(asset: VisualizationAsset, lod: Lod, style: Style): Rig {
  const b = new RigBuilder(lod);
  b.root.name = asset.id;
  const height = BUILDERS[asset.archetype](b, asset.params);
  return b.finish(style, asset.color, asset.accent, height);
}
