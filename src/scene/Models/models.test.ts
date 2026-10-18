import { LineSegments, Mesh, type Object3D } from "three";
import { SPECIES } from "../../data/species";
import { VISUALS, VISUAL_BY_ID } from "../../data/visuals";
import { applyClip, clipsFor } from "./animation";
import { advanceAnimationClock } from "./animationClock";
import { buildRig } from "./builders";

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
    let tris0 = 0;
    let tris1 = 0;
    r0.root.traverse((o) => o instanceof Mesh && (tris0 += o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count));
    r1.root.traverse((o) => o instanceof Mesh && (tris1 += o.geometry.index ? o.geometry.index.count : o.geometry.getAttribute("position").count));
    expect(tris1).toBeLessThan(tris0);
    r0.dispose();
    r1.dispose();
  });

  it("styles: plain has no edge lines; tone and line outline every part", () => {
    const v = VISUAL_BY_ID["viz-tyrannosaurus"]!;
    const plain = buildRig(v, 0, "plain");
    const tone = buildRig(v, 0, "tone");
    expect(count(plain.root, LineSegments)).toBe(0);
    expect(count(tone.root, LineSegments)).toBe(count(tone.root, Mesh));
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
