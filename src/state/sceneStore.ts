import { create } from "zustand";
import { EVENTS } from "../data/events";
import type { FossilSitesFile, HistoricalEvent, ModernRangesFile, PaleoPointsFile, Species } from "../data/schema";
import { SPECIES } from "../data/species";
import { resolveVisible, visibleSetKey, type VisibleSet } from "../simulation/VisibilityResolver";
import { useSelectionStore } from "./selectionStore";
import { useSettingsStore } from "./settingsStore";
import { useTimeStore } from "./timeStore";

/** 当前可见的事件与物种（只在集合变化时更新）。 */
export interface SceneState {
  visible: VisibleSet;
  key: string;
}

export const useSceneStore = create<SceneState>()(() => ({ visible: { events: [], species: [] }, key: "" }));

interface SyncDeps {
  events?: HistoricalEvent[];
  species?: Species[];
  timeStore?: typeof useTimeStore;
  settingsStore?: typeof useSettingsStore;
  selectionStore?: typeof useSelectionStore;
  sceneStore?: typeof useSceneStore;
}

/**
 * 时间 / 图层设置 → 可见对象。返回取消订阅函数。
 * 选中的物种不再可见时清除对象选择（TASKS §2 不变式 6）；事件选择不受影响。
 */
export function startVisibilitySync({
  events = EVENTS,
  species = SPECIES,
  timeStore = useTimeStore,
  settingsStore = useSettingsStore,
  selectionStore = useSelectionStore,
  sceneStore = useSceneStore,
}: SyncDeps = {}): () => void {
  const apply = () => {
    const t = timeStore.getState();
    const st = settingsStore.getState();
    const visible = resolveVisible(events, species, {
      yearsAgo: t.currentTimeYearsAgo,
      playingRate: t.isPlaying ? t.rate : 0,
      showEvents: st.showEventMarkers,
      showSpecies: st.showFossilSites,
    });
    const key = visibleSetKey(visible);
    if (key !== sceneStore.getState().key) sceneStore.setState({ visible, key });
    const sel = selectionStore.getState();
    if (sel.selectedSpeciesId && !visible.species.some((s) => s.id === sel.selectedSpeciesId)) {
      selectionStore.setState({ selectedSpeciesId: null, detail: sel.detail === "species" ? null : sel.detail });
    }
    // 观察窗中的生物同样不能出现在其生存范围之外
    if (sel.specimenId && !visible.species.some((s) => s.id === sel.specimenId)) selectionStore.setState({ specimenId: null });
  };
  apply();
  const offTime = timeStore.subscribe((s, p) => {
    if (s.currentTimeYearsAgo !== p.currentTimeYearsAgo || s.isPlaying !== p.isPlaying || s.rate !== p.rate) apply();
  });
  const offSettings = settingsStore.subscribe((s, p) => {
    if (s.showEventMarkers !== p.showEventMarkers || s.showFossilSites !== p.showFossilSites) apply();
  });
  return () => {
    offTime();
    offSettings();
  };
}

// ───────────── 化石点数据（按需加载） ─────────────

export interface FossilSitesState {
  loadState: "idle" | "loading" | "ready" | "error";
  error: string | null;
  data: FossilSitesFile | null;
}

export const useFossilSitesStore = create<FossilSitesState>()(() => ({ loadState: "idle", error: null, data: null }));

export const FOSSIL_SITES_URL = "data/species/pbdb-sites.json";

export function parseFossilSites(raw: unknown): FossilSitesFile {
  const f = raw as FossilSitesFile;
  if (!f || f.format !== "ett-fossil-sites/1" || typeof f.species !== "object") {
    throw new Error("化石点数据格式不正确");
  }
  return f;
}

/** 加载化石点数据（失败可重试；已加载则直接返回）。 */
export async function loadFossilSites(
  fetchJson: (url: string) => Promise<unknown>,
  store: typeof useFossilSitesStore = useFossilSitesStore,
): Promise<void> {
  const s = store.getState();
  if (s.loadState === "ready" || s.loadState === "loading") return;
  store.setState({ loadState: "loading", error: null });
  try {
    const data = parseFossilSites(await fetchJson(FOSSIL_SITES_URL));
    store.setState({ loadState: "ready", data });
  } catch (err) {
    store.setState({ loadState: "error", error: err instanceof Error ? err.message : String(err) });
  }
}

// ───────────── 现生类群的现代观测点（GBIF，全新世显示） ─────────────

export const MODERN_RANGES_URL = "data/species/gbif-ranges.json";

export const useModernRangesStore = create<{ loadState: FossilSitesState["loadState"]; data: ModernRangesFile | null }>()(() => ({
  loadState: "idle",
  data: null,
}));

export function parseModernRanges(raw: unknown): ModernRangesFile {
  const f = raw as ModernRangesFile;
  if (!f || f.format !== "ett-gbif-ranges/1" || typeof f.species !== "object") throw new Error("现代分布数据格式不正确");
  return f;
}

/** 加载现代观测点。失败时全新世退回化石点（化石点也是现代坐标，参考系一致）。 */
export async function loadModernRanges(
  fetchJson: (url: string) => Promise<unknown>,
  store: typeof useModernRangesStore = useModernRangesStore,
): Promise<void> {
  const s = store.getState();
  if (s.loadState === "ready" || s.loadState === "loading") return;
  store.setState({ loadState: "loading" });
  try {
    store.setState({ loadState: "ready", data: parseModernRanges(await fetchJson(MODERN_RANGES_URL)) });
  } catch {
    store.setState({ loadState: "error" });
  }
}

// ───────────── 古坐标（板块重建后的化石点 / 事件位置） ─────────────

export const usePaleoPointsStore = create<{ loadState: FossilSitesState["loadState"]; data: PaleoPointsFile | null }>()(() => ({
  loadState: "idle",
  data: null,
}));

export function parsePaleoPoints(raw: unknown): PaleoPointsFile {
  const f = raw as PaleoPointsFile;
  if (!f || f.format !== "ett-paleo-points/1" || typeof f.species !== "object" || typeof f.events !== "object") {
    throw new Error("古坐标数据格式不正确");
  }
  return f;
}

/** 加载古坐标。失败时保持 error 状态：重建切片下化石点与事件标记不显示，而不是退回现代坐标。 */
export async function loadPaleoPoints(
  url: string,
  fetchJson: (url: string) => Promise<unknown>,
  store: typeof usePaleoPointsStore = usePaleoPointsStore,
): Promise<void> {
  const s = store.getState();
  if (s.loadState === "ready" || s.loadState === "loading") return;
  store.setState({ loadState: "loading" });
  try {
    store.setState({ loadState: "ready", data: parsePaleoPoints(await fetchJson(url)) });
  } catch {
    store.setState({ loadState: "error" });
  }
}
