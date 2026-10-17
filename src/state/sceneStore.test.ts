import { create } from "zustand";
import { EVENTS } from "../data/events";
import { SPECIES } from "../data/species";
import { loadFossilSites, startVisibilitySync, useFossilSitesStore, useSceneStore, type SceneState } from "./sceneStore";
import { useSelectionStore } from "./selectionStore";
import { useSettingsStore } from "./settingsStore";
import { useTimeStore } from "./timeStore";

function setup(startYearsAgo: number) {
  const timeStore = create<ReturnType<typeof useTimeStore.getState>>()(() => ({ ...useTimeStore.getState(), currentTimeYearsAgo: startYearsAgo, isPlaying: false }));
  const settingsStore = create<ReturnType<typeof useSettingsStore.getState>>()(() => ({ ...useSettingsStore.getState(), showEventMarkers: true, showFossilSites: true }));
  const selectionStore = create<ReturnType<typeof useSelectionStore.getState>>()(() => ({ ...useSelectionStore.getState(), selectedSpeciesId: null, selectedEventId: null, detail: null }));
  const sceneStore = create<SceneState>()(() => ({ visible: { events: [], species: [] }, key: "" }));
  const stop = startVisibilitySync({
    events: EVENTS,
    species: SPECIES,
    timeStore: timeStore as unknown as typeof useTimeStore,
    settingsStore: settingsStore as unknown as typeof useSettingsStore,
    selectionStore: selectionStore as unknown as typeof useSelectionStore,
    sceneStore: sceneStore as unknown as typeof useSceneStore,
  });
  return { timeStore, settingsStore, selectionStore, sceneStore, stop };
}

describe("visibility sync", () => {
  it("updates visible objects when time changes, only when the set changes", () => {
    const { timeStore, sceneStore, stop } = setup(68e6);
    expect(sceneStore.getState().visible.species.map((s) => s.id)).toEqual(["tyrannosaurus-rex"]);
    const writes = vi.fn();
    const off = sceneStore.subscribe(writes);
    timeStore.setState({ currentTimeYearsAgo: 68.01e6 });
    expect(writes).not.toHaveBeenCalled();
    timeStore.setState({ currentTimeYearsAgo: 500e6 });
    expect(writes).toHaveBeenCalledTimes(1);
    expect(sceneStore.getState().visible.species.map((s) => s.id)).toEqual(["trilobita"]);
    off();
    stop();
  });

  it("does not leave stale objects after scrubbing back and forth", () => {
    const { timeStore, sceneStore, stop } = setup(0);
    for (const t of [500e6, 68e6, 3.5e6, 0, 300e6, 68e6]) timeStore.setState({ currentTimeYearsAgo: t });
    expect(sceneStore.getState().visible.species.map((s) => s.id)).toEqual(["tyrannosaurus-rex"]);
    stop();
  });

  it("clears the object selection when the selected species leaves its range, but keeps the event selection", () => {
    const { timeStore, selectionStore, stop } = setup(68e6);
    selectionStore.setState({ selectedSpeciesId: "tyrannosaurus-rex", selectedEventId: "jurassic", detail: "species" });
    timeStore.setState({ currentTimeYearsAgo: 60e6 });
    expect(selectionStore.getState()).toMatchObject({ selectedSpeciesId: null, selectedEventId: "jurassic", detail: null });
    stop();
  });

  it("hides objects when the layer is switched off", () => {
    const { settingsStore, sceneStore, stop } = setup(68e6);
    settingsStore.setState({ showFossilSites: false, showEventMarkers: false });
    expect(sceneStore.getState().visible).toEqual({ events: [], species: [] });
    stop();
  });
});

describe("fossil site loading", () => {
  beforeEach(() => useFossilSitesStore.setState({ loadState: "idle", error: null, data: null }));

  it("reports errors without throwing and can retry", async () => {
    await loadFossilSites(async () => {
      throw new Error("网络错误");
    });
    expect(useFossilSitesStore.getState()).toMatchObject({ loadState: "error", error: "网络错误" });
    await loadFossilSites(async () => ({ format: "ett-fossil-sites/1", sourceId: "pbdb", generated: "", note: "", species: {} }));
    expect(useFossilSitesStore.getState().loadState).toBe("ready");
  });

  it("rejects malformed data", async () => {
    await loadFossilSites(async () => ({ format: "nope" }));
    expect(useFossilSitesStore.getState().loadState).toBe("error");
  });
});

describe("paleo points loading", () => {
  it("parses valid data and keeps an error state on failure", async () => {
    const { loadPaleoPoints, usePaleoPointsStore } = await import("./sceneStore");
    usePaleoPointsStore.setState({ loadState: "idle", data: null });
    await loadPaleoPoints("x", async () => {
      throw new Error("offline");
    });
    expect(usePaleoPointsStore.getState()).toMatchObject({ loadState: "error", data: null });
    await loadPaleoPoints("x", async () => ({ format: "ett-paleo-points/1", model: "m", sourceIds: [], generated: "", species: {}, events: {} }));
    expect(usePaleoPointsStore.getState().loadState).toBe("ready");
  });
});
