import { useGeographyStore } from "../../state/geographyStore";
import { SphereLines } from "../Wireframe/SphereLines";
import { PALETTE } from "../Wireframe/palette";

/** 当前时间对应的古地理/现代示意轮廓。数据由 geographyStore 按时间同步。 */
export function GeographyOutlines() {
  const outlines = useGeographyStore((s) => s.outlines);
  if (!outlines) return null;
  return <SphereLines lines={outlines} radius={1.002} color={PALETTE.coastline} name="outlines" />;
}
