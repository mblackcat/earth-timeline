import type { LonLat } from "../data/schema";
import { seededRandom } from "./BehaviorSystem";
import { isLandAt, type LandGrid } from "./landGrid";
import { buildHerd, herdKey, individualsPerSite, scatterRadiusDeg, type HerdSpeciesInput } from "./scatter";
import { offsetLonLat } from "../utils/geo";

const sp = (o: Partial<HerdSpeciesInput>): HerdSpeciesInput => ({ speciesId: "a", sites: [[0, 0]], siteIndex: [0], perSite: 1, radiusDeg: 0.3, need: "any", ...o });
const VIEW = { center: [0, 0] as LonLat, altitude: 2.4 };
/** 西半球（经度 < 0）为陆地。 */
function westLand(): LandGrid {
  const cells = new Uint8Array(360 * 180);
  for (let j = 0; j < 180; j++) for (let i = 0; i < 180; i++) cells[j * 360 + i] = 1;
  return { width: 360, height: 180, resDeg: 1, cells };
}

describe("herd scatter", () => {
  it("individuals per site follow the abundance tier; plants x3 in the continental view", () => {
    expect([1, 2, 3, 4].map((t) => individualsPerSite(t as 1, false, false))).toEqual([1, 2, 4, 8]);
    expect(individualsPerSite(4, true, true)).toBe(24);
    expect(individualsPerSite(4, false, true)).toBe(8);
    expect(individualsPerSite(2, true, false)).toBe(2);
    expect([1, 2, 3, 4].map((t) => scatterRadiusDeg(t as 1))).toEqual([0.3, 0.6, 0.9, 1.2]);
  });

  it("scatters perSite individuals around a site, the first exactly on it, deterministically", () => {
    const input = [sp({ perSite: 8, radiusDeg: 1.2 })];
    const a = buildHerd(input, VIEW, 2000, null);
    expect(a).toHaveLength(8);
    expect(a[0]).toMatchObject({ k: 0, distDeg: 0, siteIndex: 0 });
    for (const m of a) expect(m.distDeg).toBeLessThanOrEqual(1.2);
    expect(new Set(a.map((m) => m.key)).size).toBe(8);
    expect(buildHerd(input, VIEW, 2000, null)).toEqual(a);
  });

  it("keys carry the site source (fossil by default, GBIF tagged) without moving the scatter", () => {
    expect(herdKey("a", undefined, 3, 1)).toBe("a#f3#1");
    expect(herdKey("a", "fossil", 3, 1)).toBe("a#f3#1");
    expect(herdKey("a", "gbif", 3, 1)).toBe("a#g3#1");
    const input = sp({ perSite: 4, radiusDeg: 0.9 });
    const fossil = buildHerd([input], VIEW, 2000, null);
    const gbif = buildHerd([{ ...input, source: "gbif" }], VIEW, 2000, null);
    expect(fossil.map((m) => m.key)).toEqual(["a#f0#0", "a#f0#1", "a#f0#2", "a#f0#3"]);
    expect(gbif.map((m) => m.key)).toEqual(["a#g0#0", "a#g0#1", "a#g0#2", "a#g0#3"]);
    expect(gbif.map((m) => ({ ...m, key: "" }))).toEqual(fossil.map((m) => ({ ...m, key: "" })));
  });

  it("adding individuals (zooming in) keeps the existing ones in place", () => {
    const four = buildHerd([sp({ perSite: 4, radiusDeg: 0.9 })], VIEW, 2000, null);
    const twelve = buildHerd([sp({ perSite: 12, radiusDeg: 0.9 })], VIEW, 2000, null);
    expect(twelve.slice(0, 4)).toEqual(four);
  });

  it("keeps land life off the sea and marine life off land when the site itself fits", () => {
    const g = westLand();
    const land = buildHerd([sp({ sites: [[-1, 0]], perSite: 8, radiusDeg: 1.2, need: "land" })], VIEW, 2000, g);
    for (const m of land) expect(isLandAt(g, offsetLonLat([-1, 0], m.bearing, m.distDeg))).toBe(true);
    const sea = buildHerd([sp({ sites: [[1, 0]], perSite: 8, radiusDeg: 1.2, need: "water" })], VIEW, 2000, g);
    for (const m of sea) expect(isLandAt(g, offsetLonLat([1, 0], m.bearing, m.distDeg))).toBe(false);
  });

  it("does not check individuals around a site that is itself on the wrong side (coarse coastlines)", () => {
    const g = westLand();
    expect(buildHerd([sp({ sites: [[-1, 0]], perSite: 8, radiusDeg: 1.2, need: "water" })], VIEW, 2000, g)).toHaveLength(8);
  });

  it("respects the cap, keeps at least one site per species and ignores the far side", () => {
    const r = seededRandom(3);
    const many: LonLat[] = Array.from({ length: 500 }, () => [(r() - 0.5) * 100, (r() - 0.5) * 100]);
    const out = buildHerd(
      [sp({ speciesId: "a", sites: many, siteIndex: many.map((_, i) => i), perSite: 8 }), sp({ speciesId: "b", sites: [[30, 0]], perSite: 2 }), sp({ speciesId: "c", sites: [[180, 0]] })],
      VIEW,
      100,
      null,
    );
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out.some((m) => m.speciesId === "b")).toBe(true);
    expect(out.some((m) => m.speciesId === "c")).toBe(false);
  });

  it("cap also bounds the per-species first sites", () => {
    const input = Array.from({ length: 100 }, (_, i) => sp({ speciesId: `s${i}`, perSite: 24 }));
    const out = buildHerd(input, VIEW, 2000, null);
    expect(new Set(out.map((m) => m.speciesId)).size).toBe(100);
    expect(out.length).toBeLessThanOrEqual(2000 + 100);
    // 超出 cap 的部分只可能是"每物种至少 1 个"的最低保证：最多 2000 + 尚未出现的物种数
    expect(out.length).toBe(2016);
  });

  it("small camera moves keep most of the selection", () => {
    const r = seededRandom(5);
    const sites: LonLat[] = Array.from({ length: 400 }, () => [(r() - 0.5) * 120, (r() - 0.5) * 120]);
    const input = [sp({ sites, siteIndex: sites.map((_, i) => i), perSite: 4 })];
    const a = new Set(buildHerd(input, VIEW, 400, null).map((m) => m.key));
    const b = buildHerd(input, { center: [2, 0], altitude: 2.4 }, 400, null).map((m) => m.key);
    const shared = b.filter((k) => a.has(k)).length;
    expect(shared / Math.min(a.size, b.length)).toBeGreaterThan(0.8);
  });
});
