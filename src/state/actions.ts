import { eventAnchorYearsAgo } from "../data/events";
import type { HistoricalEvent } from "../data/schema";
import { eventPositionInFrame, speciesSitesInFrame } from "../simulation/paleoPositions";
import { sphericalCentroid } from "../simulation/VisibilityResolver";
import { currentPaleoFrame } from "./paleoFrame";
import { timeEngine } from "../timeline/runtime";
import { useFossilSitesStore, useModernRangesStore, usePaleoPointsStore } from "./sceneStore";
import { useSelectionStore } from "./selectionStore";
import { useViewStore } from "./viewStore";

/**
 * 跨 store 的用户动作（事件导航，TASKS §2 不变式 6）：
 * 选中事件 → 跳转时间 →（有位置时）相机定位；全球事件不移动相机。
 */

export function jumpToEvent(event: HistoricalEvent, { moveCamera = true } = {}): void {
  useSelectionStore.getState().selectEvent(event.id);
  timeEngine.seek(eventAnchorYearsAgo(event));
  if (moveCamera) focusEventOnGlobe(event);
}

export function focusEventOnGlobe(event: HistoricalEvent): boolean {
  const ll = eventPositionInFrame(event, currentPaleoFrame(), usePaleoPointsStore.getState().data);
  if (!ll) return false;
  useViewStore.getState().requestCamera("focus", { lon: ll[0], lat: ll[1] });
  return true;
}

/** 相机对准某物种化石点的球面中心。没有化石点时返回 false。 */
export function focusSpeciesOnGlobe(speciesId: string): boolean {
  const modern = useFossilSitesStore.getState().data?.species[speciesId]?.sites ?? [];
  const living = useModernRangesStore.getState().data?.species[speciesId]?.sites;
  const sites = speciesSitesInFrame(speciesId, modern, currentPaleoFrame(), usePaleoPointsStore.getState().data, living);
  const c = sphericalCentroid(sites);
  if (!c) return false;
  useViewStore.getState().requestCamera("focus", { lon: c[0], lat: c[1], altitude: 1.4 });
  return true;
}

/** 从百科跳到物种生存年代的中点，并在地图上选中它。 */
export function jumpToSpecies(speciesId: string, time: { fromYearsAgo: number; toYearsAgo: number }): void {
  timeEngine.seek((time.fromYearsAgo + time.toYearsAgo) / 2);
  useSelectionStore.getState().selectSpecies(speciesId);
}
