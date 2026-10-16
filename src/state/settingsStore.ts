import { create } from "zustand";

/** 集中管理的用户设置（PLAN §7）。只影响显示，不修改模拟时间或相机。 */
export interface SettingsState {
  panelOpen: boolean;
  showGraticule: boolean;
  showOutlines: boolean;
  setPanelOpen: (open: boolean) => void;
  setShowGraticule: (v: boolean) => void;
  setShowOutlines: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  panelOpen: true,
  showGraticule: true,
  showOutlines: true,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setShowGraticule: (showGraticule) => set({ showGraticule }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
}));
