import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import { Box3, BufferGeometry, Float32BufferAttribute, Vector3, type Group } from "three";
import type { VisualizationAsset } from "../../data/schema";
import { useSettingsStore } from "../../state/settingsStore";
import { INK } from "../Ink/inkPalette";
import { ToneSync } from "../Ink/ToneSync";
import { applyClip } from "../Models/animation";
import { useAnimationClock } from "../Models/animationClock";
import type { Rig } from "../Models/rig";
import { useRig } from "../Models/useRig";

/**
 * 百科中的单体模型展台：模型保持归一化尺寸（体长 = 1），放在一圈刻度底盘上，
 * 缓慢自转；拖动后停止自转，由用户旋转 / 缩放。
 */

/** 底盘：圆环 + 径向刻度。 */
function Plinth({ radius }: { radius: number }) {
  const geometry = useMemo(() => {
    const pts: number[] = [];
    const ring = (r: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        pts.push(Math.cos(a0) * r, 0, Math.sin(a0) * r, Math.cos(a1) * r, 0, Math.sin(a1) * r);
      }
    };
    ring(radius, 96);
    ring(radius * 0.62, 72);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const inner = radius * (i % 9 === 0 ? 0.86 : 0.94);
      pts.push(Math.cos(a) * inner, 0, Math.sin(a) * inner, Math.cos(a) * radius, 0, Math.sin(a) * radius);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return g;
  }, [radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={INK.rule} toneMapped={false} />
    </lineSegments>
  );
}

/** 静止姿态的包围盒：用于把模型放到底盘中心、脚底贴地，并据此取景。 */
function restBounds(rig: Rig) {
  const box = new Box3().setFromObject(rig.root);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  return { size, offset: new Vector3(-center.x, -box.min.y, -center.z) };
}

function Model({ asset, rig, offset, lift, autoRotate }: { asset: VisualizationAsset; rig: Rig; offset: Vector3; lift: number; autoRotate: RefObject<boolean> }) {
  const animT = useAnimationClock();
  const group = useRef<Group>(null);

  useFrame((_, dt) => {
    applyClip(rig, asset.archetype, "idle", animT.current);
    if (group.current && autoRotate.current) group.current.rotation.y += Math.min(dt, 0.1) * 0.35;
    if (group.current && lift) group.current.position.y = lift + 0.03 * Math.sin(animT.current * 0.8);
  });

  return (
    <group ref={group} position={[0, lift, 0]} rotation={[0, -Math.PI / 5, 0]}>
      <group position={offset}>
        <primitive object={rig.root} />
      </group>
    </group>
  );
}

export function WikiModelScene({ asset }: { asset: VisualizationAsset }) {
  const style = useSettingsStore((s) => s.visualStyle);
  const rig = useRig(asset, 0, style);
  const autoRotate = useRef(true);
  const { size, offset } = useMemo(() => restBounds(rig), [rig]);
  const lift = asset.locomotion === "fly" || asset.locomotion === "swim" ? size.y * 0.5 + 0.08 : 0;
  // 按包围球取景（体长归一化后，高大的树与扁平的三叶虫外形差异很大）；自转时水平半径取对角线
  const halfW = Math.hypot(size.x, size.z) / 2;
  const radius = Math.hypot(halfW, (size.y + lift) / 2);
  const fov = 32;
  const d = (radius / Math.sin(((fov / 2) * Math.PI) / 180)) * 1.08;
  const targetY = (size.y + lift) * 0.5;
  const dir = new Vector3(0.62, 0.36, 0.7).normalize().multiplyScalar(d);

  return (
    <>
      <color attach="background" args={[INK.paper]} />
      <ToneSync />
      <PerspectiveCamera makeDefault fov={fov} position={[dir.x, targetY + dir.y, dir.z]} near={d * 0.01} far={d * 50} />
      <Plinth radius={halfW * 1.1} />
      <Model asset={asset} rig={rig} offset={offset} lift={lift} autoRotate={autoRotate} />
      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, targetY, 0]}
        minDistance={radius * 1.2}
        maxDistance={d * 3}
        maxPolarAngle={Math.PI / 2 - 0.02}
        onStart={() => {
          autoRotate.current = false;
        }}
      />
    </>
  );
}
