import { useMemo } from "react";
import { AdditiveBlending, BackSide, Color, IcosahedronGeometry } from "three";
import { EARTH_RADIUS } from "../../utils/geo";
import { PALETTE } from "../Wireframe/palette";

/** 低多边形地球球体（实体底色，线条由经纬网与轮廓层提供）。 */
export function Globe() {
  // detail 5：边长约 0.034，弦高误差约 1.5e-4，远小于线稿层的抬升高度。
  const geometry = useMemo(() => new IcosahedronGeometry(EARTH_RADIUS, 5), []);
  return (
    <mesh geometry={geometry} name="globe">
      <meshStandardMaterial color={PALETTE.oceanFill} roughness={0.95} metalness={0} flatShading />
    </mesh>
  );
}

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
    gl_FragColor = vec4(uColor, rim * 0.6);
  }
`;

/** 大气边缘光：仅渲染背面，避免遮挡地表线条。 */
export function Atmosphere() {
  const uniforms = useMemo(() => ({ uColor: { value: new Color(PALETTE.atmosphere) } }), []);
  return (
    <mesh scale={1.04} name="atmosphere">
      <sphereGeometry args={[EARTH_RADIUS, 64, 32]} />
      <shaderMaterial
        vertexShader={atmosphereVertex}
        fragmentShader={atmosphereFragment}
        uniforms={uniforms}
        side={BackSide}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}
