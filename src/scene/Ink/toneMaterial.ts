import { BackSide, Color, MeshBasicMaterial, MeshLambertMaterial, Vector3, type Texture } from "three";
import { INK } from "./inkPalette";

/**
 * 漫画网点材质：在 Lambert 材质上注入屏幕空间网点。
 *   line：只输出底色；tone：网点 + 涂黑；plain：平滑灰阶。
 * 光源固定在视空间左上方，任何视角下都是"左上亮、右下网点渐密、边缘涂黑"。
 */
export type ToneMode = "line" | "tone" | "plain";
const MODE_INDEX: Record<ToneMode, number> = { line: 0, tone: 1, plain: 2 };

/** 所有网点 / 轮廓材质共享的 uniform（由 ToneSync 每帧写入 dpr 与视口高度）。 */
export const TONE_SHARED = {
  uCell: { value: 4 },
  uViewportH: { value: 800 },
  uInk: { value: new Color(INK.ink) },
  uLightDir: { value: new Vector3(-0.55, 0.6, 0.58).normalize() },
};

export interface ToneOptions {
  base: string;
  mode: ToneMode;
  /** 陆地遮罩（等距圆柱，白 = 陆地）。只有地球使用。 */
  landMask?: Texture | null;
  /** 陆地底色（默认 sheet）。 */
  land?: string;
  /** false：tone 档也不画网点（LOD1 小模型，避免噪点）。 */
  dots?: boolean;
}

const VERT_PARS = /* glsl */ `
varying vec3 vInkObjPos;
`;

const FRAG_PARS = /* glsl */ `
uniform int uToneMode;
uniform float uCell;
uniform float uDots;
uniform vec3 uInk;
uniform vec3 uLightDir;
uniform vec3 uLand;
uniform float uHasMask;
uniform sampler2D uLandMask;
varying vec3 vInkObjPos;

// 暗度超过该阈值的海洋 / 模型区域直接涂成实心墨色
const float INK_SOLID = 0.86;

// 屏幕空间 45° 网点：返回该片元的墨量（0 = 纸，1 = 墨）
float inkHalftone(float d) {
  vec2 p = gl_FragCoord.xy / uCell;
  p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  vec2 f = fract(p) - 0.5;
  float r = sqrt(clamp(d, 0.0, 1.0)) * 0.72;
  float dist = length(f);
  float aa = max(fwidth(dist), 1e-3);
  // 半径为 0 时抗锯齿带仍会在格心留下小点：暗度极低时渐隐，避免出现硬边界
  return (1.0 - smoothstep(r - aa, r + aa, dist)) * smoothstep(0.0, 0.06, d);
}

vec3 inkShade(vec3 base, vec3 n) {
  float lit = clamp(dot(n, uLightDir), 0.0, 1.0);
  // 暗度 0.15–1.0：亮侧仍有细网点，海洋才能与纸白的陆地区分
  float d = 0.15 + 0.85 * (1.0 - lit);
  float land = 0.0;
  if (uHasMask > 0.5) {
    vec3 q = normalize(vInkObjPos);
    vec2 uv = vec2(atan(q.x, q.z) / (2.0 * PI) + 0.5, asin(clamp(q.y, -1.0, 1.0)) / PI + 0.5);
    land = step(0.5, texture2D(uLandMask, uv).r);
    base = mix(base, uLand, land);
  }
  if (uToneMode == 0) return base;
  if (uToneMode == 2) return mix(base, uInk, d * mix(0.55, 0.25, land));
  // tone：陆地只在背光侧叠很淡的网点；海洋网点 + 边缘涂黑
  float dl = land > 0.5 ? max(0.0, d - 0.55) * 0.5 : d;
  // 导数（fwidth）放在分支之外，避免非一致控制流
  float ink = inkHalftone(dl) * uDots;
  if (land < 0.5 && d > INK_SOLID) return uInk;
  return mix(base, uInk, ink);
}
`;

export function createToneMaterial({ base, mode, landMask = null, land = INK.sheet, dots = true }: ToneOptions): MeshLambertMaterial {
  const mat = new MeshLambertMaterial({
    color: base,
    flatShading: true,
    toneMapped: false, // 渲染器色调映射会改变纸 / 墨色
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const own = {
    uToneMode: { value: MODE_INDEX[mode] },
    uDots: { value: dots ? 1 : 0 },
    uLand: { value: new Color(land) },
    uHasMask: { value: landMask ? 1 : 0 },
    uLandMask: { value: landMask as Texture | null },
  };
  mat.userData.tone = own;
  // 光照在着色器内自算（固定视空间方向），场景灯光被忽略 → 光跟随相机
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, TONE_SHARED, own);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_PARS}`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvInkObjPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_PARS}`)
      .replace("#include <opaque_fragment>", "outgoingLight = inkShade(diffuseColor.rgb, normal);\n#include <opaque_fragment>");
  };
  mat.customProgramCacheKey = () => "ink-tone";
  return mat;
}

/** 热切换风格：只改 uniform，不重建材质 / 程序。 */
export function setToneMode(mat: MeshLambertMaterial, mode: ToneMode) {
  (mat.userData.tone as { uToneMode: { value: number } }).uToneMode.value = MODE_INDEX[mode];
}

/** 更换陆地遮罩（null：退化为全部海洋网点）。 */
export function setToneLandMask(mat: MeshLambertMaterial, mask: Texture | null) {
  const tone = mat.userData.tone as { uLandMask: { value: Texture | null }; uHasMask: { value: number } };
  tone.uLandMask.value = mask;
  tone.uHasMask.value = mask ? 1 : 0;
}

/** 外轮廓：背面外扩固定像素宽（与距离无关），墨色。 */
export function createOutlineMaterial(px = 1.5): MeshBasicMaterial {
  const mat = new MeshBasicMaterial({ color: INK.ink, side: BackSide, toneMapped: false });
  const own = { uOutlinePx: { value: px } };
  mat.userData.outline = own;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, { uViewportH: TONE_SHARED.uViewportH }, own);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uOutlinePx;\nuniform float uViewportH;")
      .replace(
        "#include <project_vertex>",
        /* glsl */ `#include <project_vertex>
        vec3 inkDir = normalize(normalMatrix * (position / max(length(position), 1e-6)));
        float inkW = uOutlinePx * 2.0 * (-mvPosition.z) / (projectionMatrix[1][1] * uViewportH);
        mvPosition.xyz += inkDir * inkW;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => "ink-outline";
  return mat;
}
