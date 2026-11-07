import { Vector3, type Camera } from "three";
import { herdModelPx } from "../../../simulation/abundance";
import { lonLatToXYZ } from "../../../utils/geo";
import type { PlacedIndividual } from "./herdRuntime";

export const SURFACE_R = 1.004;
const v = new Vector3();
const n = new Vector3();
const toCam = new Vector3();

/** 个体在屏幕上的中心（客户端坐标，模型脚下向上半个尺寸）与点选半径；背面时为 null。 */
export function projectIndividual(p: PlacedIndividual, camera: Camera, rect: DOMRect, altitude: number): { x: number; y: number; r: number } | null {
  v.set(...lonLatToXYZ(p.lonLat[0], p.lonLat[1], SURFACE_R));
  n.copy(v).normalize();
  if (n.dot(toCam.copy(camera.position).sub(v).normalize()) <= 0.05) return null;
  v.project(camera);
  const px = herdModelPx(p.sizeM, altitude);
  return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height - px / 2, r: Math.max(8, px / 2 + 4) };
}

/** 屏幕上离 (x, y) 最近、在点选半径内的个体；skip 中的键（已升为完整档、实例档中隐藏）跳过。 */
export function pickIndividual(
  x: number,
  y: number,
  camera: Camera,
  rect: DOMRect,
  altitude: number,
  placed: Iterable<PlacedIndividual>,
  skip?: ReadonlySet<string>,
): PlacedIndividual | null {
  let best: PlacedIndividual | null = null;
  let bestD = Infinity;
  for (const p of placed) {
    if (skip?.has(p.key)) continue;
    const s = projectIndividual(p, camera, rect, altitude);
    if (!s) continue;
    const d = Math.hypot(s.x - x, s.y - y);
    if (d <= s.r && d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}
