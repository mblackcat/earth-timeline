import { act, fireEvent, render, screen } from "@testing-library/react";
import { PlaybackBar } from "./PlaybackBar";
import { bindTimeStore } from "../../state/timeStore";
import { timeEngine } from "../../timeline/runtime";
import { EARTH_FORMATION_YEARS_AGO } from "../../timeline/TimeEngine";

let unbind: () => void;
beforeEach(() => {
  timeEngine.pause();
  timeEngine.setDirection("forward");
  timeEngine.setMode("fine");
  timeEngine.setRate(1);
  timeEngine.seek(1000);
  unbind = bindTimeStore(timeEngine);
});
afterEach(() => unbind());

describe("PlaybackBar", () => {
  it("only offers play/pause and speed", () => {
    render(<PlaybackBar />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("toggles play / pause on the shared engine", () => {
    render(<PlaybackBar />);
    fireEvent.click(screen.getByTestId("btn-play"));
    expect(timeEngine.isPlaying).toBe(true);
    expect(screen.getByTestId("btn-play")).toHaveTextContent("暂停");
    fireEvent.click(screen.getByTestId("btn-play"));
    expect(timeEngine.isPlaying).toBe(false);
    expect(timeEngine.currentTimeYearsAgo).toBeLessThanOrEqual(1000);
  });

  it("restarts from the formation of the Earth when played at the present", () => {
    render(<PlaybackBar />);
    act(() => {
      timeEngine.seek(0);
    });
    fireEvent.click(screen.getByTestId("btn-play"));
    expect(timeEngine.isPlaying).toBe(true);
    expect(timeEngine.currentTimeYearsAgo).toBe(EARTH_FORMATION_YEARS_AGO);
    timeEngine.pause();
  });

  it("speed presets switch mode and rate without moving time", () => {
    render(<PlaybackBar />);
    const select = screen.getByTestId("speed-select");
    expect(select).toHaveValue("1");
    fireEvent.change(select, { target: { value: "1m" } });
    expect(timeEngine.getSnapshot()).toMatchObject({ mode: "deep", rate: 1_000_000, currentTimeYearsAgo: 1000 });
    fireEvent.change(select, { target: { value: "all-60" } });
    expect(timeEngine.getSnapshot().rate).toBeCloseTo(EARTH_FORMATION_YEARS_AGO / 60, 3);
    expect(select).toHaveValue("all-60");
    fireEvent.change(select, { target: { value: "4" } });
    expect(timeEngine.getSnapshot()).toMatchObject({ mode: "fine", rate: 4 });
  });

  it("shows a custom entry when the rate is not a preset", () => {
    render(<PlaybackBar />);
    act(() => {
      timeEngine.setRate(3);
    });
    expect(screen.getByTestId("speed-select")).toHaveValue("custom");
  });
});
