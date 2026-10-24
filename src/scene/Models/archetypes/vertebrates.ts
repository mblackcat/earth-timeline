import type { AnimationClipName } from "../../../data/schema";
import { limb, lowerLimb, p, tailChain, type Params } from "../parts";
import { breathe, rot, S, scale, type Pose } from "../pose";
import type { RigBuilder } from "../rig";

/**
 * 新增脊椎动物原型：蜥脚类（板龙、腕龙）、海生爬行类（鱼龙、蛇颈龙、沧龙、幻龙）、鸟（始祖鸟）。
 * 以及节肢动物中的飞行昆虫（巨脉蜻蜓）。体长 = 1（飞行类为翼展 = 1）。
 */

/** 颈：向前上方伸出的锥形链，返回末端关节。 */
function neckChain(b: RigBuilder, parent: Parameters<RigBuilder["joint"]>[1], segments: number, length: number, radius: number, lift: number) {
  let cur = parent;
  const seg = length / segments;
  for (let i = 0; i < segments; i++) {
    const j = b.joint(`neck${i}`, cur, 0, 0, i === 0 ? 0 : seg);
    if (i === 0) j.rotation.x = -lift;
    const r = radius * (1 - (i / segments) * 0.45);
    const m = b.part(j, b.cyl("body", 0.85), 0, 0, seg / 2, r * 2, seg * 1.05, r * 2);
    m.rotation.x = Math.PI / 2;
    cur = j;
  }
  return b.joint("head", cur, 0, 0, seg);
}

/** 蜥脚类。参数：neck 颈长（相对体长）；tail 尾长；frontLeg 前后肢长比（腕龙 > 1）；legLength 腿长。 */
function sauropod(b: RigBuilder, params?: Params): number {
  const neckLen = p(params, "neck", 0.38);
  const tailLen = p(params, "tail", 0.4);
  const front = p(params, "frontLeg", 1);
  const legLen = p(params, "legLength", 0.22);
  const bodyLen = Math.max(0.2, 1 - neckLen * 0.75 - tailLen * 0.75);
  const bodyH = 0.16;
  const bodyY = legLen * Math.max(1, front) + bodyH * 0.3;
  const body = b.joint("body", b.root, 0, bodyY, 0);
  b.part(body, b.blob(), 0, 0, 0, 0.17, bodyH, bodyLen);
  const neckBase = b.joint("neckBase", body, 0, bodyH * 0.25, bodyLen * 0.45);
  const head = neckChain(b, neckBase, b.lod === 0 ? 3 : 2, neckLen, 0.04, 0.35 + (front - 1) * 1.2);
  b.part(head, b.blob(), 0, 0.01, 0.03, 0.05, 0.045, 0.08);
  for (const [name, x, z] of [
    ["legFL", 1, 1],
    ["legFR", -1, 1],
    ["legBL", 1, -1],
    ["legBR", -1, -1],
  ] as const) {
    const len = legLen * (z > 0 ? front : 1);
    const hip = b.joint(name, body, x * 0.06, -bodyH * 0.3 + (z > 0 ? (front - 1) * legLen : 0), z * bodyLen * 0.32);
    const knee = limb(b, hip, `${name}Upper`, len * 0.55, 0.035);
    const lower = b.joint(`${name}Lower`, knee, 0, -len * 0.55, 0);
    lowerLimb(b, lower, len * 0.5, 0.032);
  }
  tailChain(b, b.joint("tailBase", body, 0, 0, -bodyLen * 0.45), "tail", b.lod === 0 ? 4 : 2, tailLen, 0.06);
  return bodyY + bodyH * 0.6 + neckLen * Math.sin(0.35 + (front - 1) * 1.2);
}

/** 海生爬行类。参数：neck 颈长；fluke 尾鳍（鱼龙的新月形尾鳍、沧龙的下弯尾鳍）；snout 吻长；dorsal 背鳍。 */
function marineReptile(b: RigBuilder, params?: Params): number {
  const neckLen = p(params, "neck", 0);
  const fluke = p(params, "fluke", 1);
  const snout = p(params, "snout", 0.5);
  const bodyLen = Math.max(0.3, 0.55 - neckLen * 0.35);
  const bodyH = 0.13;
  const body = b.joint("body", b.root, 0, bodyH * 0.6 + 0.04, 0);
  b.part(body, b.blob(), 0, 0, 0, 0.16, bodyH, bodyLen);
  let head;
  if (neckLen > 0.05) {
    head = neckChain(b, b.joint("neckBase", body, 0, 0.01, bodyLen * 0.45), b.lod === 0 ? 3 : 2, neckLen, 0.03, 0.05);
  } else {
    head = b.joint("head", body, 0, 0.01, bodyLen * 0.48);
  }
  b.part(head, b.blob(), 0, 0, 0.04, 0.07, 0.06, 0.1);
  const jaw = b.joint("jaw", head, 0, -0.012, 0.06);
  const sn = b.part(jaw, b.cone("accent", 4), 0, 0, 0.06 * snout + 0.02, 0.04, 0.12 * snout + 0.04, 0.025);
  sn.rotation.x = Math.PI / 2;
  for (const [name, x, z] of [
    ["flipperFL", 1, 1],
    ["flipperFR", -1, 1],
    ["flipperBL", 1, -1],
    ["flipperBR", -1, -1],
  ] as const) {
    const j = b.joint(name, body, x * 0.07, -bodyH * 0.25, z * bodyLen * 0.28);
    const len = z > 0 ? 0.16 : 0.12;
    const m = b.part(j, b.blob("accent"), x * len * 0.5, -0.01, -0.02, len, 0.012, len * 0.38);
    m.rotation.y = x * 0.35;
  }
  if (p(params, "dorsal", fluke > 0 ? 1 : 0) > 0) b.part(body, b.cone("accent", 3), 0, bodyH * 0.6, -bodyLen * 0.05, 0.015, 0.08, 0.1);
  const tails = tailChain(b, b.joint("tailBase", body, 0, 0, -bodyLen * 0.45), "tail", b.lod === 0 ? 3 : 2, Math.max(0.1, 1 - bodyLen - neckLen - 0.1 * snout), 0.06);
  if (fluke > 0) {
    const fin = b.joint("tailFin", tails[tails.length - 1]!, 0, 0, -0.06);
    for (const up of [1, -1]) {
      const m = b.part(fin, b.cone("accent", 3), 0, up * 0.05, -0.02, 0.012, 0.12, 0.05);
      m.rotation.x = up * 0.5;
    }
  }
  return bodyH + 0.12;
}

/** 不会飞的大型鸟（冠恐鸟）：身高 = 1，粗壮的腿、巨大的喙、退化的翼。 */
function groundBird(b: RigBuilder): number {
  const body = b.joint("body", b.root, 0, 0.5, 0);
  b.part(body, b.blob(), 0, 0, 0, 0.32, 0.32, 0.45);
  const neck = b.joint("neck", body, 0, 0.1, 0.16);
  neck.rotation.x = -0.5;
  b.part(neck, b.cyl("body", 0.85), 0, 0.12, 0, 0.1, 0.24, 0.1);
  const head = b.joint("head", neck, 0, 0.26, 0);
  head.rotation.x = 0.5;
  b.part(head, b.blob(), 0, 0, 0.03, 0.14, 0.15, 0.16);
  const beak = b.part(head, b.cone("accent", 4), 0, -0.01, 0.16, 0.1, 0.18, 0.13);
  beak.rotation.x = Math.PI / 2;
  for (const side of [1, -1]) {
    const tag = side > 0 ? "L" : "R";
    const w = b.joint(`wing${tag}`, body, side * 0.15, 0.04, 0.02);
    b.part(w, b.blob("accent"), side * 0.03, 0, -0.04, 0.05, 0.08, 0.14);
    const hip = b.joint(`leg${tag}`, body, side * 0.09, -0.08, 0);
    const knee = limb(b, hip, `leg${tag}Upper`, 0.22, 0.05);
    const shin = b.joint(`leg${tag}Lower`, knee, 0, -0.22, 0);
    lowerLimb(b, shin, 0.2, 0.035);
    b.part(shin, b.box("accent"), 0, -0.2, 0.04, 0.08, 0.02, 0.12);
  }
  return 1;
}

/** 鸟。翼展 = 1。参数：tail 尾长（始祖鸟为长骨质尾）；flightless = 1 时改为不会飞的大型鸟（身高 = 1）。 */
function bird(b: RigBuilder, params?: Params): number {
  if (p(params, "flightless", 0) > 0) return groundBird(b);
  const body = b.joint("body", b.root, 0, 0.18, 0);
  b.part(body, b.blob(), 0, 0, 0, 0.1, 0.1, 0.2);
  const head = b.joint("head", body, 0, 0.06, 0.11);
  b.part(head, b.blob(), 0, 0.02, 0.02, 0.06, 0.06, 0.07);
  const beak = b.part(head, b.cone("accent", 4), 0, 0.01, 0.07, 0.025, 0.06, 0.02);
  beak.rotation.x = Math.PI / 2;
  for (const side of [1, -1]) {
    const tag = side > 0 ? "L" : "R";
    const inner = b.joint(`wing${tag}`, body, side * 0.04, 0.03, 0.03);
    b.part(inner, b.box("accent"), side * 0.13, 0, -0.03, 0.26, 0.01, 0.12);
    const outer = b.joint(`wing${tag}Outer`, inner, side * 0.26, 0, 0);
    b.part(outer, b.box("accent"), side * 0.12, 0, -0.05, 0.24, 0.008, 0.1);
    const hip = b.joint(`leg${tag}`, body, side * 0.03, -0.04, -0.01);
    const knee = limb(b, hip, `leg${tag}Upper`, 0.07, 0.012);
    const shin = b.joint(`leg${tag}Lower`, knee, 0, -0.07, 0);
    lowerLimb(b, shin, 0.06, 0.01);
  }
  const tailLen = p(params, "tail", 0.25);
  const tail = b.joint("tailBase", body, 0, 0, -0.1);
  b.part(tail, b.box("accent"), 0, 0, -tailLen / 2, 0.06, 0.01, tailLen);
  return 0.32;
}

/** 飞行昆虫（蜻蜓型）。翼展 = 1。参数：body 腹长（相对翼展）。 */
function insect(b: RigBuilder, params?: Params): number {
  const len = p(params, "body", 0.6);
  const body = b.joint("body", b.root, 0, 0.08, 0);
  b.part(body, b.blob(), 0, 0, 0.05, 0.06, 0.06, 0.12); // 胸
  b.part(body, b.blob(), 0, 0.01, len * 0.4, 0.07, 0.06, 0.07); // 头
  const abd = b.joint("abdomen", body, 0, 0, -0.02);
  const m = b.part(abd, b.cyl("body", 0.6), 0, 0, -len * 0.35, 0.03, len * 0.7, 0.03);
  m.rotation.x = Math.PI / 2;
  for (let k = 0; k < 2; k++) {
    for (const side of [1, -1]) {
      const tag = `${side > 0 ? "L" : "R"}${k}`;
      const w = b.joint(`wing${tag}`, body, side * 0.02, 0.025, 0.08 - k * 0.07);
      b.part(w, b.blob("accent"), side * 0.25, 0, 0, 0.5, 0.006, 0.08);
    }
  }
  if (b.lod === 0) {
    for (let i = 0; i < 3; i++) {
      for (const side of [1, -1]) {
        const leg = b.part(body, b.cone("accent", 3), side * 0.04, -0.04, 0.09 - i * 0.04, 0.008, 0.08, 0.008);
        leg.rotation.z = side * 0.6;
      }
    }
  }
  return 0.12;
}

/**
 * 鲸。体长 = 1。参数：slender 身体细长（龙王鲸）；dorsal 背鳍高（虎鲸）；head 头部比例；flipper 胸鳍长。
 * 水平尾叶（与鱼的垂直尾鳍不同），游动时上下摆尾。
 */
function whale(b: RigBuilder, params?: Params): number {
  const slender = p(params, "slender", 0);
  const depth = 0.16 * (1 - slender * 0.45);
  const body = b.joint("body", b.root, 0, depth * 0.6 + 0.03, 0);
  b.part(body, b.blob(), 0, 0, 0.12, depth * 1.15, depth, 0.62);
  const headLen = p(params, "head", 0.24);
  const head = b.joint("head", body, 0, 0, 0.4);
  b.part(head, b.blob(), 0, -depth * 0.05, headLen * 0.3, depth * 1.05, depth * 0.85, headLen);
  const jaw = b.joint("jaw", head, 0, -depth * 0.3, 0.02);
  b.part(jaw, b.box("accent"), 0, -0.01, headLen * 0.35, depth * 0.7, 0.015, headLen * 0.85);
  for (const side of [1, -1]) {
    const j = b.joint(`flipper${side > 0 ? "L" : "R"}`, body, side * depth * 0.5, -depth * 0.3, 0.26);
    const len = p(params, "flipper", 0.14);
    const m = b.part(j, b.blob("accent"), side * len * 0.45, -0.01, -0.03, len, 0.012, len * 0.32);
    m.rotation.y = side * 0.5;
  }
  const dorsal = p(params, "dorsal", 0.3);
  if (dorsal > 0) b.part(body, b.cone("accent", 3), 0, depth * 0.5 + 0.03 * dorsal, -0.05, 0.015, 0.08 * dorsal + 0.02, 0.07);
  const tails = tailChain(b, b.joint("tailBase", body, 0, 0, -0.18), "tail", b.lod === 0 ? 3 : 2, 0.32 + slender * 0.2, depth * 0.45);
  const fluke = b.joint("tailFin", tails[tails.length - 1]!, 0, 0, -0.1);
  for (const side of [1, -1]) {
    const m = b.part(fluke, b.blob("accent"), side * 0.06, 0, -0.03, 0.13, 0.012, 0.06);
    m.rotation.y = -side * 0.4;
  }
  return depth * 1.6 + 0.04 + dorsal * 0.1;
}

export const VERTEBRATE_BUILDERS = { sauropod, marineReptile, bird, insect, whale };

const tailSway = (r: Parameters<Pose>[0], t: number, amp: number, ph = 0) => {
  for (let i = 0; i < 4; i++) rot(r, `tail${i}`, 0, amp * S(t - i * 0.6 + ph));
};

export const VERTEBRATE_CLIPS: Record<"sauropod" | "marineReptile" | "bird" | "insect" | "whale", Partial<Record<AnimationClipName, Pose>>> = {
  whale: {
    idle: (r, t, ph) => {
      scale(r, "body", breathe(t, 0.5));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0.06 * S(t * 0.8 - i * 0.6 + ph));
      rot(r, "tailFin", 0.1 * S(t * 0.8 - 2 + ph));
      rot(r, "flipperL", 0, 0, 0.08 * S(t * 0.6 + ph));
      rot(r, "flipperR", 0, 0, -0.08 * S(t * 0.6 + ph));
    },
    move: (r, t) => {
      // 上下摆尾（鲸的尾叶是水平的）
      const w = t * 2.2;
      rot(r, "body", 0.04 * S(w + 1));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0.22 * S(w - i * 0.7));
      rot(r, "tailFin", 0.35 * S(w - 2.2));
      rot(r, "flipperL", 0, 0, 0.12 * S(w));
      rot(r, "flipperR", 0, 0, -0.12 * S(w));
    },
    eat: (r, t) => {
      rot(r, "jaw", 0.2 + 0.15 * S(t * 2));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0.08 * S(t - i * 0.6));
    },
  },
  sauropod: {
    idle: (r, t, ph) => {
      scale(r, "body", breathe(t, 0.9));
      for (let i = 0; i < 3; i++) rot(r, `neck${i}`, 0.04 * S(t * 0.5 + i * 0.4 + ph), 0.08 * S(t * 0.3 + i * 0.3 + ph));
      tailSway(r, t * 0.8, 0.12, ph);
    },
    move: (r, t) => {
      const w = t * 3;
      rot(r, "legFL", 0.35 * S(w));
      rot(r, "legBR", 0.35 * S(w));
      rot(r, "legFR", 0.35 * S(w + Math.PI));
      rot(r, "legBL", 0.35 * S(w + Math.PI));
      rot(r, "body", 0, 0.03 * S(w), 0.02 * S(w * 2));
      for (let i = 0; i < 3; i++) rot(r, `neck${i}`, 0.03 * S(w * 2 - i), 0.04 * S(w - i * 0.4));
      tailSway(r, w, 0.1);
    },
    eat: (r, t) => {
      // 高处取食：颈部上抬、头部点动
      rot(r, "neck0", -0.2 + 0.04 * S(t * 1.5));
      rot(r, "neck1", -0.1);
      rot(r, "head", 0.2 * S(t * 3));
      tailSway(r, t, 0.06);
    },
  },
  marineReptile: {
    idle: (r, t, ph) => {
      for (const [n, k] of [["flipperFL", 1], ["flipperFR", -1], ["flipperBL", 1], ["flipperBR", -1]] as const) rot(r, n, 0, 0, k * 0.15 * S(t * 1.2 + ph));
      tailSway(r, t * 1.2, 0.08, ph);
      for (let i = 0; i < 3; i++) rot(r, `neck${i}`, 0, 0.08 * S(t * 0.6 + i * 0.5 + ph));
    },
    move: (r, t) => {
      const w = t * 4;
      // 鳍"飞行"划水（蛇颈龙）+ 尾部推进（鱼龙 / 沧龙）
      for (const [n, k, off] of [["flipperFL", 1, 0], ["flipperFR", -1, 0], ["flipperBL", 1, 1.2], ["flipperBR", -1, 1.2]] as const) rot(r, n, 0, 0, k * 0.45 * S(w + off));
      rot(r, "body", 0, 0.05 * S(w));
      tailSway(r, w * 1.4, 0.3);
      rot(r, "tailFin", 0, 0.35 * S(w * 1.4 - 2.4));
    },
    eat: (r, t) => {
      rot(r, "jaw", 0.25 + 0.25 * S(t * 6));
      rot(r, "head", 0, 0.15 * S(t * 2));
      tailSway(r, t * 2, 0.15);
    },
  },
  bird: {
    idle: (r, t, ph) => {
      rot(r, "head", 0.1 * S(t * 1.6 + ph), 0.5 * S(t * 0.7 + ph));
      rot(r, "neck", -0.5 + 0.05 * S(t * 0.9 + ph));
      // 停歇时翼收拢在身侧
      rot(r, "wingL", 0, 1.2, 0);
      rot(r, "wingR", 0, -1.2, 0);
      rot(r, "wingLOuter", 0, 1.6, 0);
      rot(r, "wingROuter", 0, -1.6, 0);
      rot(r, "tailBase", 0.1 * S(t * 2 + ph));
    },
    move: (r, t) => {
      const f = S(t * 6);
      rot(r, "wingL", 0, 0, 0.6 * f);
      rot(r, "wingR", 0, 0, -0.6 * f);
      rot(r, "wingLOuter", 0, 0, 0.35 * S(t * 6 - 0.6));
      rot(r, "wingROuter", 0, 0, -0.35 * S(t * 6 - 0.6));
      rot(r, "legL", 0.9);
      rot(r, "legR", 0.9);
      rot(r, "body", 0.04 * S(t * 6 + 1));
    },
  },
  insect: {
    idle: (r, t, ph) => {
      // 蜻蜓停歇时翅平展，只有轻微颤动
      for (let k = 0; k < 2; k++) {
        rot(r, `wingL${k}`, 0, 0, 0.04 * S(t * 7 + k + ph));
        rot(r, `wingR${k}`, 0, 0, -0.04 * S(t * 7 + k + ph));
      }
      rot(r, "abdomen", 0.03 * S(t * 1.1 + ph));
    },
    move: (r, t) => {
      for (let k = 0; k < 2; k++) {
        const f = S(t * 22 + k * Math.PI * 0.5);
        rot(r, `wingL${k}`, 0, 0, 0.5 * f);
        rot(r, `wingR${k}`, 0, 0, -0.5 * f);
      }
      rot(r, "abdomen", 0.06 * S(t * 3));
    },
  },
};
