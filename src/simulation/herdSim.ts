import type { AnimationClipName, LonLat, VisualizationAsset } from "../data/schema";
import { seededRandom } from "./BehaviorSystem";
import { hashString } from "./hash";
import { shareHabitat, type HerdTraits } from "./herdTraits";

/**
 * 地球上生物群的行为（设计 §4）：idle / wander / eat / sleep / chase / flee。
 * 地球上的模型不是真实比例，距离一律用角度（度）；时间为渲染时钟（秒），与模拟倍率无关。
 * 纯函数 + 可注入随机数。不表现捕获 / 死亡。
 */

export type HerdState = "idle" | "wander" | "eat" | "sleep" | "chase" | "flee";

export const WANDER_RADIUS_DEG: Record<VisualizationAsset["locomotion"], number> = { none: 0, crawl: 0.05, walk: 0.15, swim: 0.2, fly: 0.35 };
export const MAX_CHASES = 8;
const CHASE_RANGE_DEG = 1;
const CHASE_ESCAPE_DEG = 1.5;
/** 每只空闲的捕食者每秒尝试发起追逐的概率。 */
const CHASE_RATE = 0.2;
const HERD_WINDOW_S = 10;
const D = Math.PI / 180;

export interface HerdAgent {
  key: string;
  traits: HerdTraits;
  /** 家 = 散布位置（随板块漂移由渲染层每帧更新）。 */
  home: LonLat;
  /** 成群的分组（物种 + 点位）。 */
  group: string;
  /** 相对家的偏移（度，向东 / 向北）。 */
  e: number;
  n: number;
  /** 朝向（弧度，0 = 北，π/2 = 东）。 */
  heading: number;
  state: HerdState;
  timer: number;
  targetE: number;
  targetN: number;
  cooldown: number;
  partner: string | null;
  phase: number;
  /** 动画时间（按片段播放速率累积）。 */
  animT: number;
  /** 成群时相对共享目标的固定偏移。 */
  slotE: number;
  slotN: number;
}

export function createHerdAgent(key: string, traits: HerdTraits, home: LonLat, group: string, rand: () => number): HerdAgent {
  const r = WANDER_RADIUS_DEG[traits.locomotion];
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * r * 0.5;
  return {
    key, traits, home, group,
    e: Math.cos(a) * d,
    n: Math.sin(a) * d,
    heading: rand() * Math.PI * 2,
    state: "idle",
    timer: 1 + rand() * 3,
    targetE: 0,
    targetN: 0,
    cooldown: 5 + rand() * 10,
    partner: null,
    phase: rand() * 10,
    animT: 0,
    slotE: (rand() - 0.5) * r * 0.4,
    slotN: (rand() - 0.5) * r * 0.4,
  };
}

export function agentLonLat(a: HerdAgent): LonLat {
  const c = Math.max(0.05, Math.cos(a.home[1] * D));
  return [a.home[0] + a.e / c, Math.max(-89.9, Math.min(89.9, a.home[1] + a.n))];
}

/** a → b 的相对位置（a 处的局部度，向东 / 向北）。 */
function delta(a: HerdAgent, b: HerdAgent): [number, number] {
  const pa = agentLonLat(a);
  const pb = agentLonLat(b);
  const dl = ((((pb[0] - pa[0] + 180) % 360) + 360) % 360) - 180;
  return [dl * Math.cos(pa[1] * D), pb[1] - pa[1]];
}

export function canPrey(pred: HerdTraits, prey: HerdTraits): boolean {
  if (pred.speciesId === prey.speciesId || pred.hominin || prey.hominin) return false;
  if (pred.diet !== "carnivore" && pred.diet !== "omnivore") return false;
  if (pred.locomotion === "none" || prey.locomotion === "none") return false;
  if (!prey.diet || prey.diet === "unknown") return false;
  if (!shareHabitat(pred.groups, prey.groups)) return false;
  const r = prey.sizeM / pred.sizeM;
  return r >= 0.1 && r <= 1.5;
}

/** 成群物种的共享漫游目标：同一分组在同一个 10 秒窗口内相同。 */
export function groupTarget(group: string, clock: number, radius: number): [number, number] {
  const r = seededRandom(hashString(`${group}#${Math.floor(clock / HERD_WINDOW_S)}`));
  const a = r() * Math.PI * 2;
  const d = Math.sqrt(r()) * radius;
  return [Math.cos(a) * d, Math.sin(a) * d];
}

export function herdClip(state: HerdState): { clip: AnimationClipName; rate: number } {
  if (state === "chase" || state === "flee") return { clip: "move", rate: 1.8 };
  if (state === "wander") return { clip: "move", rate: 1 };
  return { clip: state, rate: 1 };
}

const busy = (a: HerdAgent) => a.state === "chase" || a.state === "flee";

function pickWander(a: HerdAgent, clock: number, rand: () => number) {
  const r = WANDER_RADIUS_DEG[a.traits.locomotion];
  if (a.traits.herds) {
    const [e, n] = groupTarget(a.group, clock, r);
    a.targetE = e + a.slotE;
    a.targetN = n + a.slotN;
    return;
  }
  const ang = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * r;
  a.targetE = Math.cos(ang) * d;
  a.targetN = Math.sin(ang) * d;
}

function steer(a: HerdAgent, de: number, dn: number, speed: number, dt: number, turn: number) {
  let d = Math.atan2(de, dn) - a.heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  a.heading += Math.max(-turn * dt, Math.min(turn * dt, d));
  const step = speed * dt;
  a.e += Math.sin(a.heading) * step;
  a.n += Math.cos(a.heading) * step;
}

function clampHome(a: HerdAgent, max: number) {
  const r = Math.hypot(a.e, a.n);
  if (r > max) {
    a.e *= max / r;
    a.n *= max / r;
  }
}

function endChase(a: HerdAgent, rand: () => number) {
  const wasChasing = a.state === "chase";
  a.partner = null;
  a.state = wasChasing && a.traits.canEat && rand() < 0.5 ? "eat" : "idle";
  a.timer = 2 + rand() * 3;
  a.cooldown = 20 + rand() * 20;
}

function startChases(agents: HerdAgent[], dt: number, rand: () => number) {
  let active = agents.filter((a) => a.state === "chase").length;
  for (const pred of agents) {
    if (active >= MAX_CHASES) return;
    if (busy(pred) || pred.state === "sleep" || pred.cooldown > 0) continue;
    if (rand() >= dt * CHASE_RATE) continue;
    let best: HerdAgent | null = null;
    let bestD = CHASE_RANGE_DEG;
    for (const prey of agents) {
      if (prey === pred || busy(prey) || prey.cooldown > 0 || !canPrey(pred.traits, prey.traits)) continue;
      const [de, dn] = delta(pred, prey);
      const d = Math.hypot(de, dn);
      if (d < bestD) {
        best = prey;
        bestD = d;
      }
    }
    if (!best) continue;
    const dur = 4 + rand() * 4;
    pred.state = "chase";
    pred.timer = dur;
    pred.partner = best.key;
    best.state = "flee";
    best.timer = dur;
    best.partner = pred.key;
    active++;
  }
}

function stepOne(a: HerdAgent, dt: number, clock: number, rand: () => number, byKey: Map<string, HerdAgent>) {
  const t = a.traits;
  if (t.locomotion === "none") {
    a.state = "idle";
    return;
  }
  a.cooldown = Math.max(0, a.cooldown - dt);
  a.timer -= dt;
  const r = WANDER_RADIUS_DEG[t.locomotion];
  const v = r / 6;
  if (busy(a)) {
    const other = a.partner ? byKey.get(a.partner) : undefined;
    const [de, dn] = other ? delta(a, other) : [0, 0];
    if (!other || other.partner !== a.key || a.timer <= 0 || Math.hypot(de, dn) > CHASE_ESCAPE_DEG) {
      endChase(a, rand);
      if (other && other.partner === a.key) endChase(other, rand);
      return;
    }
    if (a.state === "chase") steer(a, de, dn, v * 1.6, dt, 4);
    else steer(a, -de, -dn, v * 1.4, dt, 4);
    clampHome(a, r * 3);
    return;
  }
  if (a.state === "wander") {
    const de = a.targetE - a.e;
    const dn = a.targetN - a.n;
    if (Math.hypot(de, dn) <= v * dt || a.timer <= 0) {
      if (t.locomotion === "fly") {
        pickWander(a, clock, rand);
        a.timer = 6 + rand() * 6;
      } else {
        a.state = t.canEat && rand() < 0.45 ? "eat" : "idle";
        a.timer = 2 + rand() * 3;
      }
      return;
    }
    steer(a, de, dn, v, dt, 2);
    clampHome(a, r);
    return;
  }
  if (a.timer > 0) return;
  if (a.state !== "sleep" && t.canSleep && rand() < 0.15) {
    a.state = "sleep";
    a.timer = 8 + rand() * 7;
    return;
  }
  a.state = "wander";
  pickWander(a, clock, rand);
  a.timer = 4 + rand() * 6;
}

/** 推进全部个体一步。dt 被限制在 0.25 s 以内；关闭行为时全部原地 idle。 */
export function stepHerd(agents: HerdAgent[], dtRaw: number, clock: number, enabled: boolean, rand: () => number): void {
  const dt = Math.min(Math.max(dtRaw, 0), 0.25);
  if (!enabled) {
    for (const a of agents) {
      a.state = "idle";
      a.partner = null;
    }
    return;
  }
  const byKey = new Map(agents.map((a) => [a.key, a]));
  startChases(agents, dt, rand);
  for (const a of agents) stepOne(a, dt, clock, rand, byKey);
}
