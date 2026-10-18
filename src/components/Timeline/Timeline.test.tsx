import { act, fireEvent, render, screen } from "@testing-library/react";
import { Timeline } from "./Timeline";
import { bindTimeStore } from "../../state/timeStore";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore } from "../../state/settingsStore";
import { timeEngine } from "../../timeline/runtime";
import { INK, mixHex } from "../../scene/Ink/inkPalette";
import { geoPathAt } from "../../data/geology/timescale";
import { TimeScale } from "../../timeline/TimeScale";

const WIDTH = 1030; // 轨道宽 1000 + 左侧 30

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => WIDTH });
  Element.prototype.setPointerCapture ??= () => {};
});

let unbind: () => void;
beforeEach(() => {
  timeEngine.pause();
  timeEngine.seek(0);
  useSelectionStore.setState({ selectedEventId: null });
  useSettingsStore.setState({ timelineScale: "segmented", timelineFollow: true });
  unbind = bindTimeStore(timeEngine);
});
afterEach(() => unbind());

const windowOf = () => {
  const el = screen.getByTestId("timeline-window");
  return { u0: Number(el.dataset.u0), u1: Number(el.dataset.u1) };
};
const rowRanks = () => Array.from(document.querySelectorAll(".tl-row")).map((r) => r.getAttribute("data-rank"));

describe("Timeline", () => {
  it("renders geologic bands, ticks, all key events and the indicator", () => {
    render(<Timeline leading={<span data-testid="leading" />} />);
    expect(screen.getByTestId("leading")).toBeInTheDocument();
    expect(rowRanks().slice(0, 2)).toEqual(["eon", "era"]);
    expect(document.querySelectorAll(".tl-tick").length).toBeGreaterThan(4);
    expect(document.querySelectorAll(".tl-event")).toHaveLength(17);
    // 现代在最右
    expect(Number(screen.getByTestId("timeline-indicator").dataset.x)).toBeCloseTo(1000, 3);
  });

  it("clicking an event seeks the shared engine and selects it", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByTestId("event-end-cretaceous-extinction"));
    expect(timeEngine.currentTimeYearsAgo).toBe(66_000_000);
    expect(useSelectionStore.getState().selectedEventId).toBe("end-cretaceous-extinction");
    expect(screen.getByTestId("timeline-selected")).toHaveTextContent("白垩纪末大灭绝");
    // 指示器与事件标记重合
    const ex = Number(screen.getByTestId("event-end-cretaceous-extinction").dataset.x);
    expect(Number(screen.getByTestId("timeline-indicator").dataset.x)).toBeCloseTo(ex, 3);
  });

  it("zooms independently of time, keeping event positions consistent with their true age", () => {
    render(<Timeline />);
    fireEvent.click(screen.getByTestId("event-end-permian-extinction"));
    const before = timeEngine.currentTimeYearsAgo;
    for (let i = 0; i < 6; i++) fireEvent.click(screen.getByTestId("tl-zoom-in"));
    const w = windowOf();
    expect(w.u1 - w.u0).toBeCloseTo(1 / 64, 6);
    expect(timeEngine.currentTimeYearsAgo).toBe(before);
    // 缩放围绕当前时间：指示器与事件标记仍重合且在视窗内
    const ix = Number(screen.getByTestId("timeline-indicator").dataset.x);
    expect(ix).toBeGreaterThan(0);
    expect(ix).toBeLessThan(1000);
    expect(Number(screen.getByTestId("event-end-permian-extinction").dataset.x)).toBeCloseTo(ix, 0);
    // 放大后显示更细的年代层级
    expect(rowRanks()).toEqual(["eon", "era", "period", "epoch"]);
    fireEvent.click(screen.getByTestId("tl-zoom-all"));
    expect(windowOf()).toEqual({ u0: 0, u1: 1 });
  });

  it("dragging on the ruler scrubs the time; dragging the bands pans the view", () => {
    render(<Timeline />);
    const svg = screen.getByTestId("timeline-svg");
    // jsdom 的 getBoundingClientRect 为 0：clientX 即 SVG 内坐标
    fireEvent.pointerDown(svg, { clientX: 30 + 500, clientY: 5, button: 0, pointerId: 1 });
    const t1 = timeEngine.currentTimeYearsAgo;
    fireEvent.pointerMove(svg, { clientX: 30 + 100, clientY: 5, pointerId: 1 });
    const t2 = timeEngine.currentTimeYearsAgo;
    fireEvent.pointerUp(svg, { clientX: 30 + 100, clientY: 5, pointerId: 1 });
    expect(t1).toBeGreaterThan(0);
    expect(t2).toBeGreaterThan(t1); // 往左 = 更古老

    fireEvent.click(screen.getByTestId("tl-zoom-in"));
    act(() => useSettingsStore.setState({ timelineFollow: false })); // 关闭跟随，避免视窗被拉回
    const w0 = windowOf();
    fireEvent.pointerDown(svg, { clientX: 600, clientY: 30, button: 0, pointerId: 2 });
    fireEvent.pointerMove(svg, { clientX: 400, clientY: 30, pointerId: 2 });
    fireEvent.pointerUp(svg, { clientX: 400, clientY: 30, pointerId: 2 });
    const w1 = windowOf();
    expect(w1.u0).toBeGreaterThan(w0.u0); // 向左拖 = 视窗右移
    expect(w1.u1 - w1.u0).toBeCloseTo(w0.u1 - w0.u0, 9);
    expect(timeEngine.currentTimeYearsAgo).toBe(t2); // 平移不改变时间
  });

  it("clicking a geologic unit zooms to it", () => {
    render(<Timeline />);
    const unit = document.querySelector('[data-unit-id="mesozoic"] rect')!;
    fireEvent.pointerDown(unit, { clientX: 500, clientY: 30, button: 0, pointerId: 3 });
    fireEvent.pointerUp(unit, { clientX: 500, clientY: 30, pointerId: 3 });
    const scale = new TimeScale("segmented", 4_540_000_000);
    const [a, b] = [scale.toU(251_902_000), scale.toU(66_000_000)];
    const w = windowOf();
    expect(w.u0).toBeLessThan(a);
    expect(w.u1).toBeGreaterThan(b);
    expect(w.u1 - w.u0).toBeLessThan((b - a) * 1.2);
    expect(rowRanks()).toContain("period");
  });

  it("follows the current time while playing when it leaves the view", () => {
    render(<Timeline />);
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId("tl-zoom-in"));
    act(() => {
      timeEngine.seek(1_000_000_000);
    });
    const w = windowOf();
    const x = Number(screen.getByTestId("timeline-indicator").dataset.x);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(1000);
    expect(w.u1 - w.u0).toBeCloseTo(1 / 16, 6);
  });

  it("switching to a linear scale (from settings) resets the view and keeps time", () => {
    render(<Timeline />);
    timeEngine.seek(500_000_000);
    fireEvent.click(screen.getByTestId("tl-zoom-in"));
    act(() => useSettingsStore.setState({ timelineScale: "linear" }));
    expect(timeEngine.currentTimeYearsAgo).toBe(500_000_000);
    expect(windowOf()).toEqual({ u0: 0, u1: 1 });
    // 线性刻度没有分段边界
    expect(document.querySelectorAll(".tl-tick.boundary")).toHaveLength(0);
  });

  it("supports keyboard stepping and zoom", () => {
    render(<Timeline />);
    timeEngine.setStepSize(10);
    act(() => {
      timeEngine.seek(100);
    });
    const svg = screen.getByTestId("timeline-svg");
    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    expect(timeEngine.currentTimeYearsAgo).toBe(110);
    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(timeEngine.currentTimeYearsAgo).toBe(100);
    fireEvent.keyDown(svg, { key: "+" });
    expect(windowOf().u1 - windowOf().u0).toBeCloseTo(0.5, 6);
    timeEngine.setStepSize(1);
  });

  it("geo bands are ICS colors mixed toward paper, and the current units are marked", () => {
    act(() => timeEngine.seek(66_500_000));
    render(<Timeline leading={null} />);
    const period = geoPathAt(66_500_000).period!;
    const g = document.querySelector(`[data-unit-id="${period.id}"]`)!;
    expect(g.querySelector("rect")!.getAttribute("fill")).toBe(mixHex(period.color, INK.paper, 0.45));
    expect(g).toHaveClass("current");
  });
});
