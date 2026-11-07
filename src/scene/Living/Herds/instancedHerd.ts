import { BackSide, MeshBasicMaterial, type MeshLambertMaterial, type WebGLProgramParametersWithUniforms } from "three";
import type { VisualizationAsset } from "../../../data/schema";
import { INK } from "../../Ink/inkPalette";
import { createToneMaterial, TONE_SHARED } from "../../Ink/toneMaterial";
import type { Style } from "../../Models/rig";

/**
 * 实例档材质（设计 §3）：在网点 / 轮廓材质上加入
 *   - 待机动作（顶点着色器，按 aPart / aH，时钟只随真实时间）；
 *   - 屏幕恒定尺寸（uPx CSS 像素 → 世界尺寸，按实例中心到相机的距离）；
 *   - 背面隐藏与升档隐藏（aHerd.y = 0）：缩放为 0。
 * 场景没有灯光，网点自算光照（沿用 createToneMaterial）。
 */

/** 全部生物群共享：动画时钟（秒）与设备像素比（Herds 每帧写入）。 */
export const HERD_SHARED = { uHerdTime: { value: 0 }, uDpr: { value: 1 } };

/** 每物种一份：屏幕尺寸（CSS px）、模型外形最大尺寸、动作类型。 */
export interface HerdUniforms {
  uPx: { value: number };
  uExtent: { value: number };
  uMotion: { value: number };
}

export function createHerdUniforms(extent: number, motion: number): HerdUniforms {
  return { uPx: { value: 12 }, uExtent: { value: extent }, uMotion: { value: motion } };
}

/** 0 植物 / 固着：弯曲摇摆；1 陆生：起伏 + 转头；2 游泳：摆尾；3 飞行：上下浮动。 */
export function motionKind(asset: VisualizationAsset): number {
  switch (asset.locomotion) {
    case "none":
      return 0;
    case "swim":
      return 2;
    case "fly":
      return 3;
    default:
      return 1;
  }
}

const VERT_PARS = /* glsl */ `
uniform float uHerdTime;
uniform float uDpr;
uniform float uPx;
uniform float uExtent;
uniform float uMotion;
uniform float uViewportH;
attribute vec2 aHerd;
attribute float aPart;
attribute float aH;
`;

const VERT_BODY = /* glsl */ `
#ifdef USE_INSTANCING
vec4 herdC = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#else
vec4 herdC = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
#endif
float herdT = uHerdTime + aHerd.x;
if (uMotion < 0.5) {
  float bend = aH * aH;
  transformed.x += 0.06 * bend * sin(herdT * 1.2);
  transformed.z += 0.04 * bend * sin(herdT * 0.9 + 1.3);
} else if (uMotion < 1.5) {
  transformed.y += 0.015 * sin(herdT * 1.6);
  if (aPart > 0.5 && aPart < 1.5) transformed.x += 0.04 * sin(herdT * 0.4) * step(0.6, sin(herdT * 0.13));
} else if (uMotion < 2.5) {
  float tail = (aPart > 1.5 && aPart < 2.5) ? 1.0 : 0.0;
  transformed.x += (0.02 + 0.08 * tail) * sin(herdT * 3.0 - transformed.z * 2.0);
} else {
  transformed.y += 0.05 * sin(herdT * 1.5);
}
vec3 herdN = normalize(herdC.xyz);
float herdVisible = step(0.05, dot(herdN, normalize(cameraPosition - herdC.xyz))) * aHerd.y;
float herdDist = length((viewMatrix * herdC).xyz);
float herdScale = uPx * uDpr * 2.0 * herdDist / (projectionMatrix[1][1] * uViewportH) / uExtent;
transformed *= herdScale * herdVisible;
`;

function inject(shader: WebGLProgramParametersWithUniforms, u: HerdUniforms, extraPars = "") {
  Object.assign(shader.uniforms, HERD_SHARED, { uViewportH: TONE_SHARED.uViewportH }, u);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>\n${VERT_PARS}${extraPars}`)
    .replace("#include <project_vertex>", `${VERT_BODY}\n#include <project_vertex>`);
}

export function createHerdToneMaterial(style: Style, u: HerdUniforms): MeshLambertMaterial {
  const mat = createToneMaterial({ base: INK.sheet, mode: style, dots: false });
  const inner = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    inner.call(mat, shader, renderer);
    inject(shader, u);
  };
  mat.customProgramCacheKey = () => "herd-tone";
  return mat;
}

/** 轮廓：背面沿烘焙的 aOutDir 外扩固定像素宽，随实例一起隐藏。 */
export function createHerdOutlineMaterial(u: HerdUniforms, px = 1): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({ color: INK.ink, side: BackSide, toneMapped: false });
  const own = { uOutlinePx: { value: px } };
  mat.onBeforeCompile = (shader) => {
    inject(shader, u, "attribute vec3 aOutDir;\nuniform float uOutlinePx;\n");
    Object.assign(shader.uniforms, own);
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      /* glsl */ `#include <project_vertex>
      #ifdef USE_INSTANCING
      vec3 inkDir = normalize((modelViewMatrix * instanceMatrix * vec4(aOutDir, 0.0)).xyz);
      #else
      vec3 inkDir = normalize((modelViewMatrix * vec4(aOutDir, 0.0)).xyz);
      #endif
      float inkW = uOutlinePx * 2.0 * (-mvPosition.z) / (projectionMatrix[1][1] * uViewportH);
      mvPosition.xyz += inkDir * inkW * herdVisible;
      gl_Position = projectionMatrix * mvPosition;`,
    );
  };
  mat.customProgramCacheKey = () => "herd-outline";
  return mat;
}
