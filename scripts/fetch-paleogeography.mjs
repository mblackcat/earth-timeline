// 用法：node scripts/fetch-paleogeography.mjs [--points-only | --coastlines-only]
// 从 GPlates Web Service 获取 CAO2024 板块重建结果，生成：
//   public/data/geography/cao2024/<Ma>.json  重建海岸线（ett-outlines/1，Douglas–Peucker 简化）
//   public/data/geography/cao2024/points.json 化石点与事件位置在各重建年代的古坐标（ett-paleo-points/1）
// 切片、事件、物种定义直接读取 src/ 下的 TypeScript 数据；化石点读取 public/data/species/pbdb-sites.json。
// 模型数据许可：CC BY 4.0（Cao et al. 2024，Zenodo 10.5281/zenodo.11536686）。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadTs } from "./load-ts.mjs";

const GWS = "https://gws.gplates.org";
// 先把多边形融合（栅格 GRID_DEG）去掉大陆内部的板块 / 地体切割线，再简化；
// 精度与现代海岸线（Natural Earth 1:110m）大致相当。
const GRID_DEG = 0.25;
const SIMPLIFY_DEG = 0.3;
const MIN_RING_EXTENT_DEG = 2;
const POINT_CHUNK = 150;
const outDir = new URL("../public/data/geography/cao2024/", import.meta.url);
const pointsOnly = process.argv.includes("--points-only");
const coastlinesOnly = process.argv.includes("--coastlines-only");
// 原始 GeoJSON 缓存（不提交），调整简化参数时无需重新下载。
const cacheDir = new URL("../node_modules/.cache/gws/", import.meta.url);

const { RECONSTRUCTION_SLICES, RECONSTRUCTION_MODEL, RECONSTRUCTION_MAX_MA } = await loadTs("/src/data/geology/reconstruction.ts");
const { EVENTS } = await loadTs("/src/data/events/index.ts");
const { SPECIES } = await loadTs("/src/data/species/index.ts");
const { eventAnchorLonLat, eventWindowYears } = await loadTs("/src/simulation/VisibilityResolver.ts");
const { rasterizePolygons, contourLines } = await loadTs("/src/utils/dissolve.ts");
const sitesFile = JSON.parse(await readFile(new URL("../public/data/species/pbdb-sites.json", import.meta.url), "utf8"));

async function request(url, init, attempt = 1) {
  try {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    if (attempt >= 4) throw new Error(`${url}: ${err.message}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
    return request(url, init, attempt + 1);
  }
}

// ───────────── 海岸线简化 ─────────────

function perpDist(p, a, b) {
  const [x, y] = p;
  const [x1, y1] = a;
  const [x2, y2] = b;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len2));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function douglasPeucker(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

/** 海岸线坐标保留 0.05°（约 5 km，远小于简化容差）；点坐标保留 0.01°。 */
const rCoast = (v) => Math.round(v * 20) / 20;
const r2 = (v) => Math.round(v * 100) / 100;

async function buildCoastlines(ma) {
  if (ma > RECONSTRUCTION_MAX_MA) throw new Error(`${ma} Ma 超出模型范围`);
  const cacheFile = new URL(`${RECONSTRUCTION_MODEL}-coastlines-${ma}.json`, cacheDir);
  let fc;
  try {
    fc = JSON.parse(await readFile(cacheFile, "utf8"));
  } catch {
    fc = await request(`${GWS}/reconstruct/coastlines/?time=${ma}&model=${RECONSTRUCTION_MODEL}`);
    await writeFile(cacheFile, JSON.stringify(fc));
  }
  const polygons = [];
  let rawPoints = 0;
  for (const f of fc.features ?? []) {
    const g = f.geometry;
    const polys = g?.type === "Polygon" ? [g.coordinates] : g?.type === "MultiPolygon" ? g.coordinates : [];
    for (const rings of polys) {
      rawPoints += rings.reduce((n, r) => n + r.length, 0);
      polygons.push(rings);
    }
  }
  const outlines = [];
  for (const line of contourLines(rasterizePolygons(polygons, GRID_DEG))) {
    const lons = line.map((p) => p[0]);
    const lats = line.map((p) => p[1]);
    const extent = Math.max(Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats));
    if (extent < MIN_RING_EXTENT_DEG) continue;
    const simple = douglasPeucker(line, SIMPLIFY_DEG).map(([lon, lat]) => [rCoast(lon), rCoast(lat)]);
    if (simple.length >= 3) outlines.push(simple);
  }
  const file = {
    format: "ett-outlines/1",
    sourceId: "cao-2024",
    note: `GPlates Web Service · ${RECONSTRUCTION_MODEL} · ${ma} Ma 重建海岸线（现今陆块边界旋转后的位置），${GRID_DEG}° 栅格融合去除内部切割线，Douglas–Peucker ${SIMPLIFY_DEG}°，坐标保留 0.05°。`,
    outlines,
  };
  await writeFile(new URL(`${ma}.json`, outDir), JSON.stringify(file) + "\n");
  const kept = outlines.reduce((n, r) => n + r.length, 0);
  console.log(`coastlines ${String(ma).padStart(5)} Ma  rings=${outlines.length}  points ${rawPoints} → ${kept}`);
}

// ───────────── 点旋转 ─────────────

async function reconstructPoints(points, ma) {
  const out = [];
  for (let i = 0; i < points.length; i += POINT_CHUNK) {
    const chunk = points.slice(i, i + POINT_CHUNK);
    const body = new URLSearchParams({
      points: chunk.map(([lon, lat]) => `${lon},${lat}`).join(","),
      time: String(ma),
      model: RECONSTRUCTION_MODEL,
      return_null_points: "",
    });
    const res = await request(`${GWS}/reconstruct/reconstruct_points/`, { method: "POST", body });
    const coords = res.coordinates ?? [];
    if (coords.length !== chunk.length) throw new Error(`点数不一致：${coords.length} ≠ ${chunk.length}`);
    for (const c of coords) {
      const valid = Array.isArray(c) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90;
      out.push(valid ? [r2(c[0]), r2(c[1])] : null);
    }
  }
  return out;
}

const overlaps = (slice, older, younger) => slice.timeRange.fromYearsAgo >= younger && slice.timeRange.toYearsAgo <= older;

await mkdir(outDir, { recursive: true });
await mkdir(cacheDir, { recursive: true });

if (!pointsOnly) {
  for (const slice of RECONSTRUCTION_SLICES) await buildCoastlines(slice.reconstructionMa);
}

if (coastlinesOnly) process.exit(0);

const points = { format: "ett-paleo-points/1", model: RECONSTRUCTION_MODEL, sourceIds: ["cao-2024", "gplates-web-service"], generated: new Date().toISOString().slice(0, 10), species: {}, events: {} };

for (const sp of SPECIES) {
  const sites = sitesFile.species[sp.id]?.sites ?? [];
  if (!sites.length) continue;
  points.species[sp.id] = {};
  for (const slice of RECONSTRUCTION_SLICES) {
    if (!overlaps(slice, sp.time.fromYearsAgo, sp.time.toYearsAgo)) continue;
    const rec = await reconstructPoints(sites, slice.reconstructionMa);
    points.species[sp.id][slice.reconstructionMa] = rec;
    console.log(`species ${sp.id.padEnd(28)} ${String(slice.reconstructionMa).padStart(5)} Ma  ${rec.filter(Boolean).length}/${rec.length}`);
  }
}

for (const ev of EVENTS) {
  const anchor = eventAnchorLonLat(ev);
  if (!anchor) continue;
  const w = eventWindowYears(ev, 0);
  const older = ev.time.fromYearsAgo + (ev.time.uncertaintyYears?.older ?? 0) + w;
  const younger = ev.time.toYearsAgo - (ev.time.uncertaintyYears?.younger ?? 0) - w;
  for (const slice of RECONSTRUCTION_SLICES) {
    if (!overlaps(slice, older, younger)) continue;
    const [p] = await reconstructPoints([anchor], slice.reconstructionMa);
    (points.events[ev.id] ??= {})[slice.reconstructionMa] = p;
    console.log(`event   ${ev.id.padEnd(28)} ${String(slice.reconstructionMa).padStart(5)} Ma  ${JSON.stringify(p)}`);
  }
}

await writeFile(new URL("points.json", outDir), JSON.stringify(points) + "\n");
console.log("done");
