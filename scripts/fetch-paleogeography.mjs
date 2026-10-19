// 用法：node scripts/fetch-paleogeography.mjs [--points-only | --coastlines-only]
// 从 GPlates Web Service 获取 CAO2024 板块重建结果，生成：
//   public/data/geography/cao2024/<Ma>.json  重建海岸线（ett-outlines/1，Douglas–Peucker 简化）
//                                             + next：各顶点在下一个更年轻重建年代的位置（板块漂移插值）
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
// 轮廓顶点反算 / 正算的批量大小（POST）
const VERTEX_CHUNK = 1000;
const outDir = new URL("../public/data/geography/cao2024/", import.meta.url);
const pointsOnly = process.argv.includes("--points-only");
const coastlinesOnly = process.argv.includes("--coastlines-only");
// 原始 GeoJSON 缓存（不提交），调整简化参数时无需重新下载。
const cacheDir = new URL("../node_modules/.cache/gws/", import.meta.url);

const { RECONSTRUCTION_SLICES, RECONSTRUCTION_MODEL, RECONSTRUCTION_MAX_MA } = await loadTs("/src/data/geology/reconstruction.ts");
const { fillMissingTargets, rejectInconsistentTargets, rejectStretchedRuns } = await loadTs("/src/simulation/paleoMorph.ts");
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

// ───────────── 板块漂移插值：顶点 tᵢ → 现今 → tᵢ₋₁ ─────────────

async function reconstructBatch(points, ma, reverse) {
  const out = [];
  for (let i = 0; i < points.length; i += VERTEX_CHUNK) {
    const chunk = points.slice(i, i + VERTEX_CHUNK);
    const params = {
      points: chunk.map(([lon, lat]) => `${lon},${lat}`).join(","),
      time: String(ma),
      model: RECONSTRUCTION_MODEL,
      return_null_points: "",
    };
    if (reverse) params.reverse = "";
    const res = await request(`${GWS}/reconstruct/reconstruct_points/`, { method: "POST", body: new URLSearchParams(params) });
    const coords = res.coordinates ?? [];
    if (coords.length !== chunk.length) throw new Error(`点数不一致：${coords.length} ≠ ${chunk.length}`);
    for (const c of coords) out.push(Array.isArray(c) && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90 ? c : null);
  }
  return out;
}

// 目标点必须落在下一切片轮廓附近（容差内）；否则视为板块错配
const TARGET_TOLERANCE_DEG = 3;
const DEG = Math.PI / 180;
const unit = ([lon, lat]) => [Math.cos(lat * DEG) * Math.cos(lon * DEG), Math.cos(lat * DEG) * Math.sin(lon * DEG), Math.sin(lat * DEG)];
const cellKey = (lat, lon) => `${Math.floor(lat)},${((Math.floor(lon) % 360) + 360) % 360}`;

/** 轮廓（按 0.2° 加密）的 1° 网格索引，用于"离轮廓最近距离"查询。 */
function outlineIndex(rings) {
  const grid = new Map();
  for (const r of rings) {
    for (let i = 0; i < r.length; i++) {
      const p = r[i];
      const q = r[i + 1];
      const n = q && Math.abs(q[0] - p[0]) <= 180 ? Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.2)) : 1;
      for (let k = 0; k < n; k++) {
        const pt = q ? [p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n] : p;
        const key = cellKey(pt[1], pt[0]);
        (grid.get(key) ?? grid.set(key, []).get(key)).push(unit(pt));
      }
    }
  }
  return grid;
}

function nearOutline(grid, p, tol) {
  const a = unit(p);
  const cosTol = Math.cos(tol * DEG);
  const span = Math.ceil(tol);
  const lonSpan = Math.min(180, Math.ceil(span / Math.max(0.05, Math.cos(Math.min(89, Math.abs(p[1]) + span) * DEG))));
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -lonSpan; dx <= lonSpan; dx++) {
      for (const b of grid.get(cellKey(p[1] + dy, p[0] + dx)) ?? []) if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] >= cosTol) return true;
    }
  }
  return false;
}

/** 已生成的各年代轮廓（年轻的先生成），用于校验形变目标。 */
const builtOutlines = new Map();

/**
 * 各顶点在 nextMa 的位置。以下目标按无效处理并借用环上最近有效顶点的位移：
 * 无法重建；离下一切片轮廓超过容差；位移与环上邻居不一致；整段一起错配（形变后撕裂的边切出的非最长段）。
 */
async function morphTargets(outlines, ma, nextMa) {
  const flat = outlines.flat();
  const cacheFile = new URL(`${RECONSTRUCTION_MODEL}-morph-${ma}-${nextMa}-${flat.length}.json`, cacheDir);
  let targets;
  try {
    targets = JSON.parse(await readFile(cacheFile, "utf8"));
  } catch {
    const present = await reconstructBatch(flat, ma, true);
    targets = present.slice();
    if (nextMa > 0) {
      const idx = present.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
      const fwd = await reconstructBatch(idx.map((i) => present[i]), nextMa, false);
      targets = present.map(() => null);
      idx.forEach((i, k) => (targets[i] = fwd[k]));
    }
    await writeFile(cacheFile, JSON.stringify(targets));
  }
  const nextIndex = builtOutlines.has(nextMa) ? outlineIndex(builtOutlines.get(nextMa)) : null;
  let k = 0;
  let missing = 0;
  const next = outlines.map((ring) => {
    const raw = ring.map(() => targets[k++]);
    const checked = nextIndex ? raw.map((p) => (p && nearOutline(nextIndex, p, TARGET_TOLERANCE_DEG) ? p : null)) : raw;
    const t = rejectInconsistentTargets(ring, checked);
    // 整段一起错配：形变后撕裂的边把环切开，只保留最长的一段
    const kept = rejectStretchedRuns(ring, fillMissingTargets(ring, t)).map((p, i) => (p && t[i] ? p : null));
    missing += kept.filter((p) => !p).length;
    return fillMissingTargets(ring, kept).map(([lon, lat]) => [rCoast(lon), rCoast(lat)]);
  });
  return { next, missing };
}

async function buildCoastlines(ma, nextMa) {
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
  const { next, missing } = await morphTargets(outlines, ma, nextMa);
  builtOutlines.set(ma, outlines);
  const file = {
    format: "ett-outlines/1",
    sourceId: "cao-2024",
    note: `GPlates Web Service · ${RECONSTRUCTION_MODEL} · ${ma} Ma 重建海岸线（现今陆块边界旋转后的位置），${GRID_DEG}° 栅格融合去除内部切割线，Douglas–Peucker ${SIMPLIFY_DEG}°，坐标保留 0.05°。next 为各顶点经现今位置正算到 ${nextMa} Ma 的位置（板块漂移插值），无法重建、离下一切片轮廓超过 ${TARGET_TOLERANCE_DEG}°、位移与环上邻居不一致或整段撕裂的顶点（板块错配）借用环上最近有效顶点的位移。`,
    outlines,
    nextMa,
    next,
  };
  await writeFile(new URL(`${ma}.json`, outDir), JSON.stringify(file) + "\n");
  const kept = outlines.reduce((n, r) => n + r.length, 0);
  console.log(`coastlines ${String(ma).padStart(5)} Ma → ${String(nextMa).padStart(4)}  rings=${outlines.length}  points ${rawPoints} → ${kept}  morph-missing=${missing}`);
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
  for (const slice of RECONSTRUCTION_SLICES) await buildCoastlines(slice.reconstructionMa, slice.nextReconstructionMa);
}

if (coastlinesOnly) process.exit(0);

const points = { format: "ett-paleo-points/1", model: RECONSTRUCTION_MODEL, sourceIds: ["cao-2024", "gplates-web-service"], generated: new Date().toISOString().slice(0, 10), species: {}, events: {} };

/** 与时间范围重叠的切片需要两端（tᵢ 与 tᵢ₋₁）的古坐标；tᵢ₋₁ = 0 时用现代坐标，不存。 */
function agesFor(older, younger) {
  const ages = new Set();
  for (const slice of RECONSTRUCTION_SLICES) {
    if (!overlaps(slice, older, younger)) continue;
    ages.add(slice.reconstructionMa);
    if (slice.nextReconstructionMa > 0) ages.add(slice.nextReconstructionMa);
  }
  return [...ages].sort((a, b) => a - b);
}

for (const sp of SPECIES) {
  const sites = sitesFile.species[sp.id]?.sites ?? [];
  if (!sites.length) continue;
  points.species[sp.id] = {};
  for (const ma of agesFor(sp.time.fromYearsAgo, sp.time.toYearsAgo)) {
    const rec = await reconstructPoints(sites, ma);
    points.species[sp.id][ma] = rec;
    console.log(`species ${sp.id.padEnd(28)} ${String(ma).padStart(5)} Ma  ${rec.filter(Boolean).length}/${rec.length}`);
  }
}

for (const ev of EVENTS) {
  const anchor = eventAnchorLonLat(ev);
  if (!anchor) continue;
  const w = eventWindowYears(ev, 0);
  const older = ev.time.fromYearsAgo + (ev.time.uncertaintyYears?.older ?? 0) + w;
  const younger = ev.time.toYearsAgo - (ev.time.uncertaintyYears?.younger ?? 0) - w;
  for (const ma of agesFor(older, younger)) {
    const [p] = await reconstructPoints([anchor], ma);
    (points.events[ev.id] ??= {})[ma] = p;
    console.log(`event   ${ev.id.padEnd(28)} ${String(ma).padStart(5)} Ma  ${JSON.stringify(p)}`);
  }
}

await writeFile(new URL("points.json", outDir), JSON.stringify(points) + "\n");
console.log("done");
