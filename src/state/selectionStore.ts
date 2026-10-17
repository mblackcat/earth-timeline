import { create } from "zustand";

/**
 * 选择关系（TASKS §2 不变式 6）：选中事件与选中对象相互独立。
 * 选中事件不修改时间；跳转由调用方显式发给 TimeEngine。
 */
export interface SelectionState {
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
}

export const useSelectionStore = create<SelectionState>()((set) => ({
  selectedEventId: null,
  selectEvent: (selectedEventId) => set({ selectedEventId }),
}));
