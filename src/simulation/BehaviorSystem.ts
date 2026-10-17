import type { AnimationClipName, VisualizationAsset } from "../data/schema";

/**
 * 轻量行为规则（PLAN §6.5）：在限定范围内漫游、停留播放 Idle、偶尔进食。
 * 纯函数 + 可注入随机数，便于测试；不做食物链、繁殖等生态仿真。
 * 时间单位为渲染时钟的秒，与模拟时间无关。
 */

export type BehaviorState = "idle" | "wander" | "eat";

export interface Agent {
  x: number;
  z: number;
  /** 朝向（弧度，0 = +Z）。 */
  heading: number;
  state: BehaviorState;
  /** 当前状态剩余时间（秒）。 */
  timer: number;
  targetX: number;
  targetZ: number;
  /** 动画相位偏移，让个体之间不同步。 */
  phase: number;
}

export interface BehaviorConfig {
  /** 漫游半径（米）。 */
  radius: number;
  /** 移动速度（米/秒）。 */
  speed: number;
  canEat: boolean;
  /** 不移动的对象（植物）始终 idle。 */
  stationary: boolean;
  /** 飞行 / 游动：持续移动，不停下进食。 */
  continuous: boolean;
}

export function behaviorConfigFor(asset: VisualizationAsset, enabled: boolean): BehaviorConfig {
  const stationary = asset.locomotion === "none" || !enabled;
  return {
    radius: asset.sizeM * (asset.locomotion === "fly" ? 6 : 4),
    // 大致按体型给出步速：体长的 0.3 倍/秒，飞行与游动更快
    speed: asset.sizeM * (asset.locomotion === "fly" ? 1.2 : asset.locomotion === "swim" ? 0.6 : 0.3),
    canEat: asset.animationSet.includes("eat"),
    stationary,
    continuous: asset.locomotion === "fly",
  };
}

export function createAgent(rand: () => number, radius: number): Agent {
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * radius * 0.7;
  return {
    x: Math.cos(a) * r,
    z: Math.sin(a) * r,
    heading: rand() * Math.PI * 2,
    state: "idle",
    timer: 1 + rand() * 3,
    targetX: 0,
    targetZ: 0,
    phase: rand() * 10,
  };
}

function pickTarget(agent: Agent, cfg: BehaviorConfig, rand: () => number) {
  const a = rand() * Math.PI * 2;
  const r = Math.sqrt(rand()) * cfg.radius;
  agent.targetX = Math.cos(a) * r;
  agent.targetZ = Math.sin(a) * r;
}

/** 推进一个个体的行为。dt 会被限制，避免失焦后一次跳很远。 */
export function stepAgent(agent: Agent, dtRaw: number, cfg: BehaviorConfig, rand: () => number): void {
  const dt = Math.min(dtRaw, 0.25);
  if (cfg.stationary) {
    agent.state = "idle";
    return;
  }
  agent.timer -= dt;
  if (agent.state === "wander") {
    const dx = agent.targetX - agent.x;
    const dz = agent.targetZ - agent.z;
    const dist = Math.hypot(dx, dz);
    const step = cfg.speed * dt;
    if (dist <= step || agent.timer <= 0) {
      if (cfg.continuous) {
        pickTarget(agent, cfg, rand);
        agent.timer = 6 + rand() * 6;
      } else {
        agent.state = cfg.canEat && rand() < 0.45 ? "eat" : "idle";
        agent.timer = 2 + rand() * 3;
      }
      return;
    }
    // 平滑转向
    const want = Math.atan2(dx, dz);
    let d = want - agent.heading;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    agent.heading += Math.max(-2 * dt, Math.min(2 * dt, d));
    agent.x += Math.sin(agent.heading) * step;
    agent.z += Math.cos(agent.heading) * step;
    // 保持在范围内
    const r = Math.hypot(agent.x, agent.z);
    if (r > cfg.radius) {
      agent.x *= cfg.radius / r;
      agent.z *= cfg.radius / r;
    }
    return;
  }
  if (agent.timer <= 0) {
    agent.state = "wander";
    pickTarget(agent, cfg, rand);
    agent.timer = 4 + rand() * 6;
  }
}

export function clipForState(state: BehaviorState): AnimationClipName {
  return state === "wander" ? "move" : state;
}

/**
 * 按距离与重要性降低更新频率（PLAN §6.5）：返回每隔几帧更新一次。
 * distanceRatio = 到相机距离 / 模型尺寸；lowPerformance 时整体减半。
 */
export function updateInterval(distanceRatio: number, important: boolean, lowPerformance: boolean): number {
  let n = distanceRatio < 20 ? 1 : distanceRatio < 60 ? 2 : distanceRatio < 150 ? 4 : 8;
  if (important) n = Math.max(1, Math.floor(n / 2));
  if (lowPerformance) n *= 2;
  return n;
}

/** 可复现的伪随机数（mulberry32）。 */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
