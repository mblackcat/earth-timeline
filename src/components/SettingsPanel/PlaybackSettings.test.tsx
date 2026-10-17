import { act, fireEvent, render, screen } from "@testing-library/react";
import { PlaybackSettings } from "./PlaybackSettings";
import { bindTimeStore } from "../../state/timeStore";
import { timeEngine } from "../../timeline/runtime";
import { EARTH_FORMATION_YEARS_AGO } from "../../timeline/TimeEngine";

let unbind: () => void;
beforeEach(() => {
  timeEngine.pause();
  timeEngine.setDirection("forward");
  timeEngine.setMode("fine");
  timeEngine.setRate(1);
  timeEngine.setStepSize(1);
  timeEngine.seek(1000);
  unbind = bindTimeStore(timeEngine);
});
afterEach(() => unbind());

describe("PlaybackSettings", () => {
  it("sets direction, steps and jumps through the engine", () => {
    render(<PlaybackSettings />);
    fireEvent.click(screen.getByTestId("dir-backward"));
    expect(timeEngine.getSnapshot().direction).toBe("backward");
    fireEvent.change(screen.getByTestId("step-size"), { target: { value: "100" } });
    fireEvent.click(screen.getByTestId("btn-step-back"));
    expect(timeEngine.currentTimeYearsAgo).toBe(1100);
    fireEvent.click(screen.getByTestId("btn-step-forward"));
    expect(timeEngine.currentTimeYearsAgo).toBe(1000);
    fireEvent.click(screen.getByTestId("btn-seek-origin"));
    expect(timeEngine.currentTimeYearsAgo).toBe(EARTH_FORMATION_YEARS_AGO);
    fireEvent.click(screen.getByTestId("btn-seek-modern"));
    expect(timeEngine.currentTimeYearsAgo).toBe(0);
    fireEvent.click(screen.getByTestId("dir-forward"));
  });

  it("validates custom rates and picks the matching mode", () => {
    render(<PlaybackSettings />);
    fireEvent.change(screen.getByTestId("custom-rate"), { target: { value: "-3" } });
    fireEvent.click(screen.getByTestId("apply-custom-rate"));
    expect(screen.getByTestId("playback-error")).toHaveTextContent("自定义倍率");
    expect(timeEngine.getSnapshot().rate).toBe(1);
    fireEvent.change(screen.getByTestId("custom-rate"), { target: { value: "50000" } });
    fireEvent.click(screen.getByTestId("apply-custom-rate"));
    expect(timeEngine.getSnapshot()).toMatchObject({ mode: "deep", rate: 50_000 });
    expect(screen.queryByTestId("playback-error")).toBeNull();
    expect(screen.getByTestId("current-rate")).toHaveAttribute("data-mode", "deep");
  });

  it("computes the rate from a whole-history duration and keeps the time", () => {
    render(<PlaybackSettings />);
    fireEvent.change(screen.getByTestId("target-seconds"), { target: { value: "120" } });
    fireEvent.click(screen.getByTestId("apply-target"));
    expect(timeEngine.getSnapshot().rate).toBeCloseTo(EARTH_FORMATION_YEARS_AGO / 120, 3);
    expect(timeEngine.currentTimeYearsAgo).toBe(1000);
    act(() => {
      fireEvent.change(screen.getByTestId("target-seconds"), { target: { value: "0" } });
      fireEvent.click(screen.getByTestId("apply-target"));
    });
    expect(screen.getByTestId("playback-error")).toHaveTextContent("时长");
  });
});
