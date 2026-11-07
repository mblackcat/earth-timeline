import { ShaderLib, type Material, type WebGLProgramParametersWithUniforms } from "three";
import { VISUAL_BY_ID } from "../../../data/visuals";
import { createHerdOutlineMaterial, createHerdToneMaterial, createHerdUniforms, HERD_SHARED, herdCapacity, motionKind } from "./instancedHerd";

function compile(mat: Material, lib: "lambert" | "basic") {
  const shader = { vertexShader: ShaderLib[lib].vertexShader, fragmentShader: ShaderLib[lib].fragmentShader, uniforms: {} } as unknown as WebGLProgramParametersWithUniforms;
  mat.onBeforeCompile(shader, undefined as never);
  return shader;
}

describe("herdCapacity", () => {
  it("starts at the next power of two (min 16), keeps capacity when shrinking, doubles when exceeded", () => {
    expect(herdCapacity(0, 1)).toBe(16);
    expect(herdCapacity(0, 16)).toBe(16);
    expect(herdCapacity(0, 17)).toBe(32);
    expect(herdCapacity(0, 300)).toBe(512);
    expect(herdCapacity(64, 20)).toBe(64);
    expect(herdCapacity(64, 64)).toBe(64);
    expect(herdCapacity(64, 65)).toBe(128);
  });
});

describe("instanced herd materials", () => {
  it("motion kinds by locomotion", () => {
    expect(motionKind(VISUAL_BY_ID["viz-ginkgo"]!)).toBe(0);
    expect(motionKind(VISUAL_BY_ID["viz-allosaurus"]!)).toBe(1);
    expect(motionKind(VISUAL_BY_ID["viz-mosasaurus"]!)).toBe(2);
    expect(motionKind(VISUAL_BY_ID["viz-pteranodon"]!)).toBe(3);
  });

  it("tone fill keeps the halftone code and scales vertices before projection", () => {
    const u = createHerdUniforms(1.2, 1);
    const s = compile(createHerdToneMaterial("tone", u), "lambert");
    expect(s.fragmentShader).toMatch(/outgoingLight = inkShade\(/);
    expect(s.vertexShader).toContain("attribute vec2 aHerd;");
    const scaleAt = s.vertexShader.indexOf("transformed *= herdScale");
    expect(scaleAt).toBeGreaterThan(0);
    expect(scaleAt).toBeLessThan(s.vertexShader.indexOf("#include <project_vertex>"));
    expect(s.uniforms.uPx).toBe(u.uPx);
    expect(s.uniforms.uHerdTime).toBe(HERD_SHARED.uHerdTime);
    expect(s.uniforms.uViewportH).toBeDefined();
  });

  it("outline extrudes along the baked direction and hides with the instance", () => {
    const s = compile(createHerdOutlineMaterial(createHerdUniforms(1, 0)), "basic");
    expect(s.vertexShader).toContain("attribute vec3 aOutDir;");
    expect(s.vertexShader).toContain("inkW * herdVisible");
  });

  it("programs are shared between species (uniform-only differences)", () => {
    expect(createHerdToneMaterial("tone", createHerdUniforms(1, 0)).customProgramCacheKey()).toBe(createHerdToneMaterial("line", createHerdUniforms(2, 3)).customProgramCacheKey());
  });
});
