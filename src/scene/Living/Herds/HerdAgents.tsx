import { useFrame, type RootState, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Vector3, type Group, type PerspectiveCamera } from "three";
import type { LonLat, VisualizationAsset } from "../../../data/schema";
import { SPECIES_BY_ID } from "../../../data/species";
import { VISUAL_BY_ID } from "../../../data/visuals";
import { useSelectionStore } from "../../../state/selectionStore";
import { useSettingsStore } from "../../../state/settingsStore";
import { useViewStore } from "../../../state/viewStore";
import { herdModelPx } from "../../../simulation/abundance";
import { seededRandom, updateInterval } from "../../../simulation/BehaviorSystem";
import { agentLonLat, createHerdAgent, herdClip, stepHerd, type HerdAgent } from "../../../simulation/herdSim";
import { traitsFor } from "../../../simulation/herdTraits";
import { choosePromoted } from "../../../simulation/promotion";
import { CONTINENT_ALTITUDE } from "../../../simulation/scatter";
import { angularDistanceDeg, lonLatToXYZ } from "../../../utils/geo";
import { applyClip, clipsFor } from "../../Models/animation";
import { useAnimationClock } from "../../Models/animationClock";
import type { Lod, Rig, Style } from "../../Models/rig";
import { SURFACE_R } from "./herdPicking";
import { herdRuntime } from "./herdRuntime";
import { RigPool } from "./rigPool";
import { surfaceQuaternion } from "./surfaceFrame";

/**
 * 完整档（设计 §3–§4）：洲视图中离视野中心最近、屏幕尺寸 ≥ 14 px 的动物升为完整 Rig，
 * 跑 herdSim 行为。升档个体在实例档中隐藏；出现 / 消失各有 0.25 s 缩放过渡。
 *
 * 逐帧修改的逻辑放在组件外的普通函数里：React Compiler 不允许在 hook 回调里直接修改
 * props / useMemo 返回的对象（同 Herds.tsx 的 tickHerd）。
 */

const MIN_PX = 14;
const APPEAR_S = 0.25;
const RECHECK_S = 0.5;

interface Entry {
  key: string;
  agent: HerdAgent;
  asset: VisualizationAsset;
  appear: number;
  leaving: boolean;
}

function promotionCandidates(): string[] {
  const v = useViewStore.getState();
  if (v.altitude >= CONTINENT_ALTITUDE) return [];
  const center: LonLat = [v.lon, v.lat];
  const c: { k: string; d: number }[] = [];
  for (const p of herdRuntime.placed.values()) {
    if (p.mobile && herdModelPx(p.sizeM, v.altitude) >= MIN_PX) c.push({ k: p.key, d: angularDistanceDeg(center, p.lonLat) });
  }
  return c.sort((a, b) => a.d - b.d).map((x) => x.k);
}

/** 按候选更新条目；返回是否新增了条目（需要重新渲染）。 */
function syncEntries(map: Map<string, Entry>, sorted: string[], low: boolean, rand: () => number): boolean {
  const current = new Set([...map.values()].filter((e) => !e.leaving).map((e) => e.key));
  const max = Math.round(low ? herdRuntime.promoteMax / 2 : herdRuntime.promoteMax);
  const keep = Math.round(max * 1.1);
  const next = choosePromoted(sorted, current, max, keep);
  for (const e of map.values()) if (!next.has(e.key)) e.leaving = true;
  let added = false;
  for (const k of next) {
    const e = map.get(k);
    if (e) {
      e.leaving = false;
      continue;
    }
    const p = herdRuntime.placed.get(k);
    const sp = p && SPECIES_BY_ID[p.speciesId];
    const asset = sp?.visualizationId ? VISUAL_BY_ID[sp.visualizationId] : undefined;
    if (!p || !sp || !asset) continue;
    // 从实例所在位置、沿用实例朝向开始，升档时不跳变
    const agent = createHerdAgent(k, traitsFor(sp, asset, clipsFor(asset.archetype)), p.lonLat, p.siteGroup, rand, { heading: p.heading, offset: [0, 0] });
    map.set(k, { key: k, agent, asset, appear: 0, leaving: false });
    herdRuntime.promoted.add(k);
    added = true;
  }
  if (added) herdRuntime.version++;
  return added;
}

interface AgentsTick {
  /** 距下次重选升档的秒数（真实时间）。 */
  recheck: number;
  /** 上一帧的动画时钟。 */
  lastClock: number | null;
}

/**
 * 每帧：升 / 降档、行为步进、过渡推进；返回条目集合是否变化。
 * 行为按动画时钟的增量步进：时钟冻结（关闭动画，或暂停且不继续 Idle）时个体不移动；
 * 重选与出现 / 消失过渡仍按真实时间。
 */
function tickAgents(map: Map<string, Entry>, st: AgentsTick, dt: number, clock: number, rand: () => number): boolean {
  const s = useSettingsStore.getState();
  let changed = false;
  const simDt = Math.max(0, clock - (st.lastClock ?? clock));
  st.lastClock = clock;
  st.recheck -= dt;
  if (st.recheck <= 0) {
    st.recheck = RECHECK_S;
    changed = syncEntries(map, promotionCandidates(), s.lowPerformance, rand);
  }
  const list: HerdAgent[] = [];
  for (const [k, e] of map) {
    const p = herdRuntime.placed.get(k);
    if (!p) {
      // 物种离开生存范围或不再被散布：立即清除（追逐配对由 herdSim 自动结束）
      map.delete(k);
      herdRuntime.promoted.delete(k);
      herdRuntime.version++;
      changed = true;
      continue;
    }
    e.agent.home = p.lonLat;
    list.push(e.agent);
  }
  stepHerd(list, simDt, clock, s.animationsEnabled && s.behaviorEnabled, rand);
  for (const [k, e] of map) {
    e.appear += (e.leaving ? -dt : dt) / APPEAR_S;
    if (e.leaving && e.appear <= 0) {
      map.delete(k);
      herdRuntime.promoted.delete(k);
      herdRuntime.version++;
      changed = true;
    } else e.appear = Math.min(1, e.appear);
  }
  herdRuntime.agents = map.size;
  herdRuntime.chases = list.filter((a) => a.state === "chase").length;
  return changed;
}

const easeOut = (x: number) => 1 - (1 - x) * (1 - x);

interface CreatureTick {
  lastClock: number | null;
  frame: number;
}

interface CreatureScratch {
  p: Vector3;
  n: Vector3;
  c: Vector3;
}

function tickCreature(g: Group, entry: Entry, rig: Rig, clock: number, st: CreatureTick, tmp: CreatureScratch, { camera, size }: RootState) {
  const a = entry.agent;
  const { clip, rate } = herdClip(a.state);
  a.animT += (clock - (st.lastClock ?? clock)) * rate;
  st.lastClock = clock;
  const ll = agentLonLat(a);
  tmp.p.set(...lonLatToXYZ(ll[0], ll[1], SURFACE_R));
  tmp.n.copy(tmp.p).normalize();
  g.visible = tmp.n.dot(tmp.c.copy(camera.position).sub(tmp.p).normalize()) > 0.05;
  if (!g.visible) return;
  g.position.copy(tmp.p);
  surfaceQuaternion(ll, a.heading, g.quaternion);
  const cam = camera as PerspectiveCamera;
  const dist = cam.position.distanceTo(tmp.p);
  const worldPerPx = (2 * dist * Math.tan((cam.fov * Math.PI) / 360)) / Math.max(1, size.height);
  const px = herdModelPx(entry.asset.sizeM, useViewStore.getState().altitude);
  g.scale.setScalar(((worldPerPx * px) / rig.extent) * easeOut(Math.max(0, Math.min(1, entry.appear))));
  st.frame++;
  if (st.frame % updateInterval(dist / (worldPerPx * px), false, useSettingsStore.getState().lowPerformance) !== 0) return;
  applyClip(rig, entry.asset.archetype, clip, a.animT, a.phase);
}

function HerdCreature({ entry, pool, lod, style, animT }: { entry: Entry; pool: RigPool; lod: Lod; style: Style; animT: RefObject<number> }) {
  const rig = useMemo(() => pool.acquire(entry.asset, lod, style), [pool, entry.asset, lod, style]);
  useEffect(() => {
    pool.reclaim(rig, entry.asset, lod, style); // StrictMode 重新挂载时撤销上一次 release
    return () => pool.release(rig, entry.asset, lod, style);
  }, [pool, rig, entry.asset, lod, style]);
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  const ref = useRef<Group>(null);
  const tmp = useMemo<CreatureScratch>(() => ({ p: new Vector3(), n: new Vector3(), c: new Vector3() }), []);
  const st = useRef<CreatureTick>({ lastClock: null, frame: 0 });

  useFrame((state) => {
    if (ref.current) tickCreature(ref.current, entry, rig, animT.current, st.current, tmp, state);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // 背面隐藏或仍在出现 / 消失过渡中的个体不响应点击
    if (e.delta > 4 || !ref.current?.visible || entry.appear < 0.2) return;
    e.stopPropagation();
    selectSpecies(entry.agent.traits.speciesId);
  };

  return (
    <group ref={ref} onClick={onClick} name={`herd-agent-${entry.key}`}>
      <primitive object={rig.root} />
    </group>
  );
}

export function HerdAgents() {
  const style = useSettingsStore((s) => s.visualStyle);
  const lod: Lod = useSettingsStore((s) => s.modelDetail) === "high" ? 0 : 1;
  const pool = useMemo(() => new RigPool(), []);
  useEffect(() => {
    pool.reopen();
    return () => pool.dispose();
  }, [pool]);
  const entries = useRef(new Map<string, Entry>());
  const [list, setList] = useState<Entry[]>([]);
  const rand = useMemo(() => seededRandom(7), []);
  const animT = useAnimationClock();
  const tick = useRef<AgentsTick>({ recheck: 0, lastClock: null });
  // 切换风格 / 细节后，旧组合的空闲 rig 不会再被取用（在子组件释放旧 rig 之后运行）
  useEffect(() => pool.prune((l, s) => l === lod && s === style), [pool, lod, style]);

  useEffect(() => {
    const map = entries.current;
    // StrictMode 重新挂载：恢复上一次清理移除的升档标记
    for (const k of map.keys()) herdRuntime.promoted.add(k);
    herdRuntime.version++;
    return () => {
      for (const k of map.keys()) herdRuntime.promoted.delete(k);
      herdRuntime.version++;
      herdRuntime.agents = 0;
      herdRuntime.chases = 0;
    };
  }, []);

  useFrame((_, dt) => {
    if (tickAgents(entries.current, tick.current, dt, animT.current, rand)) setList([...entries.current.values()]);
  });

  return (
    <group name="herd-agents">
      {list.map((e) => (
        <HerdCreature key={e.key} entry={e} pool={pool} lod={lod} style={style} animT={animT} />
      ))}
    </group>
  );
}
