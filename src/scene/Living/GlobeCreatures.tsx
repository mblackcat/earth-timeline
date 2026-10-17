import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Quaternion, Vector3, type Group, type PerspectiveCamera } from "three";
import type { LonLat, VisualizationAsset } from "../../data/schema";
import { VISUAL_BY_ID } from "../../data/visuals";
import { useGeographyStore } from "../../state/geographyStore";
import { useFossilSitesStore, usePaleoPointsStore, useSceneStore } from "../../state/sceneStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore } from "../../state/settingsStore";
import { useViewStore } from "../../state/viewStore";
import { updateInterval } from "../../simulation/BehaviorSystem";
import { pickCreatureSites } from "../../simulation/creatureSites";
import { frameFor, speciesSitesInFrame } from "../../simulation/paleoPositions";
import { lonLatToXYZ } from "../../utils/geo";
import { applyClip } from "../Models/animation";
import { useAnimationClock } from "../Models/animationClock";
import { useRig } from "../Models/useRig";

/**
 * 地球上的 LOD1：相机拉近到大陆尺度（L1 及更近）时，离视野中心最近的少量化石点
 * 显示为固定屏幕尺寸的低多边形模型（Idle 动画）。更远时只有化石点（LOD2）。
 * 模型尺寸是图标化的，不代表真实比例；真实比例见近距离观察窗。
 */

const SCREEN_HEIGHT_PX = 34;
const SURFACE_R = 1.004;

interface Candidate {
  key: string;
  speciesId: string;
  asset: VisualizationAsset;
  lonLat: LonLat;
  heading: number;
}

const UP = new Vector3(0, 1, 0);

function Creature({ c, index }: { c: Candidate; index: number }) {
  const style = useSettingsStore((s) => s.visualStyle);
  const detail = useSettingsStore((s) => s.modelDetail);
  const rig = useRig(c.asset, detail === "high" ? 0 : 1, style);
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  const ref = useRef<Group>(null);
  const animT = useAnimationClock();
  const frame = useRef(index);
  const pos = useMemo(() => new Vector3(...lonLatToXYZ(c.lonLat[0], c.lonLat[1], SURFACE_R)), [c.lonLat]);
  const orient = useMemo(() => {
    const n = pos.clone().normalize();
    const q = new Quaternion().setFromUnitVectors(UP, n);
    return q.multiply(new Quaternion().setFromAxisAngle(UP, c.heading));
  }, [pos, c.heading]);

  useFrame(({ camera, size }) => {
    const g = ref.current;
    if (!g) return;
    const cam = camera as PerspectiveCamera;
    const dist = cam.position.distanceTo(pos);
    // 背面隐藏
    g.visible = pos.clone().normalize().dot(cam.position.clone().sub(pos).normalize()) > 0.05;
    if (!g.visible) return;
    const worldPerPx = (2 * dist * Math.tan((cam.fov * Math.PI) / 360)) / Math.max(1, size.height);
    g.scale.setScalar((worldPerPx * SCREEN_HEIGHT_PX) / rig.height);
    frame.current++;
    const s = useSettingsStore.getState();
    if (frame.current % updateInterval(dist / (worldPerPx * SCREEN_HEIGHT_PX), false, s.lowPerformance) !== 0) return;
    applyClip(rig, c.asset.archetype, "idle", animT.current, index * 1.7);
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return;
    e.stopPropagation();
    selectSpecies(c.speciesId);
  };

  return (
    <group ref={ref} position={pos} quaternion={orient} onClick={onClick} name={`creature-${c.key}`}>
      <primitive object={rig.root} />
    </group>
  );
}

export function GlobeCreatures() {
  const species = useSceneStore((s) => s.visible.species);
  const data = useFossilSitesStore((s) => s.data);
  const paleo = usePaleoPointsStore((s) => s.data);
  const reconstructionMa = useGeographyStore((s) => s.slice?.reconstructionMa);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  // 视图信息由相机控制器节流发布；量化后再参与计算，避免细微移动反复重建
  const lon = useViewStore((s) => Math.round(s.lon / 2) * 2);
  const lat = useViewStore((s) => Math.round(s.lat / 2) * 2);
  const altitude = useViewStore((s) => Math.round(s.altitude * 20) / 20);

  const candidates = useMemo<Candidate[]>(() => {
    if (!data) return [];
    const frame = frameFor(reconstructionMa);
    const entries = species
      .filter((s) => s.visualizationId && VISUAL_BY_ID[s.visualizationId])
      .map((s) => ({ speciesId: s.id, sites: speciesSitesInFrame(s.id, data.species[s.id]?.sites ?? [], frame, paleo) }));
    return pickCreatureSites(entries, [lon, lat], altitude, lowPerformance ? 3 : 6).map(({ speciesId, lonLat }) => {
      const sp = species.find((s) => s.id === speciesId)!;
      return {
        key: `${speciesId}@${lonLat.join(",")}`,
        speciesId,
        asset: VISUAL_BY_ID[sp.visualizationId!]!,
        lonLat,
        heading: ((lonLat[0] * 7.3 + lonLat[1] * 3.1) % (Math.PI * 2)) || 0,
      };
    });
  }, [species, data, paleo, reconstructionMa, lon, lat, altitude, lowPerformance]);

  return (
    <group name="globe-creatures">
      {candidates.map((c, i) => (
        <Creature key={c.key} c={c} index={i} />
      ))}
    </group>
  );
}
