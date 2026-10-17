// 用法：node scripts/fetch-pbdb-sites.mjs
// 从 Paleobiology Database（CC BY 4.0）获取代表性生物的化石点，生成 public/data/species/pbdb-sites.json。
//
// 处理规则（与 src/data/species/index.ts 的说明一致）：
//   1. 只保留年代中值（(eag + lag) / 2）落在该物种展示年代范围内的记录，剔除误归类的离群记录；
//   2. 坐标四舍五入到 0.5° 后去重（化石点为现代经纬度）；
//   3. 每个物种最多保留 MAX_SITES 个点（按坐标排序后等间隔抽样，结果可复现）。
// 年代范围直接读取 src/data/species/index.ts；species.test.ts 校验生成文件与物种数据一致。
import { writeFile } from "node:fs/promises";
import { loadTs } from "./load-ts.mjs";

const MAX_SITES = 400;
const OUT = new URL("../public/data/species/pbdb-sites.json", import.meta.url);

const { SPECIES, PBDB_NAMES } = await loadTs("/src/data/species/index.ts");
/** id → [PBDB 名称, fromMa, toMa]（直接取自物种数据，避免两处维护） */
const TAXA = Object.fromEntries(
  SPECIES.map((s) => [s.id, [PBDB_NAMES[s.id], s.time.fromYearsAgo / 1e6, s.time.toYearsAgo / 1e6]]),
);

const round = (v) => Math.round(v * 2) / 2;

async function fetchTaxon(name) {
  const url = "https://paleobiodb.org/data1.2/occs/list.json?" + new URLSearchParams({ base_name: name, show: "coords", limit: "all" });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`PBDB ${res.status} for ${name}`);
  const body = await res.json();
  return body.records ?? [];
}

const species = {};
for (const [id, [name, fromMa, toMa]] of Object.entries(TAXA)) {
  const records = await fetchTaxon(name);
  const inRange = records.filter((r) => {
    if (r.eag == null || r.lag == null || r.lng == null || r.lat == null) return false;
    const mid = (r.eag + r.lag) / 2;
    return mid <= fromMa && mid >= toMa;
  });
  const unique = new Map();
  for (const r of inRange) {
    const p = [round(Number(r.lng)), round(Number(r.lat))];
    unique.set(p.join(","), p);
  }
  let sites = [...unique.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sites.length > MAX_SITES) {
    const step = sites.length / MAX_SITES;
    sites = Array.from({ length: MAX_SITES }, (_, i) => sites[Math.floor(i * step)]);
  }
  species[id] = { pbdbName: name, filterMa: [fromMa, toMa], occurrences: inRange.length, sites };
  console.log(`${id.padEnd(28)} records=${String(records.length).padStart(6)} inRange=${String(inRange.length).padStart(6)} sites=${sites.length}`);
}

const file = {
  format: "ett-fossil-sites/1",
  sourceId: "pbdb",
  generated: new Date().toISOString().slice(0, 10),
  note: "Paleobiology Database 化石记录（CC BY 4.0）。现代经纬度，0.5° 去重；按物种展示年代范围过滤。",
  species,
};
await writeFile(OUT, JSON.stringify(file) + "\n");
console.log("written", OUT.pathname);
