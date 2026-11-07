import type { VisualizationAsset } from "../../../data/schema";
import { buildRig } from "../../Models/builders";
import { resetPose } from "../../Models/pose";
import type { Lod, Rig, Style } from "../../Models/rig";

const MAX_FREE_PER_KEY = 16;

/** 完整档的 Rig 对象池：升 / 降档频繁，避免反复构建与释放 GPU 资源。 */
interface FreeList {
  lod: Lod;
  style: Style;
  rigs: Rig[];
}

export class RigPool {
  private free = new Map<string, FreeList>();
  private disposed = false;

  private key(a: VisualizationAsset, lod: Lod, style: Style) {
    return `${a.id}|${lod}|${style}`;
  }

  acquire(a: VisualizationAsset, lod: Lod, style: Style): Rig {
    const r = this.free.get(this.key(a, lod, style))?.rigs.pop();
    if (r) {
      resetPose(r);
      return r;
    }
    return buildRig(a, lod, style);
  }

  release(r: Rig, a: VisualizationAsset, lod: Lod, style: Style): void {
    const k = this.key(a, lod, style);
    const list = this.free.get(k) ?? { lod, style, rigs: [] };
    if (this.disposed || list.rigs.length >= MAX_FREE_PER_KEY) {
      r.dispose();
      return;
    }
    list.rigs.push(r);
    this.free.set(k, list);
  }

  /**
   * 取回刚 release 但仍在使用的 rig（开发模式 StrictMode 会先模拟卸载再重新挂载，
   * 重放的 effect 用它撤销那次 release，避免同一 rig 被另一个个体复用）。
   */
  reclaim(r: Rig, a: VisualizationAsset, lod: Lod, style: Style): void {
    const list = this.free.get(this.key(a, lod, style))?.rigs;
    const i = list ? list.indexOf(r) : -1;
    if (i >= 0) list!.splice(i, 1);
  }

  /** 释放 keep 不保留的 LOD / 风格的空闲 rig（切换风格或细节后旧的不会再被取用）。 */
  prune(keep: (lod: Lod, style: Style) => boolean): void {
    for (const [k, l] of this.free) {
      if (keep(l.lod, l.style)) continue;
      l.rigs.forEach((r) => r.dispose());
      this.free.delete(k);
    }
  }

  get size(): number {
    let n = 0;
    for (const l of this.free.values()) n += l.rigs.length;
    return n;
  }

  dispose(): void {
    for (const l of this.free.values()) l.rigs.forEach((r) => r.dispose());
    this.free.clear();
    this.disposed = true;
  }

  /** dispose 后重新启用（StrictMode 重新挂载）。 */
  reopen(): void {
    this.disposed = false;
  }
}
