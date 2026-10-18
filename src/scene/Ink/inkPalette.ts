// src/scene/Ink/inkPalette.ts
/** 纸面墨线色板（与 ai-score 的设计变量一致）。场景与界面统一从这里取色。 */
export const INK = {
  desk: "#c5c7c3",
  paper: "#f2f3f0",
  sheet: "#f7f8f5",
  ink: "#171917",
  ink2: "#5c615c",
  ink3: "#8e938d",
  rule: "#c5c8c2",
  mark: "#9c1c1c",
} as const;

function parse(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** sRGB 逐通道线性混合：t = 0 → a，t = 1 → b。用于"淡彩"（与纸色混合）。 */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parse(a);
  const pb = parse(b);
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
