import type { VisualizationAsset } from "../../../data/schema";
import { buildRig } from "../../Models/builders";
import { resetPose } from "../../Models/pose";
import type { Lod, Rig, Style } from "../../Models/rig";

const MAX_FREE_PER_KEY = 16;

/** 完整档的 Rig 对象池：升 / 降档频繁，避免反复构建与释放 GPU 资源。 */
export class RigPool {
  private free = new Map<string, Rig[]>();
  private disposed = false;

  private key(a: VisualizationAsset, lod: Lod, style: Style) {
    return `${a.id}|${lod}|${style}`;
  }

  acquire(a: VisualizationAsset, lod: Lod, style: Style): Rig {
    const r = this.free.get(this.key(a, lod, style))?.pop();
    if (r) {
      resetPose(r);
      return r;
    }
    return buildRig(a, lod, style);
  }

  release(r: Rig, a: VisualizationAsset, lod: Lod, style: Style): void {
    const k = this.key(a, lod, style);
    const list = this.free.get(k) ?? [];
    if (this.disposed || list.length >= MAX_FREE_PER_KEY) {
      r.dispose();
      return;
    }
    list.push(r);
    this.free.set(k, list);
  }

  get size(): number {
    let n = 0;
    for (const l of this.free.values()) n += l.length;
    return n;
  }

  dispose(): void {
    for (const l of this.free.values()) l.forEach((r) => r.dispose());
    this.free.clear();
    this.disposed = true;
  }
}
