import { isWithinTimeRange, type PaleoGeographyOutlines, type PaleoGeographySlice } from "../schema";

export type PaleoResolveStatus = "exact" | "fallback" | "missing";

export interface PaleoResolveResult {
  slice: PaleoGeographySlice | null;
  status: PaleoResolveStatus;
  message: string;
}

export interface PaleoProviderOptions {
  /**
   * 时间不在任何切片内时，允许借用最近切片的最大距离（年）。
   * 默认 0：宁可显示"无数据"，也不把其他年代的轮廓当作该时期事实（PLAN §3.3.3）。
   */
  fallbackToleranceYears?: number;
  fetchJson?: (url: string) => Promise<unknown>;
}

function distanceToRange(slice: PaleoGeographySlice, yearsAgo: number): number {
  const { fromYearsAgo, toYearsAgo } = slice.timeRange;
  if (yearsAgo > fromYearsAgo) return yearsAgo - fromYearsAgo;
  if (yearsAgo < toYearsAgo) return toYearsAgo - yearsAgo;
  return 0;
}

function isOutlines(value: unknown): value is PaleoGeographyOutlines {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<PaleoGeographyOutlines>;
  return v.format === "ett-outlines/1" && Array.isArray(v.outlines);
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return res.json();
}

/** 按时间解析古地理切片，并按需加载、缓存轮廓数据。 */
export class PaleoGeographyProvider {
  private readonly slices: PaleoGeographySlice[];
  private readonly tolerance: number;
  private readonly fetchJson: (url: string) => Promise<unknown>;
  private readonly cache = new Map<string, Promise<PaleoGeographyOutlines>>();

  constructor(slices: PaleoGeographySlice[], options: PaleoProviderOptions = {}) {
    this.slices = slices;
    this.tolerance = options.fallbackToleranceYears ?? 0;
    this.fetchJson = options.fetchJson ?? defaultFetchJson;
  }

  resolve(yearsAgo: number): PaleoResolveResult {
    const exact = this.slices.find((s) => isWithinTimeRange(s.timeRange, yearsAgo));
    if (exact) return { slice: exact, status: "exact", message: exact.label };

    let nearest: PaleoGeographySlice | null = null;
    let best = Infinity;
    for (const s of this.slices) {
      const d = distanceToRange(s, yearsAgo);
      if (d < best) {
        best = d;
        nearest = s;
      }
    }
    if (nearest && best <= this.tolerance) {
      return {
        slice: nearest,
        status: "fallback",
        message: `该时期无专门数据，暂用相邻切片：${nearest.label}`,
      };
    }
    return { slice: null, status: "missing", message: "该时期暂无古地理重建数据" };
  }

  load(slice: PaleoGeographySlice): Promise<PaleoGeographyOutlines> {
    let pending = this.cache.get(slice.id);
    if (!pending) {
      pending = this.fetchJson(slice.dataUrl).then((data) => {
        if (!isOutlines(data)) throw new Error(`古地理数据格式无效：${slice.dataUrl}`);
        return data;
      });
      // 失败不缓存，允许重试。
      pending.catch(() => this.cache.delete(slice.id));
      this.cache.set(slice.id, pending);
    }
    return pending;
  }
}
