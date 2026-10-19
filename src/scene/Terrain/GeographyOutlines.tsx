import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { LonLat } from "../../data/schema";
import { useGeographyStore, useReferenceCoastlineStore } from "../../state/geographyStore";
import { currentOutlines } from "../../state/paleoFrame";
import { useSettingsStore } from "../../state/settingsStore";
import { polylinesToSegments } from "../../utils/geo";
import { SphereLines } from "../Wireframe/SphereLines";
import { INK } from "../Ink/inkPalette";

const RADIUS = 1.002;

/** 板块重建轮廓：每帧按当前时刻形变（板块漂移），缓冲区原地更新。 */
function MorphingOutlines() {
  const geometry = useMemo(() => new BufferGeometry(), []);
  const last = useRef<LonLat[][] | null>(null);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const lines = currentOutlines();
    if (!lines || lines === last.current) return;
    last.current = lines;
    const arr = polylinesToSegments(lines, RADIUS);
    const attr = geometry.getAttribute("position") as BufferAttribute | undefined;
    // 跨日界线被跳过的线段数会变化：长度不同时换缓冲区
    if (attr && attr.array.length === arr.length) {
      (attr.array as Float32Array).set(arr);
      attr.needsUpdate = true;
    } else {
      geometry.setAttribute("position", new BufferAttribute(arr, 3));
    }
    geometry.computeBoundingSphere();
  });
  return (
    <lineSegments geometry={geometry} name="outlines" frustumCulled={false}>
      <lineBasicMaterial color={INK.ink} />
    </lineSegments>
  );
}

/**
 * 当前时间对应的古地理/现代示意轮廓。数据由 geographyStore 按时间同步，切片内逐帧形变。
 * 没有该时期的轮廓时，可选显示浅灰色现代海岸线作为定位参考（明显弱化，避免被当作古地理）。
 */
export function GeographyOutlines() {
  const hasOutlines = useGeographyStore((s) => s.outlines !== null);
  const reference = useReferenceCoastlineStore((s) => s.outlines);
  const showReference = useSettingsStore((s) => s.showModernReference);
  if (hasOutlines) return <MorphingOutlines />;
  if (showReference && reference) {
    return <SphereLines lines={reference} radius={RADIUS} color={INK.ink3} opacity={0.5} name="reference-coastline" />;
  }
  return null;
}
