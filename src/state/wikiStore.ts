import { create } from "zustand";

/** 生物百科抽屉：是否打开、当前条目。与地图上的选中物种相互独立。 */
export interface WikiState {
  open: boolean;
  speciesId: string | null;
  openWiki: (speciesId?: string) => void;
  select: (speciesId: string) => void;
  close: () => void;
}

export const useWikiStore = create<WikiState>()((set) => ({
  open: false,
  speciesId: null,
  openWiki: (speciesId) => set((s) => ({ open: true, speciesId: speciesId ?? s.speciesId })),
  select: (speciesId) => set({ speciesId }),
  close: () => set({ open: false }),
}));
