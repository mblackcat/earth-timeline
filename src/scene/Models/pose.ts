import type { Rig } from "./rig";

/** 动画片段共用的关节操作：在静止姿态上叠加偏移。 */

export type Pose = (rig: Rig, t: number, phase: number) => void;

export function rot(rig: Rig, name: string, dx = 0, dy = 0, dz = 0) {
  const j = rig.joints[name];
  const r = rig.rest[name];
  if (!j || !r) return;
  j.rotation.set(r.x + dx, r.y + dy, r.z + dz);
}

export function scale(rig: Rig, name: string, k: number) {
  const j = rig.joints[name];
  const r = rig.rest[name];
  if (j && r) j.scale.setScalar(r.s * k);
}

/** 把所有关节恢复到静止姿态。 */
export function resetPose(rig: Rig) {
  for (const [name, j] of Object.entries(rig.joints)) {
    const r = rig.rest[name]!;
    j.rotation.set(r.x, r.y, r.z);
    j.scale.setScalar(r.s);
  }
}

export const S = Math.sin;
export const breathe = (t: number, rate = 1.6) => 1 + 0.025 * S(t * rate);
