import { useEffect, useMemo } from "react";
import { BackSide, IcosahedronGeometry } from "three";
import { useGeographyStore } from "../../state/geographyStore";
import { useSettingsStore } from "../../state/settingsStore";
import { EARTH_RADIUS } from "../../utils/geo";
import { INK } from "../Ink/inkPalette";
import { useLandMaskTexture } from "../Ink/landMask";
import { createToneMaterial, setToneLandMask, setToneMode } from "../Ink/toneMaterial";

/** 地球球体：海洋铺网点（背光侧加粗、边缘涂黑），陆地按当前切片的遮罩留白。 */
export function Globe() {
  // detail 5：边长约 0.034，弦高误差约 1.5e-4，远小于线稿层的抬升高度。
  const geometry = useMemo(() => new IcosahedronGeometry(EARTH_RADIUS, 5), []);
  const style = useSettingsStore((s) => s.visualStyle);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  const outlines = useGeographyStore((s) => s.outlines);
  const mask = useLandMaskTexture(outlines, lowPerformance ? 2048 : 4096);
  const material = useMemo(() => {
    const m = createToneMaterial({ base: INK.paper, mode: "tone", land: INK.sheet });
    // 球面用平滑法线：否则二十面体的面会在网点上显形
    m.flatShading = false;
    return m;
  }, []);
  useEffect(() => setToneMode(material, style), [material, style]);
  useEffect(() => setToneLandMask(material, mask), [material, mask]);
  useEffect(() => () => material.dispose(), [material]);
  return <mesh geometry={geometry} material={material} name="globe" />;
}

/** 球体轮廓线：略大的背面球，墨色。 */
export function GlobeRim() {
  return (
    <mesh scale={1.006} name="globe-rim">
      <sphereGeometry args={[EARTH_RADIUS, 96, 48]} />
      <meshBasicMaterial color={INK.ink} side={BackSide} toneMapped={false} />
    </mesh>
  );
}
