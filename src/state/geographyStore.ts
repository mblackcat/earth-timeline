import { create } from "zustand";
import type { LonLat, PaleoGeographySlice } from "../data/schema";
import type { PaleoGeographyProvider, PaleoResolveStatus } from "../data/geology/PaleoGeographyProvider";
import type { StoreApi } from "zustand";
import { useTimeStore } from "./timeStore";

/** 同步只关心当前时间，不依赖完整的引擎快照。 */
type TimeSource = Pick<StoreApi<{ currentTimeYearsAgo: number }>, "getState" | "subscribe">;

export interface GeographyState {
  status: PaleoResolveStatus;
  message: string;
  slice: PaleoGeographySlice | null;
  loadState: "idle" | "loading" | "ready" | "error";
  error: string | null;
  outlines: LonLat[][] | null;
}

export const useGeographyStore = create<GeographyState>()(() => ({
  status: "missing",
  message: "",
  slice: null,
  loadState: "idle",
  error: null,
  outlines: null,
}));

/**
 * 时间 → 古地理切片 的同步：订阅模拟时间，仅当解析出的切片变化时才重新加载。
 * 返回取消订阅函数。
 */
export function startGeographySync(
  provider: PaleoGeographyProvider,
  timeStore: TimeSource = useTimeStore,
  geoStore = useGeographyStore,
): () => void {
  let currentSliceId: string | null | undefined;
  let active = true;

  const apply = (yearsAgo: number) => {
    const { slice, status, message } = provider.resolve(yearsAgo);
    const sliceId = slice?.id ?? null;
    if (sliceId === currentSliceId) {
      geoStore.setState({ status, message });
      return;
    }
    currentSliceId = sliceId;
    if (!slice) {
      geoStore.setState({ status, message, slice: null, loadState: "idle", error: null, outlines: null });
      return;
    }
    geoStore.setState({ status, message, slice, loadState: "loading", error: null, outlines: null });
    provider.load(slice).then(
      (data) => {
        if (!active || currentSliceId !== slice.id) return; // 已停止或已切换到其他切片
        geoStore.setState({ loadState: "ready", outlines: data.outlines });
      },
      (err: unknown) => {
        if (!active || currentSliceId !== slice.id) return;
        currentSliceId = undefined; // 下次时间变化时允许重试
        geoStore.setState({ loadState: "error", error: err instanceof Error ? err.message : String(err) });
      },
    );
  };

  apply(timeStore.getState().currentTimeYearsAgo);
  const unsubscribe = timeStore.subscribe((s, prev) => {
    if (s.currentTimeYearsAgo !== prev.currentTimeYearsAgo) apply(s.currentTimeYearsAgo);
  });
  return () => {
    active = false;
    unsubscribe();
  };
}

// ───────────── 现代海岸线参考层 ─────────────

/**
 * 深时下的定位参考：化石点使用现代坐标，因此用暗色现代海岸线帮助辨认位置。
 * 只作参考，场景中必须与古地理轮廓明显区分并在说明中注明（PLAN §3.3.3）。
 */
export const useReferenceCoastlineStore = create<{ outlines: LonLat[][] | null }>()(() => ({ outlines: null }));

export async function loadReferenceCoastline(
  provider: PaleoGeographyProvider,
  slice: PaleoGeographySlice,
  store = useReferenceCoastlineStore,
): Promise<void> {
  try {
    const data = await provider.load(slice);
    store.setState({ outlines: data.outlines });
  } catch {
    // 参考层是可选的：加载失败时不显示，不影响其他内容
  }
}
