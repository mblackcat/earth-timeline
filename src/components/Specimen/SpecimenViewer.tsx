import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import type { AnimationClipName } from "../../data/schema";
import { SPECIES_BY_ID } from "../../data/species";
import { VISUAL_BY_ID } from "../../data/visuals";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore, type VisualStyle } from "../../state/settingsStore";
import { clipsFor } from "../../scene/Models/animation";
import type { Lod } from "../../scene/Models/rig";
import { SpecimenScene, type ClipMode } from "../../scene/Specimen/SpecimenScene";
import { formatYearsSpan } from "../../timeline/CalendarAdapter";

const CLIP_LABELS: Record<AnimationClipName, string> = { idle: "Idle", move: "移动", eat: "进食" };
const STYLE_LABELS: Record<VisualStyle, string> = { line: "线稿", tone: "线稿+网点", plain: "白模" };

function formatSize(m: number): string {
  return m >= 1 ? `${m.toLocaleString("zh-CN")} 米` : `${(m * 100).toLocaleString("zh-CN")} 厘米`;
}

/** 近距离观察窗（L3/L4 的局部坐标系实现，TASKS 风险 R1）。 */
export function SpecimenViewer() {
  const id = useSelectionStore((s) => s.specimenId);
  const close = useSelectionStore((s) => s.closeSpecimen);
  const style = useSettingsStore((s) => s.visualStyle);
  const setStyle = useSettingsStore((s) => s.setVisualStyle);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  const [clipMode, setClipMode] = useState<ClipMode>("auto");
  const [lod, setLod] = useState<Lod>(0);

  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [id, close]);

  const species = id ? SPECIES_BY_ID[id] : undefined;
  const asset = species?.visualizationId ? VISUAL_BY_ID[species.visualizationId] : undefined;
  if (!id || !species || !asset) return null;
  const clips = clipsFor(asset.archetype);

  return (
    <div className="specimen" role="dialog" aria-label={`近距离观察：${species.commonName}`} data-testid="specimen-viewer" data-species={id}>
      <div className="specimen-head">
        <div>
          <b>{species.commonName}</b> <i className="detail-sci">{species.scientificName}</i>
          <span className="specimen-meta">
            {asset.archetype === "pterosaur" ? "翼展" : asset.type === "human" ? "身高" : asset.type === "plant" ? "株高" : "体长"}约 {formatSize(asset.sizeM)} ·
            真实比例 · LOD {lod}
          </span>
        </div>
        <button type="button" className="details-close" onClick={close} aria-label="关闭观察窗" data-testid="specimen-close">
          ×
        </button>
      </div>
      <div className="specimen-canvas">
        <Canvas key={id} flat dpr={lowPerformance ? 1 : [1, 2]} camera={{ fov: 40, near: asset.sizeM * 0.05, far: asset.sizeM * 400, position: [asset.sizeM * 3, asset.sizeM * 1.8, asset.sizeM * 4] }}>
          <SpecimenScene asset={asset} clipMode={clipMode} onLodChange={setLod} />
        </Canvas>
      </div>
      <div className="specimen-foot">
        <div className="seg" role="group" aria-label="动画">
          <button type="button" aria-pressed={clipMode === "auto"} onClick={() => setClipMode("auto")} data-testid="clip-auto">
            自动行为
          </button>
          {clips.map((c) => (
            <button key={c} type="button" aria-pressed={clipMode === c} onClick={() => setClipMode(c)} data-testid={`clip-${c}`}>
              {CLIP_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="渲染风格">
          {(Object.keys(STYLE_LABELS) as VisualStyle[]).map((s) => (
            <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)} data-testid={`style-${s}`}>
              {STYLE_LABELS[s]}
            </button>
          ))}
        </div>
        <span className="specimen-note" title={asset.note}>
          示意模型 · 生存于 {formatYearsSpan(species.time.fromYearsAgo)}前 — {species.time.toYearsAgo === 0 ? "今" : `${formatYearsSpan(species.time.toYearsAgo)}前`} · 拖动旋转、滚轮缩放
        </span>
      </div>
    </div>
  );
}
