import { useEffect, useMemo } from "react";
import type { VisualizationAsset } from "../../data/schema";
import { buildRig } from "./builders";
import type { Lod, Rig, Style } from "./rig";

/** 构建并挂载一个程序化模型；asset / lod / style 变化时重建，卸载时释放 GPU 资源。 */
export function useRig(asset: VisualizationAsset, lod: Lod, style: Style): Rig {
  const rig = useMemo(() => buildRig(asset, lod, style), [asset, lod, style]);
  useEffect(() => () => rig.dispose(), [rig]);
  return rig;
}

/** 同一参数的 n 个模型实例（观察窗中的一群个体）。 */
export function useRigs(asset: VisualizationAsset, lod: Lod, style: Style, n: number): Rig[] {
  const rigs = useMemo(() => Array.from({ length: n }, () => buildRig(asset, lod, style)), [asset, lod, style, n]);
  useEffect(() => () => rigs.forEach((r) => r.dispose()), [rigs]);
  return rigs;
}
