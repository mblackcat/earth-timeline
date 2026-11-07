import type { AnimationClipName, ModelArchetype } from "../../data/schema";
import { INVERTEBRATE_CLIPS } from "./archetypes/invertebrates";
import { PLANT_CLIPS } from "./archetypes/plants";
import { VERTEBRATE_CLIPS } from "./archetypes/vertebrates";
import { breathe, resetPose, rot, S, scale, sink, sleepBreathe, type Pose } from "./pose";
import type { Rig } from "./rig";

export { resetPose } from "./pose";

/**
 * 程序化关节动画（Idle / 移动 / 进食）。
 *
 * 动画时间来自渲染时钟（秒），与模拟时间完全无关（PLAN §4.7、TASKS §2 不变式 5）：
 * 历史时间以每秒百万年推进时，恐龙仍按正常节奏行走。
 * 每帧先把关节恢复到静止姿态，再叠加当前片段的偏移，因此片段可以任意切换。
 */

const CLIPS: Record<ModelArchetype, Partial<Record<AnimationClipName, Pose>>> = {
  trilobite: {
    idle: (r, t) => {
      rot(r, "antennaL", 0, 0.2 * S(t * 1.3), 0);
      rot(r, "antennaR", 0, -0.2 * S(t * 1.1 + 1), 0);
    },
    move: (r, t) => {
      for (let i = 0; i < 6; i++) {
        rot(r, `legL${i}`, 0, 0.5 * S(t * 9 - i * 0.9), 0);
        rot(r, `legR${i}`, 0, 0.5 * S(t * 9 - i * 0.9 + Math.PI), 0);
      }
      rot(r, "antennaL", 0, 0.15 * S(t * 3), 0);
      rot(r, "antennaR", 0, -0.15 * S(t * 3), 0);
    },
    eat: (r, t) => {
      rot(r, "body", 0.12 + 0.05 * S(t * 4));
      rot(r, "antennaL", 0.3 * S(t * 5));
      rot(r, "antennaR", 0.3 * S(t * 5 + 1));
    },
    // 睡觉：触角收拢，极轻微起伏
    sleep: (r, t) => {
      rot(r, "antennaL", 0.25, 0.15, 0);
      rot(r, "antennaR", 0.25, -0.15, 0);
      scale(r, "body", 1 + 0.01 * S(t * 0.6));
    },
  },
  fish: {
    idle: (r, t) => {
      rot(r, "tailRoot", 0, 0.12 * S(t * 2));
      rot(r, "tailFin", 0, 0.2 * S(t * 2 - 0.8));
      rot(r, "pectoralL", 0, 0, 0.2 * S(t * 3));
      rot(r, "pectoralR", 0, 0, -0.2 * S(t * 3));
    },
    move: (r, t) => {
      rot(r, "body", 0, 0.08 * S(t * 6));
      rot(r, "tailRoot", 0, 0.35 * S(t * 6 - 0.6));
      rot(r, "tailFin", 0, 0.5 * S(t * 6 - 1.4));
    },
    eat: (r, t) => {
      rot(r, "jaw", 0.35 + 0.3 * S(t * 7));
      rot(r, "tailRoot", 0, 0.15 * S(t * 3));
    },
    // 睡觉：悬停，尾鳍与胸鳍缓摆
    sleep: (r, t) => {
      rot(r, "tailRoot", 0, 0.05 * S(t * 0.7));
      rot(r, "tailFin", 0, 0.08 * S(t * 0.7 - 0.8));
      rot(r, "pectoralL", 0, 0, 0.1 * S(t * 0.9));
      rot(r, "pectoralR", 0, 0, -0.1 * S(t * 0.9));
    },
  },
  plant: {
    idle: (r, t, ph) => {
      for (let i = 0; i < 6; i++) rot(r, `stem${i}`, 0.05 * S(t * 1.2 + i + ph), 0, 0.06 * S(t * 0.9 + i * 0.7 + ph));
    },
  },
  quadruped: {
    idle: (r, t, ph) => {
      scale(r, "body", breathe(t));
      rot(r, "head", 0.05 * S(t * 0.7 + ph), 0.25 * S(t * 0.4 + ph));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0, 0.25 * S(t * 2 - i * 0.6 + ph));
      rot(r, "trunk0", 0.15 * S(t * 0.9 + ph));
      rot(r, "trunk1", 0.2 * S(t * 0.9 - 0.5 + ph));
    },
    move: (r, t) => {
      const w = t * 5;
      rot(r, "legFL", 0.45 * S(w));
      rot(r, "legBR", 0.45 * S(w));
      rot(r, "legFR", 0.45 * S(w + Math.PI));
      rot(r, "legBL", 0.45 * S(w + Math.PI));
      rot(r, "legFLLower", Math.max(0, -0.5 * S(w)));
      rot(r, "legBRLower", Math.max(0, -0.5 * S(w)));
      rot(r, "legFRLower", Math.max(0, 0.5 * S(w)));
      rot(r, "legBLLower", Math.max(0, 0.5 * S(w)));
      rot(r, "body", 0, 0.04 * S(w), 0.03 * S(w * 2));
      rot(r, "head", 0.06 * S(w * 2));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0, 0.18 * S(w - i * 0.7));
      rot(r, "trunk0", 0.12 * S(w));
      rot(r, "trunk1", 0.15 * S(w - 0.5));
    },
    eat: (r, t) => {
      rot(r, "neck", 0.55 + 0.05 * S(t * 2));
      rot(r, "head", 0.35 + 0.12 * S(t * 4));
      rot(r, "trunk0", 0.6 + 0.3 * S(t * 2.5));
      rot(r, "trunk1", 0.5 * S(t * 2.5 - 0.8));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0, 0.15 * S(t * 1.5 - i * 0.6));
    },
    // 睡觉：趴下，头颈与鼻/尾放松
    sleep: (r, t) => {
      sink(r, 0.25);
      scale(r, "body", sleepBreathe(t));
      rot(r, "neck", 0.6);
      rot(r, "head", 0.35);
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0, 0.5);
      rot(r, "trunk0", 0.8);
      rot(r, "trunk1", 0.4);
    },
  },
  theropod: {
    idle: (r, t, ph) => {
      scale(r, "body", breathe(t, 1.2));
      rot(r, "neck", 0.04 * S(t * 0.8 + ph), 0.2 * S(t * 0.35 + ph));
      rot(r, "jaw", Math.max(0, 0.15 * S(t * 0.5 + ph) - 0.05));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0.03 * S(t * 1.1 + i), 0.12 * S(t * 0.9 - i * 0.6 + ph));
    },
    move: (r, t) => {
      const w = t * 4;
      rot(r, "legL", 0.55 * S(w));
      rot(r, "legR", 0.55 * S(w + Math.PI));
      rot(r, "legLLower", 0.35 * Math.max(0, S(w + 1.2)));
      rot(r, "legRLower", 0.35 * Math.max(0, S(w + Math.PI + 1.2)));
      rot(r, "body", 0.03 * S(w * 2), 0.05 * S(w));
      rot(r, "neck", -0.04 * S(w * 2));
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, 0.04 * S(w * 2 - i), -0.12 * S(w - i * 0.5));
    },
    eat: (r, t) => {
      rot(r, "body", 0.25);
      rot(r, "neck", 0.6 + 0.08 * S(t * 3));
      rot(r, "head", 0.3);
      rot(r, "jaw", 0.25 + 0.25 * S(t * 6));
      rot(r, "legL", 0.25);
      rot(r, "legR", 0.25);
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, -0.12, 0.08 * S(t * 1.5 - i));
    },
    // 睡觉：伏地，头颈低垂
    sleep: (r, t) => {
      sink(r, 0.3);
      scale(r, "body", sleepBreathe(t));
      rot(r, "body", 0.1);
      rot(r, "neck", 0.5);
      rot(r, "head", 0.3);
      for (let i = 0; i < 3; i++) rot(r, `tail${i}`, -0.1, 0.3);
    },
  },
  pterosaur: {
    idle: (r, t) => {
      rot(r, "wingL", 0, 0, 0.08 * S(t * 1.2));
      rot(r, "wingR", 0, 0, -0.08 * S(t * 1.2));
      rot(r, "head", 0, 0.3 * S(t * 0.5));
    },
    move: (r, t) => {
      const f = S(t * 5);
      rot(r, "wingL", 0, 0, 0.55 * f);
      rot(r, "wingR", 0, 0, -0.55 * f);
      rot(r, "wingLOuter", 0, 0, 0.3 * S(t * 5 - 0.6));
      rot(r, "wingROuter", 0, 0, -0.3 * S(t * 5 - 0.6));
      rot(r, "body", 0.05 * S(t * 5 + 1));
    },
    // 睡觉：栖息，头埋低
    sleep: (r, t) => {
      sink(r, 0.1);
      rot(r, "head", 0.4);
      rot(r, "body", 0.02 * S(t * 0.8));
    },
  },
  hominin: {
    idle: (r, t, ph) => {
      scale(r, "torso", breathe(t, 1.4));
      rot(r, "head", 0.05 * S(t * 0.6 + ph), 0.4 * S(t * 0.3 + ph));
      rot(r, "armL", 0.05 * S(t * 1.4), 0, 0.05);
      rot(r, "armR", 0.05 * S(t * 1.4 + 1), 0, -0.05);
    },
    move: (r, t) => {
      const w = t * 5.5;
      rot(r, "legL", 0.45 * S(w));
      rot(r, "legR", 0.45 * S(w + Math.PI));
      rot(r, "legLLower", 0.5 * Math.max(0, S(w - 1.4)));
      rot(r, "legRLower", 0.5 * Math.max(0, S(w + Math.PI - 1.4)));
      rot(r, "armL", -0.35 * S(w), 0, 0.05);
      rot(r, "armR", -0.35 * S(w + Math.PI), 0, -0.05);
      rot(r, "torso", 0, 0.08 * S(w));
    },
    eat: (r, t) => {
      rot(r, "torso", 0.35);
      rot(r, "legL", -0.9);
      rot(r, "legR", -0.9);
      rot(r, "legLLower", 1.4);
      rot(r, "legRLower", 1.4);
      rot(r, "armR", -1.2 - 0.25 * S(t * 3), 0, -0.1);
      rot(r, "armRLower", -1.4);
      rot(r, "head", 0.2 + 0.1 * S(t * 3));
    },
    // 睡觉：蹲坐（沿用 eat 中已验证的屈膝角度）
    sleep: (r, t) => {
      sink(r, 0.2);
      scale(r, "torso", sleepBreathe(t));
      rot(r, "torso", 0.25);
      rot(r, "legL", -0.9);
      rot(r, "legR", -0.9);
      rot(r, "legLLower", 1.4);
      rot(r, "legRLower", 1.4);
      rot(r, "head", 0.35);
    },
  },
  ...INVERTEBRATE_CLIPS,
  ...PLANT_CLIPS,
  ...VERTEBRATE_CLIPS,
};

/** 该原型实际支持的片段。 */
export function clipsFor(archetype: ModelArchetype): AnimationClipName[] {
  return Object.keys(CLIPS[archetype]) as AnimationClipName[];
}

/**
 * 应用一帧动画。不支持的片段退回 idle；`t` 为动画时钟（秒），`phase` 让多个个体错开节奏。
 * 返回实际播放的片段。
 */
export function applyClip(rig: Rig, archetype: ModelArchetype, clip: AnimationClipName, t: number, phase = 0): AnimationClipName {
  resetPose(rig);
  const clips = CLIPS[archetype];
  const name = clips[clip] ? clip : "idle";
  clips[name]?.(rig, t + phase, phase);
  return name;
}
