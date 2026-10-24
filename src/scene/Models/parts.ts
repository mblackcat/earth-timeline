import type { Object3D } from "three";
import type { RigBuilder } from "./rig";

/** 各原型构建器共用的形态参数读取与肢体 / 尾巴部件。 */

export type Params = Record<string, number>;
export const p = (params: Params | undefined, key: string, fallback: number) => params?.[key] ?? fallback;

/** 从关节向下（-Y）伸出的肢体段（上粗下细的圆柱），返回该段关节。 */
export function limb(b: RigBuilder, parent: Object3D, name: string, length: number, radius: number, tone: "body" | "accent" = "body") {
  const j = b.joint(name, parent);
  b.part(j, b.cyl(tone), 0, -length / 2, 0, radius * 2, length, radius * 2);
  return j;
}

/** 关节下方的末段肢体（圆柱，下端更细），用于小腿 / 前臂。 */
export function lowerLimb(b: RigBuilder, j: Object3D, length: number, radius: number) {
  b.part(j, b.cyl("body", 0.75), 0, -length / 2, 0, radius * 2, length, radius * 2);
}

/** 向后（-Z）延伸的锥形链（尾巴），返回各节关节。 */
export function tailChain(b: RigBuilder, parent: Object3D, prefix: string, segments: number, length: number, radius: number) {
  const joints: Object3D[] = [];
  let cur = parent;
  const seg = length / segments;
  for (let i = 0; i < segments; i++) {
    const j = b.joint(`${prefix}${i}`, cur, 0, 0, i === 0 ? 0 : -seg);
    const r = radius * (1 - i / segments);
    const m = b.part(j, b.cone(), 0, 0, -seg / 2, r * 2, seg, r * 2);
    m.rotation.x = -Math.PI / 2;
    joints.push(j);
    cur = j;
  }
  return joints;
}
