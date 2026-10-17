import { VISUAL_BY_ID } from "../data/visuals";
import { behaviorConfigFor, clipForState, createAgent, seededRandom, stepAgent, updateInterval } from "./BehaviorSystem";
import { pickCreatureSites } from "./creatureSites";

describe("behavior", () => {
  const mammoth = VISUAL_BY_ID["viz-mammoth"]!;

  it("cycles through idle, wander and eat while staying within the roaming radius", () => {
    const cfg = behaviorConfigFor(mammoth, true);
    const rand = seededRandom(1);
    const a = createAgent(rand, cfg.radius);
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 120; i++) {
      stepAgent(a, 1 / 60, cfg, rand);
      seen.add(a.state);
      expect(Math.hypot(a.x, a.z)).toBeLessThanOrEqual(cfg.radius + 1e-9);
    }
    expect(seen).toEqual(new Set(["idle", "wander", "eat"]));
  });

  it("plants and disabled behavior stay idle in place", () => {
    for (const cfg of [behaviorConfigFor(VISUAL_BY_ID["viz-cooksonia"]!, true), behaviorConfigFor(mammoth, false)]) {
      const rand = seededRandom(2);
      const a = createAgent(rand, 10);
      const [x, z] = [a.x, a.z];
      for (let i = 0; i < 600; i++) stepAgent(a, 1 / 60, cfg, rand);
      expect([a.x, a.z, a.state]).toEqual([x, z, "idle"]);
    }
  });

  it("flyers keep moving and never stop to eat", () => {
    const cfg = behaviorConfigFor(VISUAL_BY_ID["viz-pteranodon"]!, true);
    const rand = seededRandom(3);
    const a = createAgent(rand, cfg.radius);
    for (let i = 0; i < 60 * 60; i++) {
      stepAgent(a, 1 / 60, cfg, rand);
      expect(a.state).not.toBe("eat");
    }
  });

  it("maps states to clips and lowers update rates with distance and in low-performance mode", () => {
    expect(clipForState("wander")).toBe("move");
    expect(updateInterval(5, false, false)).toBe(1);
    expect(updateInterval(100, false, false)).toBeGreaterThan(updateInterval(30, false, false));
    expect(updateInterval(100, true, false)).toBeLessThan(updateInterval(100, false, false));
    expect(updateInterval(100, false, true)).toBe(2 * updateInterval(100, false, false));
  });
});

describe("globe creature sites", () => {
  const entries = [
    { speciesId: "a", sites: [[0, 0], [0.5, 0.5], [4, 0], [8, 0]] as [number, number][] },
    { speciesId: "b", sites: [[10, 0]] as [number, number][] },
    { speciesId: "c", sites: [[150, 0]] as [number, number][] },
  ];

  it("shows nothing from far away and picks the nearest sites, at least one per nearby species", () => {
    expect(pickCreatureSites(entries, [0, 0], 2.4, 6)).toEqual([]);
    const picked = pickCreatureSites(entries, [0, 0], 0.5, 3);
    // a@(0,0) 最近；b 保证至少一个；(0.5,0.5) 太近被跳过，取 a@(4,0)
    expect(picked).toEqual([
      { speciesId: "a", lonLat: [0, 0] },
      { speciesId: "b", lonLat: [10, 0] },
      { speciesId: "a", lonLat: [4, 0] },
    ]);
    expect(picked.some((p) => p.speciesId === "c")).toBe(false); // 地球另一侧
  });
});
