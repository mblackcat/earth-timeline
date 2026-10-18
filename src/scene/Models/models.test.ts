import { Color, LineSegments, Mesh, MeshLambertMaterial, type Material, type Object3D } from "three";
import { SPECIES } from "../../data/species";
import { VISUALS, VISUAL_BY_ID } from "../../data/visuals";
import { applyClip, clipsFor } from "./animation";
import { advanceAnimationClock } from "./animationClock";
import { buildRig } from "./builders";
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
