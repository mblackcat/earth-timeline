import { Matrix4, Vector3, type Quaternion } from "three";
import type { LonLat } from "../../../data/schema";

const D = Math.PI / 180;
const m = new Matrix4();
const up = new Vector3();
const east = new Vector3();
const north = new Vector3();
const fwd = new Vector3();
const side = new Vector3();

/**
 * 地表点的模型朝向：局部 +Y → 地表法线，局部 +Z → heading 方向（弧度，0 = 北，π/2 = 东）。
 * 与 herdSim 的 heading / 东北偏移约定一致。东、北向量解析求出，极点附近也不退化。
 */
export function surfaceQuaternion([lon, lat]: LonLat, heading: number, out: Quaternion): Quaternion {
  const l = lon * D;
  const p = lat * D;
  up.set(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l));
  east.set(Math.cos(l), 0, -Math.sin(l));
  north.set(-Math.sin(p) * Math.sin(l), Math.cos(p), -Math.sin(p) * Math.cos(l));
  fwd.copy(east).multiplyScalar(Math.sin(heading)).addScaledVector(north, Math.cos(heading));
  side.crossVectors(up, fwd);
  m.makeBasis(side, up, fwd);
  return out.setFromRotationMatrix(m);
}
