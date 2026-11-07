import type { LonLat } from "../data/schema";
import { seededRandom } from "./BehaviorSystem";
import { hashString } from "./hash";
import { agentLonLat, canPrey, createHerdAgent, groupTarget, herdClip, MAX_CHASES, stepHerd, WANDER_RADIUS_DEG, type HerdAgent } from "./herdSim";
import type { HerdTraits } from "./herdTraits";

const T = (o: Partial<HerdTraits>): HerdTraits => ({
  speciesId: "x", diet: "herbivore", sizeM: 2, locomotion: "walk", groups: { land: true, water: false },
  canEat: true, canSleep: true, hominin: false, herds: false, ...o,
});
const agent = (key: string, traits: HerdTraits, home: LonLat = [0, 0]) => createHerdAgent(key, traits, home, `${traits.speciesId}#0`, seededRandom(hashString(key)));
function run(agents: HerdAgent[], seconds: number, enabled = true, seed = 1, each?: () => void) {
  const r = seededRandom(seed);
  for (let t = 0; t < seconds; t += 0.1) {
    stepHerd(agents, 0.1, t, enabled, r);
    each?.();
  }
}

describe("canPrey", () => {
  const pred = T({ speciesId: "allo", diet: "carnivore", sizeM: 9 });
  it("pairs a carnivore with a plausibly sized animal in the same habitat", () => {
    expect(canPrey(pred, T({ speciesId: "steg", sizeM: 8 }))).toBe(true);
    expect(canPrey(T({ speciesId: "fox", diet: "omnivore", sizeM: 0.7 }), T({ speciesId: "m", sizeM: 0.1 }))).toBe(true);
  });
  it("rejects everything else", () => {
    expect(canPrey(T({ diet: "herbivore", speciesId: "h" }), T({ speciesId: "q" }))).toBe(false);
    expect(canPrey(pred, T({ speciesId: "allo" }))).toBe(false); // 同种
    expect(canPrey(pred, T({ speciesId: "u", diet: "unknown" }))).toBe(false);
    expect(canPrey(pred, T({ speciesId: "p", locomotion: "none", diet: "autotroph" }))).toBe(false);
    expect(canPrey(pred, T({ speciesId: "s", groups: { land: false, water: true } }))).toBe(false);
    expect(canPrey(pred, T({ speciesId: "big", sizeM: 22 }))).toBe(false);
    expect(canPrey(pred, T({ speciesId: "tiny", sizeM: 0.5 }))).toBe(false);
    expect(canPrey(pred, T({ speciesId: "h", hominin: true, diet: "omnivore", sizeM: 1.7 }))).toBe(false);
    expect(canPrey(T({ speciesId: "h", hominin: true, diet: "omnivore", sizeM: 1.7 }), T({ speciesId: "deer", sizeM: 2 }))).toBe(false);
    expect(canPrey(T({ speciesId: "d", diet: "unknown" }), T({ speciesId: "q" }))).toBe(false);
  });
});

describe("stepHerd", () => {
  it("a nearby predator chases prey, the chase ends within its time limit and both cool down", () => {
    const pred = agent("p", T({ speciesId: "allo", diet: "carnivore", sizeM: 9 }));
    const prey = agent("q", T({ speciesId: "steg", sizeM: 8 }));
    pred.cooldown = 0;
    prey.cooldown = 0;
    const agents = [pred, prey];
    let started = -1;
    let ended = -1;
    let t = 0;
    run(agents, 80, true, 2, () => {
      t += 0.1;
      if (started < 0 && pred.state === "chase") started = t;
      if (started >= 0 && ended < 0 && pred.state !== "chase") ended = t;
      if (prey.state === "flee") expect(prey.partner).toBe("p");
    });
    expect(started).toBeGreaterThan(0);
    expect(ended).toBeGreaterThan(started);
    expect(ended - started).toBeLessThanOrEqual(8.2);
    expect(agents).toHaveLength(2); // 不表现捕获：猎物不会被移除
  });

  it(`never runs more than ${MAX_CHASES} chases at once`, () => {
    const agents: HerdAgent[] = [];
    for (let i = 0; i < 20; i++) agents.push(agent(`p${i}`, T({ speciesId: "allo", diet: "carnivore", sizeM: 9 })), agent(`q${i}`, T({ speciesId: "steg", sizeM: 8 })));
    for (const a of agents) a.cooldown = 0;
    let max = 0;
    run(agents, 60, true, 3, () => (max = Math.max(max, agents.filter((a) => a.state === "chase").length)));
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(MAX_CHASES);
  });

  it("stationary life never moves or sleeps; disabled behavior keeps everyone idle in place", () => {
    const plant = agent("t", T({ locomotion: "none", canSleep: false, diet: "autotroph" }));
    const walker = agent("w", T({}));
    const before = [plant.e, plant.n, walker.e, walker.n];
    run([plant], 60);
    expect([plant.e, plant.n, plant.state]).toEqual([before[0], before[1], "idle"]);
    run([walker], 30, false);
    expect([walker.e, walker.n, walker.state]).toEqual([before[2], before[3], "idle"]);
  });

  it("walkers sometimes sleep, fliers never; everyone stays near home", () => {
    const walkers = Array.from({ length: 10 }, (_, i) => agent(`w${i}`, T({ speciesId: `w${i}` })));
    const flier = agent("f", T({ locomotion: "fly", canSleep: false, speciesId: "f" }));
    let slept = false;
    let flierSlept = false;
    run([...walkers, flier], 120, true, 4, () => {
      slept ||= walkers.some((w) => w.state === "sleep");
      flierSlept ||= flier.state === "sleep";
    });
    expect(slept).toBe(true);
    expect(flierSlept).toBe(false);
    for (const w of walkers) expect(Math.hypot(w.e, w.n)).toBeLessThanOrEqual(WANDER_RADIUS_DEG.walk * 3 + 1e-9);
  });

  it("herd members share a wander target per 10-second window", () => {
    expect(groupTarget("g#1", 3, 0.15)).toEqual(groupTarget("g#1", 9.9, 0.15));
    expect(groupTarget("g#1", 3, 0.15)).not.toEqual(groupTarget("g#1", 13, 0.15));
    expect(groupTarget("g#1", 3, 0.15)).not.toEqual(groupTarget("g#2", 3, 0.15));
  });

  it("agentLonLat converts local offsets (degrees east / north) around home", () => {
    const a = agent("a", T({}), [10, 60]);
    a.e = 0.5;
    a.n = 0.25;
    const [lon, lat] = agentLonLat(a);
    expect(lat).toBeCloseTo(60.25);
    expect(lon).toBeCloseTo(11); // 0.5 / cos 60°
  });
});

describe("herdClip", () => {
  it("maps states to clips; chase / flee play move faster", () => {
    expect(herdClip("wander")).toEqual({ clip: "move", rate: 1 });
    expect(herdClip("chase")).toEqual({ clip: "move", rate: 1.8 });
    expect(herdClip("flee")).toEqual({ clip: "move", rate: 1.8 });
    expect(herdClip("sleep")).toEqual({ clip: "sleep", rate: 1 });
    expect(herdClip("eat")).toEqual({ clip: "eat", rate: 1 });
    expect(herdClip("idle")).toEqual({ clip: "idle", rate: 1 });
  });
});
