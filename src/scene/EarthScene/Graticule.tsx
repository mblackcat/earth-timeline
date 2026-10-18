import { useMemo } from "react";
import { useViewStore } from "../../state/viewStore";
import { graticuleLines, type SpatialLevel } from "../../utils/geo";
import { SphereLines } from "../Wireframe/SphereLines";
import { useSettingsStore } from "../../state/settingsStore";
import { graticuleStyle } from "../Ink/inkPalette";

/**
 * 经纬网。按空间层级逐级加密，远景只保留 15° 主网格，避免线条噪点（PLAN §6.3）：
 *   L0+：15°（赤道、本初子午线加强）
 *   L1+：5°
 *   L3+：1°
 */
const DENSER: { step: number; minLevel: SpatialLevel; opacity: number }[] = [
  { step: 5, minLevel: 1, opacity: 0.45 },
  { step: 1, minLevel: 3, opacity: 0.3 },
];

export function Graticule() {
  const level = useViewStore((s) => s.level);
  const colors = graticuleStyle(useSettingsStore((s) => s.visualStyle));
  const base = useMemo(() => graticuleLines(15), []);
  const dense = useMemo(() => DENSER.map((d) => ({ ...d, lines: graticuleLines(d.step, Math.min(2, d.step)).lines })), []);

  return (
    <group name="graticule">
      {dense.map(
        (d) =>
          level >= d.minLevel && (
            <SphereLines
              key={d.step}
              lines={d.lines}
              radius={1.0008}
              color={colors.minor}
              opacity={d.opacity}
              name={`graticule-${d.step}`}
            />
          ),
      )}
      <SphereLines lines={base.lines} radius={1.001} color={colors.minor} name="graticule-minor" />
      <SphereLines lines={base.major} radius={1.001} color={colors.major} name="graticule-major" />
    </group>
  );
}
