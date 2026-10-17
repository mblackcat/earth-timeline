import { create } from "zustand";
import type { ScaleKind } from "../timeline/TimeScale";

/** 集中管理的用户设置（PLAN §7）。只影响显示，不修改模拟时间或相机。 */
export interface SettingsState {
  panelOpen: boolean;
  showGraticule: boolean;
  showOutlines: boolean;
  /** 时间轴刻度：分段压缩 / 线性。 */
  timelineScale: ScaleKind;
  /** 播放时时间轴视窗自动跟随当前时间。 */
  timelineFollow: boolean;
  setPanelOpen: (open: boolean) => void;
  setShowGraticule: (v: boolean) => void;
  setShowOutlines: (v: boolean) => void;
  setTimelineScale: (v: ScaleKind) => void;
  setTimelineFollow: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  panelOpen: true,
  showGraticule: true,
  showOutlines: true,
  timelineScale: "segmented",
  timelineFollow: true,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setShowGraticule: (showGraticule) => set({ showGraticule }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
  setTimelineScale: (timelineScale) => set({ timelineScale }),
  setTimelineFollow: (timelineFollow) => set({ timelineFollow }),
}));
