import type { HistoricalEvent, LonLat, PaleoPointsFile } from "../data/schema";
import { eventAnchorLonLat } from "./VisibilityResolver";

/**
 * 化石点 / 事件在当前地理切片参考系下的位置。
 *
 * - 当前切片是板块重建（reconstructionMa 有值）：使用旋转到该年代的古坐标；
 *   某个点无法重建（当时不在任何板块上）时不显示，绝不混用现代坐标。
 * - 当前切片是现代海岸线或没有切片：使用现代坐标（与现代海岸线 / 参考线一致）。
 */
export type Frame = { kind: "modern" } | { kind: "paleo"; ma: number };

export function frameFor(reconstructionMa: number | undefined): Frame {
  return reconstructionMa === undefined ? { kind: "modern" } : { kind: "paleo", ma: reconstructionMa };
}

export function speciesSitesInFrame(
  speciesId: string,
  modernSites: LonLat[],
  frame: Frame,
  paleo: PaleoPointsFile | null,
): LonLat[] {
  if (frame.kind === "modern") return modernSites;
  const rec = paleo?.species[speciesId]?.[String(frame.ma)];
  if (!rec) return [];
  return rec.filter((p): p is LonLat => p !== null);
}

export function eventPositionInFrame(event: HistoricalEvent, frame: Frame, paleo: PaleoPointsFile | null): LonLat | null {
  const modern = eventAnchorLonLat(event);
  if (!modern) return null;
  if (frame.kind === "modern") return modern;
  return paleo?.events[event.id]?.[String(frame.ma)] ?? null;
}
