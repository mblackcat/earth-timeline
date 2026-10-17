import { eventAnchorYearsAgo } from "../data/events";
import type { HistoricalEvent } from "../data/schema";
import { eventAnchorLonLat, sphericalCentroid } from "../simulation/VisibilityResolver";
import { timeEngine } from "../timeline/runtime";
import { useFossilSitesStore } from "./sceneStore";
import { useSelectionStore } from "./selectionStore";
import { useViewStore } from "./viewStore";

/**
 * 跨 store 的用户动作（事件导航，TASKS §2 不变式 6）：
 * 选中事件 → 跳转时间 →（有位置时）相机定位；全球事件不移动相机。
 */
export function jumpToEvent(event: HistoricalEvent, { moveCamera = true } = {}): void {
  useSelectionStore.getState().selectEvent(event.id);
  timeEngine.seek(eventAnchorYearsAgo(event));
  const ll = eventAnchorLonLat(event);
  if (moveCamera && ll) useViewStore.getState().requestCamera("focus", { lon: ll[0], lat: ll[1] });
}

export function focusEventOnGlobe(event: HistoricalEvent): boolean {
  const ll = eventAnchorLonLat(event);
  if (!ll) return false;
  useViewStore.getState().requestCamera("focus", { lon: ll[0], lat: ll[1] });
  return true;
}

/** 相机对准某物种化石点的球面中心。没有化石点时返回 false。 */
export function focusSpeciesOnGlobe(speciesId: string): boolean {
  const sites = useFossilSitesStore.getState().data?.species[speciesId]?.sites ?? [];
  const c = sphericalCentroid(sites);
  if (!c) return false;
  useViewStore.getState().requestCamera("focus", { lon: c[0], lat: c[1], altitude: 1.4 });
  return true;
}
