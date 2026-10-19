import { DEFAULT_SPEED_ID, SPEED_PRESETS, matchSpeedPreset } from "./speeds";

describe("speed presets", () => {
  const base = { maxYearsAgo: 4_540_000_000, minYearsAgo: 0, smartSeconds: 180 };
  it("defaults to smart ~3 min", () => {
    expect(DEFAULT_SPEED_ID).toBe("smart-180");
    expect(SPEED_PRESETS.find((p) => p.id === DEFAULT_SPEED_ID)).toMatchObject({ mode: "smart", smartSeconds: 180 });
  });
  it("matches smart presets by duration regardless of instantaneous rate", () => {
    expect(matchSpeedPreset({ ...base, mode: "smart", rate: 123.4 })?.id).toBe("smart-180");
    expect(matchSpeedPreset({ ...base, mode: "smart", rate: 1, smartSeconds: 600 })?.id).toBe("smart-600");
    expect(matchSpeedPreset({ ...base, mode: "smart", rate: 1, smartSeconds: 77 })).toBeNull();
  });
  it("still matches fixed presets", () => {
    expect(matchSpeedPreset({ ...base, mode: "deep", rate: 1_000_000 })?.id).toBe("1m");
  });
});
