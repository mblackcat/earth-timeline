// src/scene/Ink/inkPalette.test.ts
import { INK, mixHex } from "./inkPalette";

describe("mixHex", () => {
  it("t = 0 returns a, t = 1 returns b", () => {
    expect(mixHex("#ff0000", "#0000ff", 0)).toBe("#ff0000");
    expect(mixHex("#ff0000", "#0000ff", 1)).toBe("#0000ff");
  });
  it("mixes per channel in sRGB and rounds", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#f9a01b", INK.paper, 0.45)).toBe("#f6c57b");
  });
  it("accepts 3-digit hex", () => {
    expect(mixHex("#fff", "#000", 0)).toBe("#ffffff");
  });
});

describe("INK", () => {
  it("matches the ai-score sheet tokens", () => {
    expect(INK).toMatchObject({ paper: "#f2f3f0", sheet: "#f7f8f5", ink: "#171917", rule: "#c5c8c2", mark: "#9c1c1c" });
  });
});
