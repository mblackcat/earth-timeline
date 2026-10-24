// 用法：node scripts/fetch-gbif-ranges.mjs
// 从 GBIF（https://www.gbif.org）获取现生类群的现代分布点，生成 public/data/species/gbif-ranges.json。
//
// 处理规则：
//   1. 学名经 species/match 解析为 taxonKey（只接受 EXACT 匹配）；
//   2. 记录数：occurrence/search 计数（有坐标、无地理问题的人类 / 机器观测，1970 年以来）；
//   3. 分布：GBIF 地图接口（v2/map，EPSG:4326，zoom 0 的东西两张 512×512 栅格瓦片，同样的观测类型与年份过滤），
//      有记录的像素即为分布格；比逐页抽样请求少两个数量级，不会触发限流，且覆盖全部记录而不是样本；
//   4. 格点取整到 1° 后去重，每个类群最多 MAX_SITES 个点（按坐标排序后等间隔抽样，结果可复现）。
// 学名表直接读取 src/data/species（GBIF_NAMES）。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { loadTs } from "./load-ts.mjs";

const API = "https://api.gbif.org";
const MAX_SITES = 400;
const OUT = new URL("../public/data/species/gbif-ranges.json", import.meta.url);
// 原始瓦片缓存（不提交）
const cacheDir = new URL("../node_modules/.cache/gbif/", import.meta.url);

const { GBIF_NAMES, SPECIES } = await loadTs("/src/data/species/index.ts");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function request(url, kind, attempt = 1) {
  let wait = 2000 * attempt;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (res.status === 429) wait = 60_000;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return kind === "json" ? await res.json() : Buffer.from(await res.arrayBuffer());
  } catch (err) {
    if (attempt >= 5) throw new Error(`${err.message} ← ${url}`);
    await sleep(wait);
    return request(url, kind, attempt + 1);
  }
}

const filters = () => {
  const q = new URLSearchParams({ year: "1970,2026" });
  for (const b of ["HUMAN_OBSERVATION", "MACHINE_OBSERVATION"]) q.append("basisOfRecord", b);
  return q;
};

/** 最小 PNG 解码：8 位 RGBA、非隔行（GBIF 地图瓦片的格式），返回 alpha 通道。 */
function pngAlpha(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("不是 PNG");
  let off = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("只支持 8 位 RGBA 非隔行 PNG");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = 4;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 0xff;
    }
  }
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) alpha[i] = out[i * bpp + 3];
  return { width, height, alpha };
}

async function tile(key, x) {
  const cacheFile = new URL(`${key}-${x}.png`, cacheDir);
  try {
    return await readFile(cacheFile);
  } catch {
    const q = filters();
    q.set("srs", "EPSG:4326");
    q.set("taxonKey", String(key));
    const png = await request(`${API}/v2/map/occurrence/density/0/${x}/0@1x.png?${q}`, "png");
    await writeFile(cacheFile, png);
    return png;
  }
}

async function ranges(name, sp) {
  // 同名属（如珊瑚 Acropora）用物种数据中的等级、界、纲消歧
  const hints = { rank: sp?.rank?.toUpperCase(), kingdom: sp?.taxonomy?.kingdom, class: sp?.taxonomy?.class };
  const q0 = new URLSearchParams({ name, verbose: "false" });
  for (const [k, v] of Object.entries(hints)) if (v) q0.set(k, v);
  const match = await request(`${API}/v1/species/match?${q0}`, "json");
  if (match.matchType !== "EXACT" || !match.usageKey) throw new Error(`GBIF 无法精确匹配 ${name}（${match.matchType}）`);
  const key = match.usageKey;
  const q = filters();
  q.set("taxonKey", String(key));
  q.set("hasCoordinate", "true");
  q.set("hasGeospatialIssue", "false");
  q.set("occurrenceStatus", "PRESENT");
  q.set("limit", "0");
  const { count } = await request(`${API}/v1/occurrence/search?${q}`, "json");
  // EPSG:4326 zoom 0：x = 0 为西半球（−180°…0°），x = 1 为东半球；每张瓦片覆盖 180° × 180°
  const unique = new Map();
  for (const x of [0, 1]) {
    const { width, height, alpha } = pngAlpha(await tile(key, x));
    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        if (alpha[py * width + px] === 0) continue;
        const lon = -180 + x * 180 + ((px + 0.5) / width) * 180;
        const lat = 90 - ((py + 0.5) / height) * 180;
        const p = [Math.round(lon), Math.round(lat)];
        unique.set(p.join(","), p);
      }
    }
  }
  let sites = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cells = sites.length;
  if (sites.length > MAX_SITES) {
    const step = sites.length / MAX_SITES;
    sites = Array.from({ length: MAX_SITES }, (_, i) => sites[Math.floor(i * step)]);
  }
  return { gbifName: name, taxonKey: key, records: count, cells, sites };
}

await mkdir(cacheDir, { recursive: true });
const species = {};
for (const [id, name] of Object.entries(GBIF_NAMES)) {
  species[id] = await ranges(name, SPECIES.find((s) => s.id === id));
  const s = species[id];
  console.log(`${id.padEnd(26)} key=${String(s.taxonKey).padEnd(9)} records=${String(s.records).padStart(9)} cells=${String(s.cells).padStart(5)} sites=${s.sites.length}`);
}

const file = {
  format: "ett-gbif-ranges/1",
  sourceId: "gbif",
  generated: new Date().toISOString().slice(0, 10),
  note: "GBIF.org 现代观测记录（人类 / 机器观测，1970 年以来）。分布格取自 GBIF 地图接口的全球栅格（约 0.35°），再取整到 1° 去重。观测强度因地区而异，不等于完整分布。",
  species,
};
await writeFile(OUT, JSON.stringify(file) + "\n");
console.log("written", OUT.pathname);
