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
    expect(screen.getByTestId("current-time")).toHaveTextContent("距今 0 年");
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
});
