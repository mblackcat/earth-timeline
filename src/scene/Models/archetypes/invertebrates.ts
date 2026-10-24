import type { AnimationClipName } from "../../../data/schema";
import { p, type Params } from "../parts";
import { rot, S, scale, type Pose } from "../pose";
import type { RigBuilder } from "../rig";

/**
 * 无脊椎动物原型：节肢动物（奇虾、马尔拉虫、怪诞虫、板足鲎、节胸蜈蚣）、
 * 固着生物（古杯动物、海百合、查恩海鳃、狄更逊水母）、头足类（内角石、菊石）。
 * 约定同 builders.ts：体长 = 1，前方 +Z，上方 +Y，地面 y = 0。
 */

/**
 * 节肢动物。参数：segments 体节数；legs 足对数（0 = 无足，游泳型）；width / height 体宽 / 体高；
 * grasp 前附肢（奇虾）；flaps 侧叶（游泳）；spines 背刺对数（怪诞虫）；telson 尾刺 / 尾节；
 * antennae 触角长度（0 = 无）。
 */
function arthropod(b: RigBuilder, params?: Params): number {
  const n = Math.max(3, Math.round(p(params, "segments", 8)));
  const segs = b.lod === 0 ? n : Math.max(3, Math.ceil(n / 2));
  const legs = Math.round(p(params, "legs", n));
  const width = p(params, "width", 0.22);
  const height = p(params, "height", 0.08);
  const lift = legs > 0 ? height * 1.6 : height * 0.6;
  const body = b.joint("body", b.root, 0, lift, 0);
  // 头部
  b.part(body, b.blob(), 0, 0, 0.42, width * 0.9, height * 1.1, 0.16);
  const segLen = 0.78 / segs;
  for (let i = 0; i < segs; i++) {
    const z = 0.32 - (i + 0.5) * segLen;
    const taper = 1 - (i / segs) * 0.45;
    const seg = b.joint(`seg${i}`, body, 0, 0, z);
    b.part(seg, b.box(), 0, 0, 0, width * taper, height, segLen * 0.92);
  }
  if (p(params, "antennae", 0) > 0) {
    const len = p(params, "antennae", 0) * 0.4;
    for (const side of [1, -1]) {
      const a = b.joint(`antenna${side > 0 ? "L" : "R"}`, body, side * width * 0.25, 0, 0.5);
      const m = b.part(a, b.cone("accent", 3), side * len * 0.2, 0, len / 2, 0.015, len, 0.015);
      m.rotation.set(Math.PI / 2, 0, -side * 0.4);
    }
  }
  if (p(params, "grasp", 0) > 0) {
    for (const side of [1, -1]) {
      const g = b.joint(`grasp${side > 0 ? "L" : "R"}`, body, side * width * 0.2, -height * 0.3, 0.5);
      g.rotation.x = 0.9;
      const m = b.part(g, b.cone("accent", 4), 0, 0, 0.1, 0.04, 0.22, 0.04);
      m.rotation.x = Math.PI / 2;
    }
  }
  const pairs = Math.min(legs, b.lod === 0 ? legs : 3);
  for (let i = 0; i < pairs; i++) {
    const z = 0.3 - ((i + 0.5) / pairs) * 0.7;
    for (const side of [1, -1]) {
      const j = b.joint(`leg${side > 0 ? "L" : "R"}${i}`, body, side * width * 0.45, -height * 0.4, z);
      const m = b.part(j, b.cone("accent", 3), side * 0.05, -lift * 0.45, 0, 0.025, lift * 1.1, 0.025);
      m.rotation.z = side * 0.55;
    }
  }
  if (p(params, "flaps", 0) > 0) {
    const fl = b.lod === 0 ? Math.min(segs, 8) : 3;
    for (let i = 0; i < fl; i++) {
      const z = 0.3 - ((i + 0.5) / fl) * 0.7;
      for (const side of [1, -1]) {
        const j = b.joint(`flap${side > 0 ? "L" : "R"}${i}`, body, side * width * 0.5, 0, z);
        b.part(j, b.box("accent"), side * width * 0.35, 0, 0, width * 0.7, 0.01, 0.75 / fl);
      }
    }
  }
  const spines = Math.round(p(params, "spines", 0));
  for (let i = 0; i < spines; i++) {
    const z = 0.3 - ((i + 0.5) / spines) * 0.6;
    for (const side of [1, -1]) {
      const m = b.part(body, b.cone("accent", 3), side * width * 0.2, height * 0.5 + 0.08, z, 0.025, 0.18, 0.025);
      m.rotation.z = -side * 0.25;
    }
  }
  if (p(params, "telson", 0) > 0) {
    const t = b.joint("tail", body, 0, 0, -0.46);
    const m = b.part(t, b.cone("accent", 4), 0, 0, -0.1 * p(params, "telson", 1), 0.06, 0.22 * p(params, "telson", 1), 0.03);
    m.rotation.x = -Math.PI / 2;
  }
  return lift + height * 0.5 + (spines > 0 ? 0.17 : 0);
}

/**
 * 固着生物。form：0 杯状（古杯动物）；1 柄 + 冠（海百合）；2 叶状体（查恩海鳃）；3 盘状（狄更逊水母）。
 * 高度 = 1（盘状为直径 = 1）。
 */
function sessile(b: RigBuilder, params?: Params): number {
  const form = Math.round(p(params, "form", 1));
  const base = b.joint("base", b.root);
  if (form === 3) {
    const disc = b.joint("disc", base, 0, 0.02, 0);
    b.part(disc, b.blob(), 0, 0, 0, 0.75, 0.04, 1);
    const ribs = b.lod === 0 ? 10 : 4;
    for (let i = 0; i < ribs; i++) {
      const z = 0.4 - (i / (ribs - 1)) * 0.8;
      const w = 0.7 * Math.sqrt(1 - (z / 0.5) ** 2);
      b.part(disc, b.box("accent"), 0, 0.02, z, w, 0.01, 0.015);
    }
    b.part(disc, b.box("accent"), 0, 0.025, 0, 0.015, 0.012, 0.9);
    return 0.06;
  }
  if (form === 0) {
    const cup = b.joint("stem0", base, 0, 0, 0);
    const m = b.part(cup, b.cone("body", b.lod === 0 ? 8 : 5), 0, 0.5, 0, 0.6, 1, 0.6);
    m.rotation.x = Math.PI; // 倒锥：口朝上
    b.part(cup, b.cyl("accent", 1), 0, 0.98, 0, 0.62, 0.04, 0.62);
    return 1;
  }
  if (form === 2) {
    const stalk = b.joint("stem0", base, 0, 0, 0);
    b.part(stalk, b.blob("accent"), 0, 0.03, 0, 0.12, 0.06, 0.12); // 固着盘
    b.part(stalk, b.cyl("body", 1), 0, 0.12, 0, 0.03, 0.24, 0.03);
    const frond = b.joint("crown", stalk, 0, 0.24, 0);
    b.part(frond, b.blob(), 0, 0.37, 0, 0.26, 0.76, 0.06);
    const n = b.lod === 0 ? 9 : 4;
    for (let i = 0; i < n; i++) {
      const y = 0.08 + (i / (n - 1)) * 0.62;
      for (const side of [1, -1]) {
        const m = b.part(frond, b.box("accent"), side * 0.08, y, 0, 0.14, 0.012, 0.05);
        m.rotation.z = side * 0.5;
      }
    }
    return 1;
  }
  // 海百合：分节的柄 + 萼 + 羽状腕
  const stemSegs = b.lod === 0 ? 4 : 2;
  let cur = base;
  const segH = 0.62 / stemSegs;
  for (let i = 0; i < stemSegs; i++) {
    const j = b.joint(`stem${i}`, cur, 0, i === 0 ? 0 : segH, 0);
    b.part(j, b.cyl("body", 0.95), 0, segH / 2, 0, 0.05, segH, 0.05);
    cur = j;
  }
  const crown = b.joint("crown", cur, 0, segH, 0);
  b.part(crown, b.cone("body", 5), 0, 0.06, 0, 0.14, 0.12, 0.14);
  const arms = b.lod === 0 ? 10 : 5;
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2;
    const arm = b.joint(`arm${i}`, crown, Math.sin(a) * 0.05, 0.1, Math.cos(a) * 0.05);
    arm.rotation.set(Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45);
    b.part(arm, b.cone("accent", 3), 0, 0.14, 0, 0.03, 0.28, 0.03);
  }
  return 1;
}

/**
 * 头足类。coiled = 1 平旋壳（菊石，体长 = 壳径）；0 直锥壳（内角石，体长 = 壳长）。tentacles 腕数。
 */
function cephalopod(b: RigBuilder, params?: Params): number {
  const coiled = p(params, "coiled", 1) > 0.5;
  const tentacles = b.lod === 0 ? Math.round(p(params, "tentacles", 8)) : 4;
  if (coiled) {
    const body = b.joint("body", b.root, 0, 0.5, 0);
    const shell = b.joint("shell", body, 0, 0, -0.05);
    // 壳：沿螺旋排列、逐渐变小的椭球，近似平旋壳（旋转面为 YZ 平面）
    const n = b.lod === 0 ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const ang = t * Math.PI * 3.2;
      const r = 0.36 * (1 - t * 0.62);
      const s = 0.3 * (1 - t * 0.7);
      b.part(shell, b.blob(i % 2 ? "accent" : "body"), 0, Math.sin(ang) * r, Math.cos(ang) * r, 0.24 * (1 - t * 0.5), s, s);
    }
    b.part(shell, b.blob("accent"), 0, 0, 0, 0.12, 0.12, 0.12); // 脐
    const head = b.joint("head", body, 0, -0.05, 0.4);
    b.part(head, b.blob(), 0, 0, 0.02, 0.16, 0.16, 0.12);
    for (let i = 0; i < tentacles; i++) {
      const a = (i / tentacles) * Math.PI * 2;
      const tj = b.joint(`tentacle${i}`, head, Math.sin(a) * 0.05, Math.cos(a) * 0.05, 0.06);
      tj.rotation.set(Math.PI / 2 - 0.25, 0, 0);
      b.part(tj, b.cone("accent", 3), 0, 0.09, 0, 0.025, 0.18, 0.025);
    }
    return 1;
  }
  const body = b.joint("body", b.root, 0, 0.1, 0);
  const shell = b.joint("shell", body);
  const m = b.part(shell, b.cone("body", b.lod === 0 ? 8 : 5), 0, 0, -0.12, 0.16, 0.86, 0.16);
  m.rotation.x = -Math.PI / 2; // 尖端朝后
  if (b.lod === 0) for (let i = 0; i < 5; i++) b.part(shell, b.cyl("accent", 1), 0, 0, 0.2 - i * 0.14, 0.15 - i * 0.022, 0.012, 0.15 - i * 0.022).rotation.x = Math.PI / 2;
  const head = b.joint("head", body, 0, 0, 0.32);
  b.part(head, b.blob(), 0, 0, 0.03, 0.13, 0.12, 0.1);
  for (let i = 0; i < tentacles; i++) {
    const a = (i / tentacles) * Math.PI * 2;
    const tj = b.joint(`tentacle${i}`, head, Math.sin(a) * 0.04, Math.cos(a) * 0.04, 0.06);
    tj.rotation.set(Math.PI / 2 - 0.15, 0, 0);
    b.part(tj, b.cone("accent", 3), 0, 0.08, 0, 0.02, 0.16, 0.02);
  }
  return 0.22;
}

export const INVERTEBRATE_BUILDERS = { arthropod, sessile, cephalopod };

const legsWave = (r: Parameters<Pose>[0], t: number, amp: number) => {
  for (let i = 0; i < 12; i++) {
    rot(r, `legL${i}`, 0, amp * S(t * 9 - i * 0.9), 0);
    rot(r, `legR${i}`, 0, amp * S(t * 9 - i * 0.9 + Math.PI), 0);
  }
};
const flapsWave = (r: Parameters<Pose>[0], t: number, amp: number, rate: number) => {
  for (let i = 0; i < 8; i++) {
    rot(r, `flapL${i}`, 0, 0, amp * S(t * rate - i * 0.8));
    rot(r, `flapR${i}`, 0, 0, -amp * S(t * rate - i * 0.8));
  }
};
const tentacles = (r: Parameters<Pose>[0], t: number, amp: number, ph: number) => {
  for (let i = 0; i < 10; i++) rot(r, `tentacle${i}`, amp * S(t * 2 + i * 0.7 + ph));
};

export const INVERTEBRATE_CLIPS: Record<"arthropod" | "sessile" | "cephalopod", Partial<Record<AnimationClipName, Pose>>> = {
  arthropod: {
    idle: (r, t, ph) => {
      rot(r, "antennaL", 0, 0.2 * S(t * 1.3 + ph), 0);
      rot(r, "antennaR", 0, -0.2 * S(t * 1.1 + 1 + ph), 0);
      rot(r, "graspL", 0.9 + 0.15 * S(t * 1.5 + ph));
      rot(r, "graspR", 0.9 + 0.15 * S(t * 1.5 + 0.4 + ph));
      flapsWave(r, t, 0.12, 2);
    },
    move: (r, t) => {
      legsWave(r, t, 0.5);
      flapsWave(r, t, 0.45, 7);
      for (let i = 0; i < 12; i++) rot(r, `seg${i}`, 0, 0.05 * S(t * 6 - i * 0.6));
    },
    eat: (r, t) => {
      rot(r, "body", 0.1 + 0.04 * S(t * 4));
      rot(r, "graspL", 0.3 + 0.6 * S(t * 4));
      rot(r, "graspR", 0.3 + 0.6 * S(t * 4 + 0.3));
      rot(r, "antennaL", 0.3 * S(t * 5));
      rot(r, "antennaR", 0.3 * S(t * 5 + 1));
    },
  },
  sessile: {
    idle: (r, t, ph) => {
      // 随水流摆动：柄逐节叠加、腕轻轻开合、叶状体前后摇
      for (let i = 0; i < 4; i++) rot(r, `stem${i}`, 0.04 * S(t * 0.8 + i * 0.5 + ph), 0, 0.05 * S(t * 0.6 + i * 0.4 + ph));
      rot(r, "crown", 0.06 * S(t * 0.7 + ph));
      for (let i = 0; i < 10; i++) scale(r, `arm${i}`, 1 + 0.08 * S(t * 1.1 + i + ph));
      scale(r, "disc", 1 + 0.015 * S(t * 0.8 + ph));
    },
  },
  cephalopod: {
    idle: (r, t, ph) => {
      rot(r, "body", 0.05 * S(t * 0.8 + ph));
      tentacles(r, t, 0.2, ph);
    },
    move: (r, t, ph) => {
      // 喷水推进：身体一缩一放，腕向后收拢
      scale(r, "body", 1 + 0.04 * S(t * 4));
      rot(r, "body", 0.04 * S(t * 4 + 1));
      tentacles(r, t * 2, 0.08, ph);
    },
  },
};
