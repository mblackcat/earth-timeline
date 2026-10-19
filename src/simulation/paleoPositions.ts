import type { HistoricalEvent, LonLat, PaleoPointsFile } from "../data/schema";
import { slerpLonLat, type Frame } from "./paleoMorph";
import { eventAnchorLonLat } from "./VisibilityResolver";

/**
 * 化石点 / 事件在当前参考系下的位置。
 *
 * - 板块重建切片内：在切片年代 ma 与下一个更年轻年代 nextMa 的古坐标之间按 f 插值
 *   （nextMa = 0 时目标为现代坐标）；只有一端能重建时用该端；两端都不能重建时不显示，
 *   绝不混用现代坐标。
 * - 现代海岸线切片或没有切片：使用现代坐标（与现代海岸线 / 参考线一致）。
 */
export type { Frame } from "./paleoMorph";

function interpolate(from: LonLat | null | undefined, to: LonLat | null | undefined, f: number): LonLat | null {
  if (from && to) return slerpLonLat(from, to, f);
  return from ?? to ?? null;
}

/** 单个化石点（modernSites 中第 index 个）在当前参考系下的位置；不能重建时为 null。 */
export function siteInFrame(
  speciesId: string,
  modernSites: LonLat[],
  index: number,
  frame: Frame,
  paleo: PaleoPointsFile | null,
): LonLat | null {
  if (frame.kind === "modern") return modernSites[index] ?? null;
  const byMa = paleo?.species[speciesId];
  const from = byMa?.[String(frame.ma)]?.[index];
  const to = frame.nextMa === 0 ? modernSites[index] : byMa?.[String(frame.nextMa)]?.[index];
  return interpolate(from, to, frame.f);
}

export function speciesSitesInFrame(
  speciesId: string,
  modernSites: LonLat[],
  frame: Frame,
  paleo: PaleoPointsFile | null,
): LonLat[] {
  if (frame.kind === "modern") return modernSites;
  const byMa = paleo?.species[speciesId];
  const from = byMa?.[String(frame.ma)];
  const to = frame.nextMa === 0 ? modernSites : byMa?.[String(frame.nextMa)];
  if (!from && !to) return [];
  const out: LonLat[] = [];
  for (let i = 0; i < modernSites.length; i++) {
    const p = interpolate(from?.[i], to?.[i], frame.f);
    if (p) out.push(p);
  }
  return out;
}

export function eventPositionInFrame(event: HistoricalEvent, frame: Frame, paleo: PaleoPointsFile | null): LonLat | null {
  const modern = eventAnchorLonLat(event);
  if (!modern) return null;
  if (frame.kind === "modern") return modern;
  const byMa = paleo?.events[event.id];
  return interpolate(byMa?.[String(frame.ma)], frame.nextMa === 0 ? modern : byMa?.[String(frame.nextMa)], frame.f);
}
