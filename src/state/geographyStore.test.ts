import { create } from "zustand";
import type { PaleoGeographySlice } from "../data/schema";
import { PaleoGeographyProvider } from "../data/geology/PaleoGeographyProvider";
import { startGeographySync, type GeographyState } from "./geographyStore";
import type { TimeState } from "./timeStore";

const slice = (id: string, from: number, to: number): PaleoGeographySlice => ({
  id,
  label: id,
  timeRange: { fromYearsAgo: from, toYearsAgo: to },
  kind: "reconstruction",
  isSchematic: false,
  dataUrl: id,
  evidenceLevel: "estimated",
  sourceIds: [],
  note: "",
});

function setup() {
  const fetchJson = vi.fn(async (url: string) => ({ format: "ett-outlines/1", sourceId: url, outlines: [[[0, 0], [1, 0]]] }));
  const provider = new PaleoGeographyProvider([slice("modern", 10_000, 0), slice("permian", 260e6, 250e6)], { fetchJson });
  const time = create<TimeState>()(() => ({ currentTimeYearsAgo: 0 }));
  const geo = create<GeographyState>()(() => ({
    status: "missing",
    message: "",
    slice: null,
    loadState: "idle",
    error: null,
    outlines: null,
  }));
  return { fetchJson, provider, time, geo };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("startGeographySync", () => {
  it("loads the slice for the current time and updates when time moves into another slice", async () => {
    const { fetchJson, provider, time, geo } = setup();
    const stop = startGeographySync(provider, time, geo);
    await flush();
    expect(geo.getState()).toMatchObject({ status: "exact", loadState: "ready", slice: { id: "modern" } });

    time.setState({ currentTimeYearsAgo: 5_000 }); // 同一切片：不重复加载
    await flush();
    expect(fetchJson).toHaveBeenCalledTimes(1);

    time.setState({ currentTimeYearsAgo: 255e6 });
    await flush();
    expect(geo.getState()).toMatchObject({ loadState: "ready", slice: { id: "permian" } });

    time.setState({ currentTimeYearsAgo: 1e9 }); // 无数据：清空轮廓，不残留
    await flush();
    expect(geo.getState()).toMatchObject({ status: "missing", slice: null, outlines: null });
    stop();
  });

  it("ignores stale loads after time has moved on", async () => {
    const { provider, time, geo } = setup();
    const stop = startGeographySync(provider, time, geo);
    time.setState({ currentTimeYearsAgo: 255e6 }); // 在 modern 加载完成前切走
    await flush();
    expect(geo.getState().slice?.id).toBe("permian");
    expect(geo.getState().outlines?.length).toBe(1);
    stop();
  });

  it("surfaces load errors without crashing", async () => {
    const { time, geo } = setup();
    const provider = new PaleoGeographyProvider([slice("modern", 10_000, 0)], {
      fetchJson: () => Promise.reject(new Error("offline")),
    });
    const stop = startGeographySync(provider, time, geo);
    await flush();
    expect(geo.getState()).toMatchObject({ loadState: "error", error: "offline" });
    stop();
  });
});
