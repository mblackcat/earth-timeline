import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import type { LonLat } from "../../data/schema";
import { polylinesToSegments } from "../../utils/geo";

interface Props {
  lines: LonLat[][];
  radius: number;
  color: string;
  opacity?: number;
  name?: string;
}

/** 把经纬度折线绘制为贴合球面的线段（一个 draw call）。 */
export function SphereLines({ lines, radius, color, opacity = 1, name }: Props) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(polylinesToSegments(lines, radius), 3));
    return g;
  }, [lines, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry} name={name}>
      <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
    </lineSegments>
  );
}
