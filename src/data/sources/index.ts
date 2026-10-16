import type { Source } from "../schema";

export const SOURCES: Record<string, Source> = {
  "natural-earth-110m-land": {
    id: "natural-earth-110m-land",
    title: "Natural Earth — 1:110m Physical Vectors, Land",
    publisher: "Natural Earth (naturalearthdata.com)",
    url: "https://www.naturalearthdata.com/downloads/110m-physical-vectors/110m-land/",
    license: "Public domain",
    accessed: "2026-10-16",
    note: "GeoJSON 取自 github.com/nvkelso/natural-earth-vector，坐标四舍五入到 0.01°。",
  },
};

export function getSource(id: string): Source | undefined {
  return SOURCES[id];
}
