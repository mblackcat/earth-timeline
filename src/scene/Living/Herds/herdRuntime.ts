import type { LonLat } from "../../../data/schema";

/** 实例档当前摆放的一个个体（位置已含散布偏移与板块漂移）。 */
export interface PlacedIndividual {
  key: string;
  speciesId: string;
  lonLat: LonLat;
  sizeM: number;
  /** 动物（可升为完整档）。 */
  mobile: boolean;
  /** 成群分组：物种 + 点位。 */
  siteGroup: string;
}

/**
 * 实例档与完整档之间的逐帧共享状态（模块级，不触发 React 渲染）。
 * Herds 写 placed；HerdAgents 写 promoted / version / agents / chases。
 */
export const herdRuntime = {
  placed: new Map<string, PlacedIndividual>(),
  /** 由完整档显示（实例档中隐藏）的个体。 */
  promoted: new Set<string>(),
  /** promoted 每次变化加 1。 */
  version: 0,
  agents: 0,
  chases: 0,
};
