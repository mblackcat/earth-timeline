import { create } from "zustand";
import type { ScaleKind } from "../timeline/TimeScale";

export type VisualStyle = "wireframe" | "solid" | "hybrid";
export type ModelDetail = "auto" | "low" | "high";

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
  /** 生物模型的渲染风格（PLAN §7.3）。 */
  visualStyle: VisualStyle;
  /** 模型细节等级：自动按距离选择 / 强制简化 / 强制完整。 */
  modelDetail: ModelDetail;
  /** 全局动画开关（PLAN §7.4）。 */
  animationsEnabled: boolean;
  /** 模拟时间暂停时，生物 Idle 动画是否继续（PLAN §4.7）。 */
  idleWhenPaused: boolean;
  /** 简单行为（漫游、进食）。关闭后生物原地播放 Idle。 */
  behaviorEnabled: boolean;
  /** 低性能模式：降低分辨率与动画更新频率，减少模型数量，隐藏星空。 */
  lowPerformance: boolean;
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
  setVisualStyle: (v: VisualStyle) => void;
  setModelDetail: (v: ModelDetail) => void;
  setAnimationsEnabled: (v: boolean) => void;
  setIdleWhenPaused: (v: boolean) => void;
  setBehaviorEnabled: (v: boolean) => void;
  setLowPerformance: (v: boolean) => void;
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
  visualStyle: "hybrid",
  modelDetail: "auto",
  animationsEnabled: true,
  idleWhenPaused: true,
  behaviorEnabled: true,
  lowPerformance: false,
  timelineScale: "segmented",
  timelineFollow: true,
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setShowGraticule: (showGraticule) => set({ showGraticule }),
  setShowOutlines: (showOutlines) => set({ showOutlines }),
  setShowModernReference: (showModernReference) => set({ showModernReference }),
  setShowEventMarkers: (showEventMarkers) => set({ showEventMarkers }),
  setShowFossilSites: (showFossilSites) => set({ showFossilSites }),
  setVisualStyle: (visualStyle) => set({ visualStyle }),
  setModelDetail: (modelDetail) => set({ modelDetail }),
  setAnimationsEnabled: (animationsEnabled) => set({ animationsEnabled }),
  setIdleWhenPaused: (idleWhenPaused) => set({ idleWhenPaused }),
  setBehaviorEnabled: (behaviorEnabled) => set({ behaviorEnabled }),
  setLowPerformance: (lowPerformance) => set({ lowPerformance }),
  setTimelineScale: (timelineScale) => set({ timelineScale }),
  setTimelineFollow: (timelineFollow) => set({ timelineFollow }),
}));
