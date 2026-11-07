import { PerspectiveCamera } from "three";
import { VISUAL_BY_ID } from "../../../data/visuals";
import { pickIndividual, projectIndividual } from "./herdPicking";
import type { PlacedIndividual } from "./herdRuntime";
import { RigPool } from "./rigPool";

const RECT = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;
function camera() {
  const c = new PerspectiveCamera(45, 800 / 600, 0.01, 100);
  c.position.set(0, 0, 3.4); // 注视经纬度 (0, 0)，高度 2.4
  c.lookAt(0, 0, 0);
  c.updateMatrixWorld();
  return c;
}
const placed = (key: string, lonLat: [number, number]): PlacedIndividual => ({ key, speciesId: key, lonLat, sizeM: 2, mobile: true, siteGroup: `${key}#0` });

describe("herd picking", () => {
  it("projects front-side individuals to the screen and hides the far side", () => {
    const c = camera();
    const p = projectIndividual(placed("a", [0, 0]), c, RECT, 2.4)!;
    expect(p.x).toBeCloseTo(400, 0);
    expect(p.y).toBeLessThan(300.5);
    expect(projectIndividual(placed("b", [180, 0]), c, RECT, 2.4)).toBeNull();
  });

  it("picks the nearest individual within its radius", () => {
    const c = camera();
    const list = [placed("a", [0, 0]), placed("b", [5, 0])];
    const a = projectIndividual(list[0]!, c, RECT, 2.4)!;
    expect(pickIndividual(a.x + 2, a.y, c, RECT, 2.4, list)?.key).toBe("a");
    expect(pickIndividual(a.x + 200, a.y + 200, c, RECT, 2.4, list)).toBeNull();
  });
});

describe("RigPool", () => {
  it("reuses released rigs per asset / lod / style and disposes the rest", () => {
    const pool = new RigPool();
    const v = VISUAL_BY_ID["viz-allosaurus"]!;
    const a = pool.acquire(v, 1, "tone");
    a.root.position.y = -0.5;
    pool.release(a, v, 1, "tone");
    const b = pool.acquire(v, 1, "tone");
    expect(b).toBe(a);
    expect(b.root.position.y).toBe(0); // 复位姿态
    expect(pool.acquire(v, 1, "line")).not.toBe(a);
    pool.dispose();
    const c = pool.acquire(v, 1, "tone");
    pool.release(c, v, 1, "tone"); // 池已释放：直接 dispose，不抛错
    expect(pool.size).toBe(0);
  });

  it("reclaims a released rig and reopens after dispose (StrictMode remount)", () => {
    const pool = new RigPool();
    const v = VISUAL_BY_ID["viz-allosaurus"]!;
    const a = pool.acquire(v, 1, "tone");
    pool.release(a, v, 1, "tone");
    pool.reclaim(a, v, 1, "tone");
    expect(pool.size).toBe(0);
    expect(pool.acquire(v, 1, "tone")).not.toBe(a);
    pool.dispose();
    pool.reopen();
    pool.release(a, v, 1, "tone");
    expect(pool.size).toBe(1);
  });
});
