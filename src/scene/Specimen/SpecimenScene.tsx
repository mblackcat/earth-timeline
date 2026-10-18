import { OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BufferAttribute, BufferGeometry, PlaneGeometry, type Group } from "three";
import type { AnimationClipName, VisualizationAsset } from "../../data/schema";
import { useSettingsStore } from "../../state/settingsStore";
import {
  behaviorConfigFor,
  clipForState,
  createAgent,
  seededRandom,
  stepAgent,
  updateInterval,
  type Agent,
} from "../../simulation/BehaviorSystem";
import { contourSegments, makeHeightField } from "../../utils/terrain";
import { applyClip } from "../Models/animation";
import { useAnimationClock } from "../Models/animationClock";
import { useRigs } from "../Models/useRig";
import type { Lod } from "../Models/rig";
import { INK } from "../Ink/inkPalette";
import { createToneMaterial, setToneMode } from "../Ink/toneMaterial";
import { ToneSync } from "../Ink/ToneSync";

/**
 * 近距离观察的局部场景（TASKS 风险 R1）：独立的米制坐标系，模型使用真实体长，
 * 与地球坐标完全分开，避免 float32 精度问题。
 */

/** LOD 切换阈值：相机距离 / 体长。 */
const LOD1_DISTANCE_RATIO = 14;

export type ClipMode = "auto" | AnimationClipName;

function herdSize(asset: VisualizationAsset, lowPerformance: boolean): number {
  const n = asset.archetype === "plant" ? 14 : asset.sizeM < 0.2 ? 6 : asset.sizeM < 3 ? 4 : 3;
  return lowPerformance ? Math.ceil(n / 2) : n;
}

function Terrain({ half, asset }: { half: number; asset: VisualizationAsset }) {
  const style = useSettingsStore((s) => s.visualStyle);
  const water = asset.locomotion === "swim";
  const amp = asset.sizeM * (water ? 0.25 : 0.12);
  const height = useMemo(() => makeHeightField(amp, half * 0.9, 7), [amp, half]);
  const { ground, contours } = useMemo(() => {
    const g = new PlaneGeometry(half * 2, half * 2, 40, 40);
    g.rotateX(-Math.PI / 2);
    const pos = g.getAttribute("position") as BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
    g.computeVertexNormals();
    const levels = Array.from({ length: 9 }, (_, i) => -amp + ((i + 0.5) * 2 * amp) / 9);
    const c = new BufferGeometry();
    c.setAttribute("position", new BufferAttribute(contourSegments(height, half, 60, levels, amp * 0.01), 3));
    return { ground: g, contours: c };
  }, [half, height, amp]);
  useEffect(
    () => () => {
      ground.dispose();
      contours.dispose();
    },
    [ground, contours],
  );
  const groundMat = useMemo(() => createToneMaterial({ base: INK.paper, mode: "tone", density: 0.45 }), []);
  useEffect(() => setToneMode(groundMat, style), [groundMat, style]);
  useEffect(() => () => groundMat.dispose(), [groundMat]);
  return (
    <group name="terrain">
      <mesh geometry={ground} material={groundMat} />
      <lineSegments geometry={contours}>
        <lineBasicMaterial color={INK.rule} toneMapped={false} />
      </lineSegments>
      {water && (
        <mesh position={[0, asset.sizeM * 1.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[half * 2, half * 2, 12, 12]} />
          <meshBasicMaterial color={INK.ink3} wireframe transparent opacity={0.25} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

function Herd({ asset, half, clipMode, lod }: { asset: VisualizationAsset; half: number; clipMode: ClipMode; lod: Lod }) {
  const style = useSettingsStore((s) => s.visualStyle);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  const animT = useAnimationClock();
  const count = herdSize(asset, lowPerformance);
  const amp = asset.sizeM * (asset.locomotion === "swim" ? 0.25 : 0.12);
  const height = useMemo(() => makeHeightField(amp, half * 0.9, 7), [amp, half]);
  const rand = useMemo(() => seededRandom(42), []);
  const agents = useMemo<Agent[]>(() => {
    const r = seededRandom(7);
    return Array.from({ length: count }, () => createAgent(r, behaviorConfigFor(asset, true).radius));
  }, [asset, count]);
  const groups = useRef<(Group | null)[]>([]);
  const frame = useRef(0);

  // 每个个体一份模型（数量很少）；asset / LOD / 风格变化时重建
  const all = useRigs(asset, lod, style, count);

  useFrame(({ camera }) => {
    frame.current++;
    const s = useSettingsStore.getState();
    const cfg = behaviorConfigFor(asset, s.behaviorEnabled && clipMode === "auto");
    agents.forEach((agent, i) => {
      const g = groups.current[i];
      const rig = all[i];
      if (!g || !rig) return;
      const dist = camera.position.distanceTo(g.position) / asset.sizeM;
      if (frame.current % updateInterval(dist, true, s.lowPerformance) !== 0) return;
      if (s.animationsEnabled || !cfg.stationary) stepAgent(agent, 1 / 60, cfg, rand);
      const clip = clipMode === "auto" ? clipForState(agent.state) : clipMode;
      applyClip(rig, asset.archetype, clip, animT.current, agent.phase);
      const y =
        asset.locomotion === "fly"
          ? asset.sizeM * (1.5 + 0.3 * Math.sin(animT.current * 0.6 + agent.phase))
          : asset.locomotion === "swim"
            ? asset.sizeM * (0.6 + 0.15 * Math.sin(animT.current * 0.8 + agent.phase))
            : height(agent.x, agent.z);
      g.position.set(agent.x, y, agent.z);
      g.rotation.y = agent.heading;
    });
  });

  return (
    <group name="herd">
      {agents.map((a, i) => (
        <group
          key={i}
          ref={(el) => {
            groups.current[i] = el;
          }}
          position={[a.x, 0, a.z]}
          rotation={[0, a.heading, 0]}
          scale={asset.sizeM}
        >
          {all[i] && <primitive object={all[i].root} />}
        </group>
      ))}
    </group>
  );
}

export function SpecimenScene({ asset, clipMode, onLodChange }: { asset: VisualizationAsset; clipMode: ClipMode; onLodChange?: (lod: Lod) => void }) {
  const detail = useSettingsStore((s) => s.modelDetail);
  const half = behaviorConfigFor(asset, true).radius * 1.4;
  const [autoLod, setAutoLod] = useState<Lod>(0);
  const lod: Lod = detail === "high" ? 0 : detail === "low" ? 1 : autoLod;

  useEffect(() => onLodChange?.(lod), [lod, onLodChange]);

  // 自动 LOD：按相机距离 / 体长切换（只在跨越阈值时触发渲染）
  useFrame(({ camera }) => {
    const ratio = camera.position.length() / asset.sizeM;
    const want: Lod = ratio > LOD1_DISTANCE_RATIO ? 1 : 0;
    if (want !== autoLod) setAutoLod(want);
  });

  return (
    <>
      <color attach="background" args={[INK.paper]} />
      <ToneSync />
      <Terrain half={half} asset={asset} />
      <Herd asset={asset} half={half} clipMode={clipMode} lod={lod} />
      <OrbitControls
        makeDefault
        target={[0, asset.sizeM * 0.4, 0]}
        minDistance={asset.sizeM * 1.2}
        maxDistance={half * 3}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  );
}
