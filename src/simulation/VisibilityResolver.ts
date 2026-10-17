import { eventAnchorYearsAgo } from "../data/events";
import { REGIONS } from "../data/regions";
import type { HistoricalEvent, LonLat, Species } from "../data/schema";

/**
 * 时间 → 可见对象（TASKS §1.2 simulation 层）。纯函数，只依赖数据与时间。
 *
 * - 物种：严格按生存范围显示（PLAN §2.1：不得在时间范围外持续显示）。
 * - 事件：真实年代（含不确定范围）内为 "active"；两侧另有显示窗口（"near"），
 *   否则瞬时事件在播放中一闪而过。窗口 = max(30 年, 年代的 4%, 播放时约 3 秒的模拟时长)。
 */

export type EventEmphasis = "active" | "near";

export interface VisibleEvent {
  event: HistoricalEvent;
  emphasis: EventEmphasis;
}

export interface VisibilityInput {
  yearsAgo: number;
  /** 当前播放倍率（年/秒）；暂停时传 0。 */
  playingRate: number;
  showEvents: boolean;
  showSpecies: boolean;
}

export interface VisibleSet {
  events: VisibleEvent[];
  species: Species[];
}

const MIN_WINDOW_YEARS = 30;
const RELATIVE_WINDOW = 0.04;
const HOLD_SECONDS = 3;

export function eventWindowYears(e: HistoricalEvent, playingRate = 0): number {
  return Math.max(MIN_WINDOW_YEARS, e.time.fromYearsAgo * RELATIVE_WINDOW, playingRate * HOLD_SECONDS);
}

export function eventEmphasisAt(e: HistoricalEvent, yearsAgo: number, playingRate = 0): EventEmphasis | null {
  const older = e.time.fromYearsAgo + (e.time.uncertaintyYears?.older ?? 0);
  const younger = e.time.toYearsAgo - (e.time.uncertaintyYears?.younger ?? 0);
  if (yearsAgo <= older && yearsAgo >= younger) return "active";
  const w = eventWindowYears(e, playingRate);
  if (yearsAgo <= older + w && yearsAgo >= younger - w) return "near";
  return null;
}

export function isSpeciesAlive(s: Species, yearsAgo: number): boolean {
  return yearsAgo <= s.time.fromYearsAgo && yearsAgo >= s.time.toYearsAgo;
}

export function resolveVisible(events: HistoricalEvent[], species: Species[], input: VisibilityInput): VisibleSet {
  const out: VisibleSet = { events: [], species: [] };
  if (input.showEvents) {
    for (const event of events) {
      const emphasis = eventEmphasisAt(event, input.yearsAgo, input.playingRate);
      if (emphasis) out.events.push({ event, emphasis });
    }
    // 离当前时间最近的事件排在前面
    out.events.sort(
      (a, b) => Math.abs(eventAnchorYearsAgo(a.event) - input.yearsAgo) - Math.abs(eventAnchorYearsAgo(b.event) - input.yearsAgo),
    );
  }
  if (input.showSpecies) out.species = species.filter((s) => isSpeciesAlive(s, input.yearsAgo));
  return out;
}

/** 用于判断可见集合是否变化（只在变化时触发 React 更新，风险 R2）。 */
export function visibleSetKey(v: VisibleSet): string {
  const ev = v.events.map((e) => `${e.event.id}:${e.emphasis[0]}`).join(",");
  const sp = v.species.map((s) => s.id).join(",");
  return `${ev}|${sp}`;
}

/** 事件在地球上的标注位置：点 / 化石点 / 区域中心；全球事件返回 null。 */
export function eventAnchorLonLat(e: HistoricalEvent): LonLat | null {
  const loc = e.location;
  if (!loc) return null;
  if (loc.coordinates) return loc.coordinates;
  if (loc.sites?.length) return loc.sites[0]!;
  if (loc.regionId && REGIONS[loc.regionId]) return REGIONS[loc.regionId]!.center;
  return null;
}

/** 一组经纬度点的球面平均位置（用于"在地球上定位"）。 */
export function sphericalCentroid(points: LonLat[]): LonLat | null {
  if (!points.length) return null;
  const D = Math.PI / 180;
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [lon, lat] of points) {
    x += Math.cos(lat * D) * Math.cos(lon * D);
    y += Math.cos(lat * D) * Math.sin(lon * D);
    z += Math.sin(lat * D);
  }
  const r = Math.hypot(x, y, z);
  if (r < 1e-9) return points[0]!;
  return [Math.atan2(y, x) / D, Math.asin(z / r) / D];
}
