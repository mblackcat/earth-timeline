import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel/SettingsPanel";
import { TopBar } from "./TopBar/TopBar";
import { useSettingsStore } from "../state/settingsStore";
import { useTimeStore } from "../state/timeStore";
import { useViewStore } from "../state/viewStore";

describe("TopBar", () => {
  it("issues camera commands without touching simulated time", () => {
    render(<TopBar />);
    const before = useTimeStore.getState().currentTimeYearsAgo;
    fireEvent.click(screen.getByTestId("btn-global-view"));
    expect(useViewStore.getState().command).toMatchObject({ kind: "global" });
    const firstId = useViewStore.getState().command!.id;
    fireEvent.click(screen.getByTestId("btn-reset-view"));
    expect(useViewStore.getState().command).toMatchObject({ kind: "default", id: firstId + 1 });
    expect(useTimeStore.getState().currentTimeYearsAgo).toBe(before);
  });

  it("shows the current time from the shared time store", () => {
    render(<TopBar />);
    expect(screen.getByTestId("current-time")).toHaveTextContent("公元 2000 年");
  });
});

describe("SettingsPanel", () => {
  it("toggles layers via the settings store and collapses/expands", () => {
    render(<SettingsPanel />);
    fireEvent.click(screen.getByTestId("toggle-graticule"));
    expect(useSettingsStore.getState().showGraticule).toBe(false);
    fireEvent.click(screen.getByTestId("toggle-outlines"));
    expect(useSettingsStore.getState().showOutlines).toBe(false);

    fireEvent.click(screen.getByTestId("btn-toggle-panel"));
    expect(useSettingsStore.getState().panelOpen).toBe(false);
    expect(screen.queryByTestId("toggle-graticule")).toBeNull();
    fireEvent.click(screen.getByTestId("btn-toggle-panel"));
    // 折叠后再展开，设置保持
    expect(screen.getByTestId("toggle-graticule")).not.toBeChecked();
  });

  it("groups settings into playback / timeline / layers and controls the timeline settings", () => {
    useSettingsStore.setState({ panelOpen: true, timelineScale: "segmented", timelineFollow: true });
    render(<SettingsPanel />);
    for (const id of ["group-playback", "group-timeline", "group-layers"]) {
      expect(screen.getByTestId(id)).toHaveAttribute("open");
    }
    fireEvent.change(screen.getByTestId("tl-scale"), { target: { value: "linear" } });
    expect(useSettingsStore.getState().timelineScale).toBe("linear");
    fireEvent.click(screen.getByTestId("tl-follow"));
    expect(useSettingsStore.getState().timelineFollow).toBe(false);
    // 说明文字已移到顶部帮助中
    expect(screen.queryByText(/双击地表/)).toBeNull();
  });
});

describe("Visual and animation settings", () => {
  it("apply to the settings store without touching time or camera", () => {
    useSettingsStore.setState({ panelOpen: true });
    render(<SettingsPanel />);
    const before = { t: useTimeStore.getState().currentTimeYearsAgo, cam: useViewStore.getState().command };
    fireEvent.change(screen.getByTestId("visual-style"), { target: { value: "wireframe" } });
    fireEvent.change(screen.getByTestId("model-detail"), { target: { value: "low" } });
    fireEvent.click(screen.getByTestId("toggle-animations"));
    fireEvent.click(screen.getByTestId("toggle-idle-paused"));
    fireEvent.click(screen.getByTestId("toggle-behavior"));
    fireEvent.click(screen.getByTestId("toggle-low-perf"));
    expect(useSettingsStore.getState()).toMatchObject({
      visualStyle: "wireframe",
      modelDetail: "low",
      animationsEnabled: false,
      idleWhenPaused: false,
      behaviorEnabled: false,
      lowPerformance: true,
    });
    expect(useTimeStore.getState().currentTimeYearsAgo).toBe(before.t);
    expect(useViewStore.getState().command).toBe(before.cam);
  });
});

describe("Help", () => {
  it("opens from the top bar and closes with Escape", () => {
    render(<TopBar />);
    expect(screen.queryByTestId("help-popover")).toBeNull();
    fireEvent.click(screen.getByTestId("btn-help"));
    expect(screen.getByTestId("help-popover")).toHaveTextContent("双击地表");
    expect(screen.getByTestId("help-popover")).toHaveTextContent("宙 · 代 · 纪 · 世");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("help-popover")).toBeNull();
  });
});

describe("TopBar period path", () => {
  afterEach(() => useTimeStore.setState({ currentTimeYearsAgo: 0 }));
  it("renders each rank as a span, marks the finest one, keeps the joined text", () => {
    useTimeStore.setState({ currentTimeYearsAgo: 66_500_000 });
    render(<TopBar />);
    const period = screen.getByTestId("current-period");
    expect(period.textContent).toBe("显生宙 · 中生代 · 白垩纪 · 晚白垩世");
    const spans = period.querySelectorAll("[data-rank]");
    expect(spans.length).toBe(4);
    expect(spans[spans.length - 1]).toHaveClass("current");
  });
});
