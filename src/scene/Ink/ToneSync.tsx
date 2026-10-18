import { useFrame } from "@react-three/fiber";
import { TONE_SHARED } from "./toneMaterial";

/** 每个 Canvas 内挂一个：把设备像素比与视口高度写入共享 uniform（网点单元约 4 CSS 像素）。 */
export function ToneSync() {
  useFrame(({ gl, size }) => {
    const dpr = gl.getPixelRatio();
    TONE_SHARED.uCell.value = 4 * dpr;
    TONE_SHARED.uViewportH.value = size.height * dpr;
  });
  return null;
}
