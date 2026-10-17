import { create } from "zustand";
import type { SpatialLevel } from "../utils/geo";

export type CameraCommandKind = "global" | "default" | "focus";

/** focus 命令的目标：注视的经纬度与高度（地球半径单位）。 */
export interface CameraFocusTarget {
  lon: number;
  lat: number;
  altitude?: number;
}

export interface CameraCommand {
  kind: CameraCommandKind;
  /** 单调递增，用于区分连续发出的同类命令。 */
  id: number;
  target?: CameraFocusTarget;
}

/**
 * 相机派生信息（由 CameraController 写入，节流）与相机命令。
 * 只是视图信息，永远不写入模拟时间。
 */
export interface ViewState {
  altitude: number;
  level: SpatialLevel;
  /** 相机所在方向的经纬度（度）。 */
  lon: number;
  lat: number;
  command: CameraCommand | null;
  requestCamera: (kind: CameraCommandKind, target?: CameraFocusTarget) => void;
  setView: (v: { altitude: number; level: SpatialLevel; lon: number; lat: number }) => void;
}

export const useViewStore = create<ViewState>()((set, get) => ({
  altitude: 0,
  level: 0,
  lon: 0,
  lat: 0,
  command: null,
  requestCamera: (kind, target) => set({ command: { kind, id: (get().command?.id ?? 0) + 1, ...(target ? { target } : {}) } }),
  setView: (v) => set(v),
}));
