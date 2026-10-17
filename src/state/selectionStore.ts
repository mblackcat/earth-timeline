import { create } from "zustand";

/**
 * 选择关系（TASKS §2 不变式 6）：选中事件与选中对象相互独立。
 * 选中事件不修改时间；跳转由调用方显式发给 TimeEngine。
 */
export interface SelectionState {
  selectedEventId: string | null;
  /** 选中的对象（物种）。时间变化导致其不可见时由可见性同步清除。 */
  selectedSpeciesId: string | null;
  /** 详情浮层当前显示哪一类。 */
  detail: "event" | "species" | null;
  selectEvent: (id: string | null) => void;
  selectSpecies: (id: string | null) => void;
  closeDetail: () => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedEventId: null,
  selectedSpeciesId: null,
  detail: null,
  selectEvent: (selectedEventId) => set({ selectedEventId, detail: selectedEventId ? "event" : null }),
  selectSpecies: (selectedSpeciesId) => set({ selectedSpeciesId, detail: selectedSpeciesId ? "species" : null }),
  closeDetail: () => set({ detail: null }),
}));
