import { useGeographyStore, useReferenceCoastlineStore } from "../../state/geographyStore";
import { useSettingsStore } from "../../state/settingsStore";
import { SphereLines } from "../Wireframe/SphereLines";
import { INK } from "../Ink/inkPalette";

/**
 * 当前时间对应的古地理/现代示意轮廓。数据由 geographyStore 按时间同步。
 * 没有该时期的轮廓时，可选显示浅灰色现代海岸线作为定位参考（明显弱化，避免被当作古地理）。
 */
export function GeographyOutlines() {
  const outlines = useGeographyStore((s) => s.outlines);
  const reference = useReferenceCoastlineStore((s) => s.outlines);
  const showReference = useSettingsStore((s) => s.showModernReference);
  if (outlines) return <SphereLines lines={outlines} radius={1.002} color={INK.ink} name="outlines" />;
  if (showReference && reference) {
    return <SphereLines lines={reference} radius={1.002} color={INK.ink3} opacity={0.5} name="reference-coastline" />;
  }
  return null;
}
