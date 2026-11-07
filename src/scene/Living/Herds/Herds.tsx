import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { InstancedBufferAttribute, InstancedMesh, Matrix4, Quaternion, Vector3, type Group, type Material } from "three";
import type { LonLat, PaleoPointsFile, VisualizationAsset } from "../../../data/schema";
import { SPECIES_BY_ID } from "../../../data/species";
import { VISUAL_BY_ID } from "../../../data/visuals";
import { useGeographyStore } from "../../../state/geographyStore";
import { currentPaleoFrame, paleoFrameNow } from "../../../state/paleoFrame";
import { useFossilSitesStore, useModernRangesStore, usePaleoPointsStore, useSceneStore } from "../../../state/sceneStore";
import { useSelectionStore } from "../../../state/selectionStore";
import { useSettingsStore, type VisualStyle } from "../../../state/settingsStore";
import { useViewStore } from "../../../state/viewStore";
import { herdModelPx } from "../../../simulation/abundance";
import { placementNeed, speciesTier } from "../../../simulation/herdTraits";
import { landGridFromOutlines } from "../../../simulation/landGrid";
import { siteInFrame } from "../../../simulation/paleoPositions";
import {
  buildHerd,
  CONTINENT_ALTITUDE,
  HERD_MAX_ALTITUDE,
  individualsPerSite,
  scatterRadiusDeg,
  type HerdIndividual,
  type HerdSpeciesInput,
} from "../../../simulation/scatter";
import { lonLatToXYZ, offsetLonLat } from "../../../utils/geo";
import { useAnimationClock } from "../../Models/animationClock";
import { bakeSpecies } from "./bakeSpecies";
import { pickIndividual, projectIndividual, SURFACE_R } from "./herdPicking";
import { herdRuntime } from "./herdRuntime";
import { createHerdOutlineMaterial, createHerdToneMaterial, createHerdUniforms, HERD_SHARED, herdCapacity, motionKind, type HerdUniforms } from "./instancedHerd";
import { surfaceQuaternion } from "./surfaceFrame";

/**
 * 实例档（设计 §2–§3）：高度 < 4 时按丰度散布的微缩模型，每物种 2 个 InstancedMesh。
 * 位置随板块漂移更新（形变比例量化变化时），尺寸 / 背面 / 待机动作在着色器中完成。
 */

const F_STEPS = 2000;
const CAP = 2000;

interface SpeciesHerd {
  speciesId: string;
  asset: VisualizationAsset;
  modern: LonLat[];
  living?: LonLat[];
  members: HerdIndividual[];
}

function frameKey(): string {
  const pf = currentPaleoFrame();
  return pf.kind === "paleo" ? `${pf.ma}:${Math.round(pf.f * F_STEPS)}` : "modern";
}

interface HerdMeshes {
  fill: InstancedMesh;
  outline: InstancedMesh | null;
  attr: InstancedBufferAttribute;
}

interface TickState {
  fKey: string;
  members: HerdIndividual[] | null;
  /** 新建的网格（换视觉风格时重建）需要重新写入全部矩阵与升档标记。 */
  meshes: HerdMeshes | null;
  version: number;
}

interface Scratch {
  m: Matrix4;
  q: Quaternion;
  p: Vector3;
  s: Vector3;
}

/**
 * 每帧更新一个物种的实例：尺寸 uniform、板块漂移后的位置（量化帧变化时）与升档隐藏。
 * 放在组件外：React Compiler 不允许在 hook 回调里直接修改 useMemo 返回的对象。
 */
function tickHerd(
  h: SpeciesHerd,
  paleo: PaleoPointsFile | null,
  uniforms: HerdUniforms,
  meshes: HerdMeshes,
  s: TickState,
  prevKeys: { current: Set<string> },
  tmp: Scratch,
) {
  uniforms.uPx.value = herdModelPx(h.asset.sizeM, useViewStore.getState().altitude);
  const fKey = frameKey();
  if (s.meshes !== meshes) {
    // 在这里而非 useMemo 中绑定：开发模式 StrictMode 会把 useMemo 跑两遍并丢弃第二次的结果，
    // 若在 useMemo 里 setAttribute，几何体上留下的会是被丢弃那份的属性
    const geo = meshes.fill.geometry;
    const prev = geo.getAttribute("aHerd");
    // 容量增长换了新属性：先释放几何体的 GPU 缓冲（含旧 aHerd），下次渲染时按当前属性重新上传
    if (prev && prev !== meshes.attr) geo.dispose();
    geo.setAttribute("aHerd", meshes.attr);
    s.meshes = meshes;
    s.fKey = "";
    s.members = null; // 新网格：重写数量、相位、全部矩阵与升档标记
  }
  if (fKey !== s.fKey || s.members !== h.members) {
    if (s.members !== h.members) {
      const next = new Set(h.members.map((m) => m.key));
      for (const k of prevKeys.current) if (!next.has(k)) herdRuntime.placed.delete(k);
      prevKeys.current = next;
      meshes.fill.count = h.members.length;
      if (meshes.outline) meshes.outline.count = h.members.length;
      h.members.forEach((m, i) => meshes.attr.setX(i, m.phase));
      s.version = -1;
    }
    const pf = currentPaleoFrame();
    const base = h.living ?? h.modern;
    h.members.forEach((m, i) => {
      const site = siteInFrame(m.speciesId, h.modern, m.siteIndex, pf, paleo, h.living) ?? base[m.siteIndex]!;
      const ll = offsetLonLat(site, m.bearing, m.distDeg);
      tmp.p.set(...lonLatToXYZ(ll[0], ll[1], SURFACE_R));
      surfaceQuaternion(ll, m.heading, tmp.q);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      meshes.fill.setMatrixAt(i, tmp.m);
      meshes.outline?.setMatrixAt(i, tmp.m);
      herdRuntime.placed.set(m.key, {
        key: m.key,
        speciesId: m.speciesId,
        lonLat: ll,
        sizeM: h.asset.sizeM,
        mobile: h.asset.locomotion !== "none",
        siteGroup: `${m.speciesId}#${m.siteIndex}`,
        heading: m.heading,
      });
    });
    meshes.fill.instanceMatrix.needsUpdate = true;
    if (meshes.outline) meshes.outline.instanceMatrix.needsUpdate = true;
    s.fKey = fKey;
    s.members = h.members;
  }
  if (s.version !== herdRuntime.version) {
    h.members.forEach((m, i) => meshes.attr.setY(i, herdRuntime.promoted.has(m.key) ? 0 : 1));
    meshes.attr.needsUpdate = true;
    s.version = herdRuntime.version;
  }
}

function HerdSpecies({ h, paleo, style }: { h: SpeciesHerd; paleo: PaleoPointsFile | null; style: VisualStyle }) {
  const baked = useMemo(() => bakeSpecies(h.asset, style), [h.asset, style]);
  useEffect(() => () => baked.dispose(), [baked]);
  const uniforms = useMemo(() => createHerdUniforms(baked.extent, motionKind(h.asset)), [baked, h.asset]);
  // 容量只在成员数超过时翻倍（渲染期间调整 state）；成员变化本身只写入已有缓冲（见 tickHerd）
  const [capacity, setCapacity] = useState(() => herdCapacity(0, h.members.length));
  const need = herdCapacity(capacity, h.members.length);
  if (need !== capacity) setCapacity(need);
  const meshes = useMemo<HerdMeshes>(() => {
    const attr = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    const fill = new InstancedMesh(baked.fill, createHerdToneMaterial(style, uniforms), capacity);
    const outline = baked.outline ? new InstancedMesh(baked.fill, createHerdOutlineMaterial(uniforms), capacity) : null;
    for (const m of [fill, outline]) {
      if (!m) continue;
      m.count = 0; // 首帧由 tickHerd 设为成员数
      m.frustumCulled = false; // 实际尺寸在着色器里决定，包围球不可信
      m.raycast = () => {}; // 点选走屏幕空间（herdPicking）
    }
    return { fill, outline, attr };
  }, [baked, uniforms, style, capacity]);
  useEffect(
    () => () => {
      (meshes.fill.material as Material).dispose();
      (meshes.outline?.material as Material | undefined)?.dispose();
      meshes.fill.dispose(); // 释放 instanceMatrix 的 GPU 缓冲
      meshes.outline?.dispose();
    },
    [meshes],
  );
  // 卸载时从共享表中移除本物种的个体（成员变化时只移除不再存在的键，见 useFrame）
  const prevKeys = useRef<Set<string>>(new Set());
  useEffect(
    () => () => {
      for (const k of prevKeys.current) herdRuntime.placed.delete(k);
    },
    [],
  );

  const st = useRef<TickState>({ fKey: "", members: null, meshes: null, version: -1 });
  const tmp = useMemo<Scratch>(
    () => ({
      m: new Matrix4(),
      q: new Quaternion(),
      p: new Vector3(),
      s: new Vector3(1, 1, 1),
    }),
    [],
  );

  useFrame(() => tickHerd(h, paleo, uniforms, meshes, st.current, prevKeys, tmp));

  return (
    <group name={`herd-${h.speciesId}`}>
      <primitive object={meshes.fill} />
      {meshes.outline && <primitive object={meshes.outline} />}
    </group>
  );
}

/** 实例档点选：按下与抬起距离 < 4 px 视为点击，取屏幕上最近的个体。 */
function useHerdPicking() {
  const { gl, camera } = useThree();
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  useEffect(() => {
    const dom = gl.domElement;
    let down: { x: number; y: number } | null = null;
    // 只认主指针的主键（左键 / 单指）
    const primary = (e: PointerEvent) => e.isPrimary && e.button === 0;
    const onDown = (e: PointerEvent) => {
      down = primary(e) ? { x: e.clientX, y: e.clientY } : null;
    };
    const onUp = (e: PointerEvent) => {
      if (!primary(e)) return;
      const d = down;
      down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
      const alt = useViewStore.getState().altitude;
      // 已升为完整档的个体在实例档中隐藏，不参与点选（完整档自己处理点击）
      const hit = pickIndividual(e.clientX, e.clientY, camera, dom.getBoundingClientRect(), alt, herdRuntime.placed.values(), herdRuntime.promoted);
      if (hit) selectSpecies(hit.speciesId);
    };
    const onCancel = () => {
      down = null;
    };
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onCancel);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onCancel);
    };
  }, [gl, camera, selectSpecies]);
}

/** 开发模式调试句柄（e2e 与性能测量用）。 */
function useHerdDebugHandle() {
  const { gl, camera } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __herds?: unknown };
    w.__herds = {
      stats: () => ({
        instances: herdRuntime.placed.size,
        agents: herdRuntime.agents,
        chases: herdRuntime.chases,
        drawCalls: gl.info.render.calls,
        altitude: useViewStore.getState().altitude,
        species: [...new Set([...herdRuntime.placed.values()].map((p) => p.speciesId))].sort().join(","),
      }),
      setPromoteMax: (n: number) => {
        herdRuntime.promoteMax = n;
      },
      focus: (lon: number, lat: number, altitude: number) => useViewStore.getState().requestCamera("focus", { lon, lat, altitude }),
      /** 离画面中心最近、未升档的个体的点击位置（客户端坐标）。 */
      pickPoint: () => {
        const rect = gl.domElement.getBoundingClientRect();
        const alt = useViewStore.getState().altitude;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let best: {
          x: number;
          y: number;
          speciesId: string;
          name: string;
        } | null = null;
        let bestD = Infinity;
        for (const p of herdRuntime.placed.values()) {
          if (herdRuntime.promoted.has(p.key)) continue;
          const s = projectIndividual(p, camera, rect, alt);
          if (!s || s.x < rect.left + 40 || s.x > rect.right - 40 || s.y < rect.top + 40 || s.y > rect.bottom - 40) continue;
          const d = Math.hypot(s.x - cx, s.y - cy);
          if (d < bestD) {
            bestD = d;
            best = {
              x: s.x,
              y: s.y,
              speciesId: p.speciesId,
              name: SPECIES_BY_ID[p.speciesId]?.commonName ?? p.speciesId,
            };
          }
        }
        return best;
      },
      measureFps: (seconds: number) =>
        new Promise<{ avg: number; low1: number }>((resolve) => {
          const frames: number[] = [];
          let last = performance.now();
          const end = last + seconds * 1000;
          const tick = (t: number) => {
            frames.push(t - last);
            last = t;
            if (t < end) requestAnimationFrame(tick);
            else {
              const fps = frames.map((d) => 1000 / Math.max(d, 1e-3)).sort((a, b) => a - b);
              resolve({
                avg: frames.length / seconds,
                low1: fps[Math.floor(fps.length * 0.01)] ?? 0,
              });
            }
          };
          requestAnimationFrame(tick);
        }),
    };
    return () => {
      delete w.__herds;
    };
  }, [gl, camera]);
}

export function Herds() {
  const species = useSceneStore((s) => s.visible.species);
  const data = useFossilSitesStore((s) => s.data);
  const paleo = usePaleoPointsStore((s) => s.data);
  const slice = useGeographyStore((s) => s.slice);
  const outlines = useGeographyStore((s) => s.outlines);
  const ranges = useModernRangesStore((s) => s.data);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  const style = useSettingsStore((s) => s.visualStyle);
  // 视图量化后再参与选点，避免细微移动反复重建
  const lon = useViewStore((s) => Math.round(s.lon / 5) * 5);
  const lat = useViewStore((s) => Math.round(s.lat / 5) * 5);
  const altitude = useViewStore((s) => Math.round(s.altitude * 10) / 10);
  const continental = altitude < CONTINENT_ALTITUDE;
  // 海陆判定只在切片切换时重算（未形变的切片轮廓）
  const grid = useMemo(() => (outlines ? landGridFromOutlines(outlines) : null), [outlines]);

  const herds = useMemo<SpeciesHerd[]>(() => {
    if (!data || altitude >= HERD_MAX_ALTITUDE) return [];
    const frame = paleoFrameNow(slice);
    const meta = new Map<string, Omit<SpeciesHerd, "members">>();
    const inputs: HerdSpeciesInput[] = [];
    for (const s of species) {
      const asset = s.visualizationId ? VISUAL_BY_ID[s.visualizationId] : undefined;
      if (!asset) continue;
      const fossil = data.species[s.id];
      const modern = fossil?.sites ?? [];
      // 全新世的现生类群用现代观测点（GBIF），其余按化石点
      const live = frame.kind === "modern" ? ranges?.species[s.id] : undefined;
      const living = live?.sites.length ? live.sites : undefined;
      const base = living ?? modern;
      const sites: LonLat[] = [];
      const siteIndex: number[] = [];
      for (let i = 0; i < base.length; i++) {
        const p = siteInFrame(s.id, modern, i, frame, paleo, living);
        if (p) {
          sites.push(p);
          siteIndex.push(i);
        }
      }
      meta.set(s.id, { speciesId: s.id, asset, modern, living });
      const tier = speciesTier(fossil?.occurrences ?? 0, living ? live!.records : undefined);
      inputs.push({
        speciesId: s.id,
        sites,
        siteIndex,
        perSite: individualsPerSite(tier, asset.locomotion === "none", continental),
        radiusDeg: scatterRadiusDeg(tier),
        need: placementNeed(s.habitatIds),
        source: living ? "gbif" : "fossil",
      });
    }
    const all = buildHerd(inputs, { center: [lon, lat], altitude }, lowPerformance ? CAP / 2 : CAP, grid);
    const by = new Map<string, HerdIndividual[]>();
    for (const m of all) {
      const list = by.get(m.speciesId) ?? [];
      list.push(m);
      by.set(m.speciesId, list);
    }
    return [...by].map(([id, members]) => ({ ...meta.get(id)!, members }));
  }, [species, data, paleo, ranges, slice, grid, lon, lat, altitude, continental, lowPerformance]);

  const animT = useAnimationClock();
  const group = useRef<Group>(null);
  useFrame(({ gl }) => {
    HERD_SHARED.uHerdTime.value = animT.current;
    HERD_SHARED.uDpr.value = gl.getPixelRatio();
    if (group.current) group.current.visible = useViewStore.getState().altitude < HERD_MAX_ALTITUDE;
  });
  useHerdPicking();
  useHerdDebugHandle();

  return (
    <group ref={group} name="herds">
      {herds.map((h) => (
        <HerdSpecies key={h.speciesId} h={h} paleo={paleo} style={style} />
      ))}
    </group>
  );
}
