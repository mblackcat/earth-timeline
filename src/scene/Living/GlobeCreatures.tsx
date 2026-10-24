import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Quaternion, Vector3, type Group, type PerspectiveCamera } from "three";
import type { LonLat, PaleoPointsFile, VisualizationAsset } from "../../data/schema";
import { VISUAL_BY_ID } from "../../data/visuals";
import { useGeographyStore } from "../../state/geographyStore";
import { useFossilSitesStore, useModernRangesStore, usePaleoPointsStore, useSceneStore } from "../../state/sceneStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore } from "../../state/settingsStore";
import { useViewStore } from "../../state/viewStore";
import { globeModelPx } from "../../simulation/abundance";
import { updateInterval } from "../../simulation/BehaviorSystem";
import { pickCreatureSites } from "../../simulation/creatureSites";
import { siteInFrame } from "../../simulation/paleoPositions";
import { currentPaleoFrame, paleoFrameNow } from "../../state/paleoFrame";
import { lonLatToXYZ } from "../../utils/geo";
import { applyClip } from "../Models/animation";
import { useAnimationClock } from "../Models/animationClock";
import { useRig } from "../Models/useRig";

/**
 * 地球上的 LOD1：相机拉近到大陆尺度（L1 及更近）时，离视野中心最近的少量化石点
 * 显示为固定屏幕尺寸的低多边形模型（Idle 动画）。更远时只有化石点（LOD2）。
 * 屏幕尺寸按外形最大尺寸与体长压缩映射（globeModelPx：6 cm ≈ 14 px … ≥ 25 m 48 px），
 * 保留大小关系但不是真实比例；真实比例见近距离观察窗。
 */

const SURFACE_R = 1.004;

interface Candidate {
  key: string;
  speciesId: string;
  asset: VisualizationAsset;
  /** 该物种的现代化石点与本模型所在点的下标：每帧按当前参考系求位置（随板块漂移）。 */
  modernSites: LonLat[];
  /** 现代观测点（GBIF）：全新世时 siteIndex 指向这里。 */
  living?: LonLat[];
  siteIndex: number;
  lonLat: LonLat;
  heading: number;
}

const UP = new Vector3(0, 1, 0);

function Creature({ c, index, paleo }: { c: Candidate; index: number; paleo: PaleoPointsFile | null }) {
  const style = useSettingsStore((s) => s.visualStyle);
  const detail = useSettingsStore((s) => s.modelDetail);
  const rig = useRig(c.asset, detail === "high" ? 0 : 1, style);
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  const ref = useRef<Group>(null);
  const animT = useAnimationClock();
  const frame = useRef(index);
  const pos = useMemo(() => new Vector3(...lonLatToXYZ(c.lonLat[0], c.lonLat[1], SURFACE_R)), [c.lonLat]);
  const orient = useMemo(() => new Quaternion(), []);
  const lastF = useRef<number | null>(null);

  useFrame(({ camera, size }) => {
    const g = ref.current;
    if (!g) return;
    // 随板块漂移：形变比例变化时更新位置与朝向（贴合地表法线）
    const pf = currentPaleoFrame();
    const fKey = pf.kind === "paleo" ? pf.f : -1;
    if (fKey !== lastF.current) {
      lastF.current = fKey;
      const ll = siteInFrame(c.speciesId, c.modernSites, c.siteIndex, pf, paleo, c.living) ?? c.lonLat;
      pos.set(...lonLatToXYZ(ll[0], ll[1], SURFACE_R));
      orient.setFromUnitVectors(UP, pos.clone().normalize()).multiply(new Quaternion().setFromAxisAngle(UP, c.heading));
      g.position.copy(pos);
      g.quaternion.copy(orient);
    }
    const cam = camera as PerspectiveCamera;
    const dist = cam.position.distanceTo(pos);
    // 背面隐藏
    g.visible = pos.clone().normalize().dot(cam.position.clone().sub(pos).normalize()) > 0.05;
    if (!g.visible) return;
    const worldPerPx = (2 * dist * Math.tan((cam.fov * Math.PI) / 360)) / Math.max(1, size.height);
    const px = globeModelPx(c.asset.sizeM);
    g.scale.setScalar((worldPerPx * px) / rig.extent);
    frame.current++;
    const s = useSettingsStore.getState();
    if (frame.current % updateInterval(dist / (worldPerPx * px), false, s.lowPerformance) !== 0) return;
    applyClip(rig, c.asset.archetype, "idle", animT.current, index * 1.7);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    selectSpecies(c.speciesId);
  };

  return (
    <group ref={ref} onClick={onClick} name={`creature-${c.key}`}>
      <primitive object={rig.root} />
    </group>
  );
}

export function GlobeCreatures() {
  const species = useSceneStore((s) => s.visible.species);
  const data = useFossilSitesStore((s) => s.data);
  const paleo = usePaleoPointsStore((s) => s.data);
  const slice = useGeographyStore((s) => s.slice);
  const ranges = useModernRangesStore((s) => s.data);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  // 视图信息由相机控制器节流发布；量化后再参与计算，避免细微移动反复重建
  const lon = useViewStore((s) => Math.round(s.lon / 2) * 2);
  const lat = useViewStore((s) => Math.round(s.lat / 2) * 2);
  const altitude = useViewStore((s) => Math.round(s.altitude * 20) / 20);

  const candidates = useMemo<Candidate[]>(() => {
    if (!data) return [];
    // 选点用当前位置；模型挂在"物种 + 化石点下标"上，之后每帧随漂移移动而不重新挂载
    const frame = paleoFrameNow(slice);
    const entries = species
      .filter((s) => s.visualizationId && VISUAL_BY_ID[s.visualizationId])
      .map((s) => {
        const modern = data.species[s.id]?.sites ?? [];
        // 全新世的现生类群用现代观测点；其余情况按化石点下标
        const living = frame.kind === "modern" && ranges?.species[s.id]?.sites.length ? ranges.species[s.id]!.sites : undefined;
        const base = living ?? modern;
        const idx: number[] = [];
        const sites: LonLat[] = [];
        base.forEach((_, i) => {
          const p = siteInFrame(s.id, modern, i, frame, paleo, living);
          if (p) {
            idx.push(i);
            sites.push(p);
          }
        });
        return { speciesId: s.id, sites, idx, modern, living, base };
      });
    return pickCreatureSites(entries, [lon, lat], altitude, lowPerformance ? 3 : 6).map(({ speciesId, lonLat, siteIndex }) => {
      const sp = species.find((s) => s.id === speciesId)!;
      const e = entries.find((x) => x.speciesId === speciesId)!;
      const original = e.idx[siteIndex]!;
      const m = e.base[original]!;
      return {
        key: `${speciesId}#${e.living ? "L" : ""}${original}`,
        speciesId,
        asset: VISUAL_BY_ID[sp.visualizationId!]!,
        modernSites: e.modern,
        living: e.living,
        siteIndex: original,
        lonLat,
        // 朝向按现代坐标取，漂移中保持不变
        heading: ((m[0] * 7.3 + m[1] * 3.1) % (Math.PI * 2)) || 0,
      };
    });
  }, [species, data, paleo, ranges, slice, lon, lat, altitude, lowPerformance]);

  return (
    <group name="globe-creatures">
      {candidates.map((c, i) => (
        <Creature key={c.key} c={c} index={i} paleo={paleo} />
      ))}
    </group>
  );
}
