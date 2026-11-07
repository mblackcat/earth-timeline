import { BufferAttribute, Mesh, Vector3, type BufferGeometry, type Object3D } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { VisualizationAsset } from "../../../data/schema";
import { buildRig } from "../../Models/builders";
import type { Style } from "../../Models/rig";

/**
 * 实例档的模型：LOD1 Rig 的静止姿态合并为一个几何体（设计 §3）。
 * 附加属性：aOutDir（轮廓外扩方向，从部件中心指向顶点，与 Rig 的部件级轮廓一致）、
 * aPart（0 主体 / 1 头颈 / 2 尾 / 3 肢翼鳍，着色器待机动作用）、aH（顶点高度 / 体高）。
 * 折边线在 6–12 px 下只是噪点，不烘焙。
 */
export interface BakedSpecies {
  fill: BufferGeometry;
  extent: number;
  height: number;
  /** plain 风格没有轮廓。 */
  outline: boolean;
  dispose(): void;
}

export function partTag(joint: string): 0 | 1 | 2 | 3 {
  if (/^(head|neck|jaw|trunk)/.test(joint)) return 1;
  if (/^tail/.test(joint)) return 2;
  if (/^(leg|arm|wing|flipper|fin|pectoral|flap|tentacle|antenna|grasp)/.test(joint)) return 3;
  return 0;
}

function jointOf(o: Object3D, joints: Record<string, Object3D>): string {
  for (let p: Object3D | null = o.parent; p; p = p.parent) if (p.name && joints[p.name] === p) return p.name;
  return "";
}

export function bakeSpecies(asset: VisualizationAsset, style: Style): BakedSpecies {
  const rig = buildRig(asset, 1, style);
  rig.root.updateMatrixWorld(true);
  const pieces: BufferGeometry[] = [];
  const v = new Vector3();
  const center = new Vector3();
  rig.root.traverse((o) => {
    if (!(o instanceof Mesh) || o.name === "outline") return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    g.applyMatrix4(o.matrixWorld);
    const pos = g.getAttribute("position");
    const n = pos.count;
    center.setFromMatrixPosition(o.matrixWorld);
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i).sub(center);
      if (v.lengthSq() < 1e-12) v.set(0, 1, 0);
      v.normalize().toArray(out, i * 3);
    }
    g.setAttribute("aOutDir", new BufferAttribute(out, 3));
    g.setAttribute("aPart", new BufferAttribute(new Float32Array(n).fill(partTag(jointOf(o, rig.joints))), 1));
    pieces.push(g);
  });
  const fill = mergeGeometries(pieces);
  pieces.forEach((p) => p.dispose());
  if (!fill) throw new Error(`bakeSpecies: cannot merge ${asset.id}`);
  const pos = fill.getAttribute("position");
  const h = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) h[i] = Math.max(0, pos.getY(i)) / rig.height;
  fill.setAttribute("aH", new BufferAttribute(h, 1));
  const { extent, height } = rig;
  rig.dispose();
  return { fill, extent, height, outline: style !== "plain", dispose: () => fill.dispose() };
}
