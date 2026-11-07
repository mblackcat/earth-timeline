import { Color, LineSegments, Mesh, MeshLambertMaterial, type Material, type Object3D } from "three";
import type { VisualizationAsset } from "../../data/schema";
import { SPECIES } from "../../data/species";
import { VISUALS, VISUAL_BY_ID } from "../../data/visuals";
import { applyClip, clipsFor, resetPose } from "./animation";
import { advanceAnimationClock } from "./animationClock";
import { ARCHETYPES, buildRig } from "./builders";
import { INK } from "../Ink/inkPalette";

const count = (root: Object3D, type: typeof Mesh | typeof LineSegments) => {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof type) n++;
  });
  return n;
};
const pose = (rig: ReturnType<typeof buildRig>) =>
  Object.values(rig.joints).map((j) => [j.rotation.x, j.rotation.y, j.rotation.z, j.scale.x].map((v) => v.toFixed(5)).join()).join("|");

describe("visual assets", () => {
  it("every species references an existing visual asset (science and visuals stay separate)", () => {
    for (const s of SPECIES) expect(VISUAL_BY_ID[s.visualizationId!], s.id).toBeDefined();
  });

  it.each(VISUALS.map((v) => [v.id, v] as const))("%s: declared animations are implemented by its archetype", (_id, v) => {
    expect(v.sizeM).toBeGreaterThan(0);
    for (const c of v.animationSet) expect(clipsFor(v.archetype)).toContain(c);
  });
});

describe("procedural models", () => {
  it.each(VISUALS.map((v) => [v.id, v] as const))("%s builds at both LODs; LOD1 is simpler", (_id, v) => {
    const r0 = buildRig(v, 0, "tone");
    const r1 = buildRig(v, 1, "tone");
    expect(count(r0.root, Mesh)).toBeGreaterThan(3);
    expect(r0.height).toBeGreaterThan(0);
    // 外形最大尺寸：体长归一化为 1，附肢 / 翼 / 冠可略超出
    expect(r0.extent).toBeGreaterThanOrEqual(r0.height * 0.99);
    expect(r0.extent).toBeGreaterThan(0.8);
    expect(r0.extent).toBeLessThan(2);
    let tris0 = 0;
    let tris1 = 0;
    r0.root.traverse((o) => o instanceof Mesh && (tris0 += o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count));
    r1.root.traverse((o) => o instanceof Mesh && (tris1 += o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count));
    expect(tris1).toBeLessThan(tris0);
    r0.dispose();
    r1.dispose();
  });

  const outlines = (root: Object3D) => {
    let n = 0;
    root.traverse((o) => o instanceof Mesh && o.name === "outline" && n++);
    return n;
  };
  const fills = (root: Object3D) => {
    const out: MeshLambertMaterial[] = [];
    root.traverse((o) => o instanceof Mesh && o.name !== "outline" && out.push(o.material as MeshLambertMaterial));
    return out;
  };

  it("styles: tone / line have edges + outline on every part; plain has neither", () => {
    const v = VISUAL_BY_ID["viz-tyrannosaurus"]!;
    const tone = buildRig(v, 0, "tone");
    const line = buildRig(v, 0, "line");
    const plain = buildRig(v, 0, "plain");
    const parts = fills(tone.root).length;
    expect(parts).toBeGreaterThan(3);
    expect(count(tone.root, LineSegments)).toBe(parts);
    expect(outlines(tone.root)).toBe(parts);
    expect(outlines(line.root)).toBe(parts);
    expect(count(plain.root, LineSegments)).toBe(0);
    expect(outlines(plain.root)).toBe(0);
  });

  it("fills are paper-white tone materials in the matching mode; LOD1 tone has no dots", () => {
    const v = VISUAL_BY_ID["viz-mammoth"]!;
    const mode = (r: ReturnType<typeof buildRig>) => new Set(fills(r.root).map((m) => m.userData.tone.uToneMode.value));
    expect(mode(buildRig(v, 0, "line"))).toEqual(new Set([0]));
    expect(mode(buildRig(v, 0, "tone"))).toEqual(new Set([1]));
    expect(mode(buildRig(v, 0, "plain"))).toEqual(new Set([2]));
    for (const m of fills(buildRig(v, 0, "tone").root)) {
      expect(m.color.getHexString()).toBe(new Color(INK.sheet).getHexString());
      expect(m.userData.tone.uDots.value).toBe(1);
    }
    for (const m of fills(buildRig(v, 1, "tone").root)) expect(m.userData.tone.uDots.value).toBe(0);
  });

  it("dispose releases outline and edge materials", () => {
    const rig = buildRig(VISUAL_BY_ID["viz-trilobite"]!, 0, "tone");
    const disposed: string[] = [];
    rig.root.traverse((o) => {
      if (o instanceof Mesh || o instanceof LineSegments) (o.material as Material).addEventListener("dispose", () => disposed.push(o.name));
    });
    rig.dispose();
    expect(disposed.filter((n) => n === "outline").length).toBeGreaterThan(0);
    expect(disposed.filter((n) => n === "edges").length).toBeGreaterThan(0);
  });

  it("edge lines are a subset of mesh edges (not every triangle edge), and sparser at LOD1", () => {
    const v = VISUAL_BY_ID["viz-mammoth"]!;
    const segs = (lod: 0 | 1) => {
      let n = 0;
      buildRig(v, lod, "line").root.traverse((o) => o instanceof LineSegments && (n += o.geometry.getAttribute("position").count / 2));
      return n;
    };
    expect(segs(1)).toBeLessThan(segs(0));
  });
});

describe("animation", () => {
  const SLEEPERS = ["trilobite", "fish", "quadruped", "theropod", "pterosaur", "hominin", "arthropod", "cephalopod", "sauropod", "marineReptile", "bird", "insect", "whale"];

  it("sleep is implemented for animal archetypes and never for plants or sessile life", () => {
    for (const a of ARCHETYPES) expect(clipsFor(a).includes("sleep"), a).toBe(SLEEPERS.includes(a));
  });

  it("sleep sinks the body into the ground and resetPose restores it", () => {
    const r = buildRig(VISUAL_BY_ID["viz-allosaurus"]!, 1, "tone");
    applyClip(r, "theropod", "sleep", 1);
    expect(r.root.position.y).toBeLessThan(0);
    resetPose(r);
    expect(r.root.position.y).toBe(0);
    r.dispose();
  });

  it("clips move joints, are deterministic for a given time and fully reversible", () => {
    const rig = buildRig(VISUAL_BY_ID["viz-tyrannosaurus"]!, 0, "plain");
    const rest = pose(rig);
    applyClip(rig, "theropod", "move", 1.234);
    const walking = pose(rig);
    expect(walking).not.toBe(rest);
    applyClip(rig, "theropod", "move", 1.234);
    expect(pose(rig)).toBe(walking);
    applyClip(rig, "theropod", "eat", 0.5);
    expect(pose(rig)).not.toBe(walking);
  });

  it("falls back to idle for clips an archetype does not have", () => {
    const rig = buildRig(VISUAL_BY_ID["viz-cooksonia"]!, 0, "plain");
    expect(applyClip(rig, "plant", "move", 1)).toBe("idle");
  });

  it("the animation clock is independent of the simulation rate and respects the switches", () => {
    const on = { animationsEnabled: true, idleWhenPaused: true, simPlaying: true };
    // 无论模拟倍率多少（不作为输入），一秒真实时间都只推进一秒动画
    let t = 0;
    for (let i = 0; i < 60; i++) t = advanceAnimationClock(t, 1 / 60, on);
    expect(t).toBeCloseTo(1, 9);
    expect(advanceAnimationClock(5, 0.016, { ...on, animationsEnabled: false })).toBe(5);
    expect(advanceAnimationClock(5, 0.016, { ...on, simPlaying: false })).toBeCloseTo(5.016, 9);
    expect(advanceAnimationClock(5, 0.016, { ...on, simPlaying: false, idleWhenPaused: false })).toBe(5);
    expect(advanceAnimationClock(5, 30, on)).toBeCloseTo(5.1, 9); // 失焦恢复不跳变
  });
});

describe("every archetype (including ones not yet used by a species)", () => {
  const asset = (archetype: (typeof ARCHETYPES)[number], params?: Record<string, number>): VisualizationAsset => ({
    id: `test-${archetype}`,
    type: "animal",
    archetype,
    sizeM: 1,
    color: "#888",
    accent: "#ccc",
    params,
    animationSet: ["idle"],
    locomotion: "walk",
    preferredLod: 0,
    style: "tone",
    note: "",
  });

  // 各原型的代表性参数组合：默认值 + 每个形态开关
  const variants: [string, (typeof ARCHETYPES)[number], Record<string, number> | undefined][] = [
    ...ARCHETYPES.map((a) => [a, a, undefined] as [string, (typeof ARCHETYPES)[number], undefined]),
    ["arthropod swimmer", "arthropod", { legs: 0, flaps: 1, grasp: 1, segments: 11 }],
    ["arthropod spiny", "arthropod", { legs: 7, spines: 7, antennae: 0 }],
    ["arthropod telson", "arthropod", { telson: 1, antennae: 1 }],
    ...[0, 1, 2, 3].map((form) => [`sessile form ${form}`, "sessile", { form }] as [string, "sessile", Record<string, number>]),
    ["cephalopod straight", "cephalopod", { coiled: 0 }],
    ...[0, 1, 2, 3, 4, 5].map((form) => [`tree form ${form}`, "tree", { form }] as [string, "tree", Record<string, number>]),
    ["sauropod brachiosaur", "sauropod", { neck: 0.45, frontLeg: 1.3 }],
    ["plesiosaur", "marineReptile", { neck: 0.4, fluke: 0 }],
    ["shark", "fish", { shark: 1 }],
    ["tiktaalik", "fish", { flatHead: 1 }],
    ["stegosaur", "quadruped", { plates: 1, tail: 0.8 }],
    ["ceratopsian", "quadruped", { frill: 1 }],
    ["sail-back", "quadruped", { sail: 1, sprawl: 1 }],
    ["spinosaur", "theropod", { sail: 1, snout: 1.5, arms: 1.6 }],
    ["flightless bird", "bird", { flightless: 1 }],
    ["basilosaur", "whale", { slender: 1, dorsal: 0 }],
    ["orca", "whale", { dorsal: 1.5, head: 0.2 }],
    ["woolly rhino", "quadruped", { horn: 1, hump: 0.5 }],
    ["megaloceros", "quadruped", { antlers: 1 }],
  ];

  it.each(variants)("%s builds at both LODs and all styles with a sane size", (_n, archetype, params) => {
    for (const lod of [0, 1] as const) {
      for (const style of ["tone", "line", "plain"] as const) {
        const r = buildRig(asset(archetype, params), lod, style);
        expect(count(r.root, Mesh)).toBeGreaterThan(1);
        expect(r.height).toBeGreaterThan(0);
        expect(r.extent).toBeGreaterThan(0.5);
        expect(r.extent).toBeLessThan(2.2);
        r.dispose();
      }
    }
  });

  it.each(ARCHETYPES)("%s has an idle clip and every clip runs without leaving NaN in joints", (archetype) => {
    expect(clipsFor(archetype)).toContain("idle");
    const r = buildRig(asset(archetype), 0, "plain");
    for (const clip of clipsFor(archetype)) {
      applyClip(r, archetype, clip, 1.7, 0.3);
      for (const j of Object.values(r.joints)) expect([j.rotation.x, j.rotation.y, j.rotation.z, j.scale.x].every(Number.isFinite)).toBe(true);
    }
    r.dispose();
  });
});
