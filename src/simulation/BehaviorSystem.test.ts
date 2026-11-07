import { VISUAL_BY_ID } from "../data/visuals";
import { behaviorConfigFor, clipForState, createAgent, seededRandom, stepAgent, updateInterval } from "./BehaviorSystem";

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
