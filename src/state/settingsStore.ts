import { create } from "zustand";
import type { ScaleKind } from "../timeline/TimeScale";

/** 集中管理的用户设置（PLAN §7）。只影响显示，不修改模拟时间或相机。 */
export interface SettingsState {
  panelOpen: boolean;
  showGraticule: boolean;
  showOutlines: boolean;
  /** 没有古地理数据的时期，显示暗色现代海岸线作为定位参考。 */
  showModernReference: boolean;
  /** 历史事件在地球上的标记。 */
  showEventMarkers: boolean;
  /** 物种化石点（分布）。 */
  showFossilSites: boolean;
  /** 时间轴刻度：分段压缩 / 线性。 */
  timelineScale: ScaleKind;
  /** 播放时时间轴视窗自动跟随当前时间。 */
  timelineFollow: boolean;
  setPanelOpen: (open: boolean) => void;
  setShowGraticule: (v: boolean) => void;
  setShowOutlines: (v: boolean) => void;
  setShowModernReference: (v: boolean) => void;
  setShowEventMarkers: (v: boolean) => void;
  setShowFossilSites: (v: boolean) => void;
  setTimelineScale: (v: ScaleKind) => void;
  setTimelineFollow: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  panelOpen: true,
  showGraticule: true,
  showOutlines: true,
  showModernReference: true,
  showEventMarkers: true,
  showFossilSites: true,
  timelineScale: "segmented",
  timelineFollow: true,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setShowGraticule: (showGraticule) => set({ showGraticule }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
  setShowModernReference: (showModernReference) => set({ showModernReference }),
  setShowEventMarkers: (showEventMarkers) => set({ showEventMarkers }),
  setShowFossilSites: (showFossilSites) => set({ showFossilSites }),
  setTimelineScale: (timelineScale) => set({ timelineScale }),
  setTimelineFollow: (timelineFollow) => set({ timelineFollow }),
}));
