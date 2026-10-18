import { BackSide, Color, MeshBasicMaterial, MeshLambertMaterial, ShaderLib, Texture, type WebGLProgramParametersWithUniforms } from "three";
import { INK } from "./inkPalette";
import { createOutlineMaterial, createToneMaterial, setToneMode, TONE_SHARED } from "./toneMaterial";

/** 用 three 自带的着色器源码模拟一次编译，检查注入点都命中。 */
function compile(mat: MeshLambertMaterial | MeshBasicMaterial, lib: "lambert" | "basic") {
  const shader = {
    vertexShader: ShaderLib[lib].vertexShader,
    fragmentShader: ShaderLib[lib].fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
  mat.onBeforeCompile(shader, undefined as never);
  return shader;
}

describe("createToneMaterial", () => {
  it("is a Lambert material with the base color and the mode uniform", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    expect(m).toBeInstanceOf(MeshLambertMaterial);
    expect(m.color.getHexString()).toBe(new Color(INK.sheet).getHexString());
    expect(m.userData.tone.uToneMode.value).toBe(1);
  });

  it("setToneMode switches the uniform without a new material or program key", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    const key = m.customProgramCacheKey();
    setToneMode(m, "plain");
    expect(m.userData.tone.uToneMode.value).toBe(2);
    setToneMode(m, "line");
    expect(m.userData.tone.uToneMode.value).toBe(0);
    expect(m.customProgramCacheKey()).toBe(key);
  });

  it("injects the halftone code into the real Lambert shader", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    const s = compile(m, "lambert");
    expect(s.fragmentShader).toContain("uniform int uToneMode;");
    expect(s.fragmentShader).toContain("inkHalftone(");
    expect(s.fragmentShader).toMatch(/outgoingLight = inkShade\(/);
    expect(s.vertexShader).toContain("vInkObjPos = position;");
    expect(s.uniforms.uCell).toBe(TONE_SHARED.uCell); // 共享对象，不是副本
    expect(s.uniforms.uToneMode).toBe(m.userData.tone.uToneMode);
  });

  it("every replaced #include matched, and tone mapping is off", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone" });
    const s = compile(m, "lambert");
    expect(s.fragmentShader).toMatch(/outgoingLight = inkShade\([^\n]*\);\n#include <opaque_fragment>/);
    expect(s.vertexShader).toContain("varying vec3 vInkObjPos;");
    expect(m.toneMapped).toBe(false);
  });

  it("land mask: texture enables the mask uniform; null disables it", () => {
    const m = createToneMaterial({ base: INK.paper, mode: "tone", landMask: new Texture() });
    expect(m.userData.tone.uHasMask.value).toBe(1);
    expect(createToneMaterial({ base: INK.paper, mode: "tone" }).userData.tone.uHasMask.value).toBe(0);
  });

  it("dots: false keeps tone mode but disables the screen dots (LOD1)", () => {
    const m = createToneMaterial({ base: INK.sheet, mode: "tone", dots: false });
    expect(m.userData.tone.uDots.value).toBe(0);
  });
});

describe("createOutlineMaterial", () => {
  it("is an ink back-face material that extrudes in screen pixels", () => {
    const m = createOutlineMaterial(2);
    expect(m.side).toBe(BackSide);
    expect(m.color.getHexString()).toBe(new Color(INK.ink).getHexString());
    const s = compile(m, "basic");
    expect(s.vertexShader).toContain("uOutlinePx");
    expect(s.uniforms.uViewportH).toBe(TONE_SHARED.uViewportH);
    expect(s.vertexShader).toMatch(/#include <project_vertex>[\s\S]*inkW/);
    expect(m.toneMapped).toBe(false);
  });
});
