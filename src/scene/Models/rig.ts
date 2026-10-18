import {
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  Object3D,
  type Material,
} from "three";
import { INK } from "../Ink/inkPalette";
import { createOutlineMaterial, createToneMaterial } from "../Ink/toneMaterial";

/**
 * 程序化低多边形模型的基础设施：关节层级、部件、渲染风格。
 * 纯 Three.js，不依赖 React，可在测试中构建与检查。
 */

export type Lod = 0 | 1;
export type Style = "line" | "tone" | "plain";

/** 模型：根节点 + 具名关节（动画只旋转 / 缩放关节）+ 关节的静止姿态。 */
export interface Rig {
  root: Group;
  joints: Record<string, Object3D>;
  rest: Record<string, { x: number; y: number; z: number; s: number }>;
  /** 模型高度（局部单位，体长归一化为 1），用于在地球上按屏幕尺寸缩放。 */
  height: number;
  dispose(): void;
}

export interface PartSpec {
  geometry: BufferGeometry;
  /** 部件角色（主体 / 强调）。墨线风格下两者同为白纸底，保留以便以后区分。 */
  tone: "body" | "accent";
}

/** 建模上下文：收集部件与关节，最后统一套用风格。 */
export class RigBuilder {
  readonly root = new Group();
  readonly joints: Record<string, Object3D> = {};
  private readonly parts: { mesh: Mesh; tone: PartSpec["tone"] }[] = [];

  constructor(readonly lod: Lod) {}

  joint(name: string, parent: Object3D, x = 0, y = 0, z = 0): Object3D {
    const j = new Group();
    j.name = name;
    j.position.set(x, y, z);
    parent.add(j);
    this.joints[name] = j;
    return j;
  }

  part(parent: Object3D, spec: PartSpec, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): Mesh {
    const mesh = new Mesh(spec.geometry);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    this.parts.push({ mesh, tone: spec.tone });
    return mesh;
  }

  /** 低多边形椭球（LOD0 细分 1 级，LOD1 不细分）。 */
  blob(tone: PartSpec["tone"] = "body"): PartSpec {
    return { geometry: new IcosahedronGeometry(0.5, this.lod === 0 ? 1 : 0), tone };
  }

  box(tone: PartSpec["tone"] = "body"): PartSpec {
    return { geometry: new BoxGeometry(1, 1, 1), tone };
  }

  /** 上粗下细的圆柱（轴向 Y），用于四肢。bottomRatio 为下端半径 / 上端半径。 */
  cyl(tone: PartSpec["tone"] = "body", bottomRatio = 0.7): PartSpec {
    return { geometry: new CylinderGeometry(0.5, 0.5 * bottomRatio, 1, this.lod === 0 ? 6 : 4), tone };
  }

  /** 锥形（尖端朝 +Y），用于尾巴、角、鳍。 */
  cone(tone: PartSpec["tone"] = "body", segments?: number): PartSpec {
    return { geometry: new ConeGeometry(0.5, 1, segments ?? (this.lod === 0 ? 6 : 4)), tone };
  }

  finish(style: Style, height: number): Rig {
    applyStyle(this.parts, style, this.lod);
    const rest: Rig["rest"] = {};
    for (const [name, j] of Object.entries(this.joints)) rest[name] = { x: j.rotation.x, y: j.rotation.y, z: j.rotation.z, s: j.scale.x };
    const root = this.root;
    return {
      root,
      joints: this.joints,
      rest,
      height,
      dispose() {
        root.traverse((o) => {
          if (o instanceof Mesh || o instanceof LineSegments) {
            o.geometry.dispose();
            const m = o.material as Material | Material[];
            if (Array.isArray(m)) m.forEach((x) => x.dispose());
            else m.dispose();
          }
        });
      },
    };
  }
}

/** 折边阈值：LOD0 显示适度的内部边线，LOD1 只保留明显轮廓（PLAN §6.3）。 */
const EDGE_THRESHOLD_DEG: Record<Lod, number> = { 0: 28, 1: 50 };
/** 外轮廓宽度（屏幕像素）。 */
const OUTLINE_PX: Record<Lod, number> = { 0: 1.5, 1: 1 };

/**
 * 墨线 + 网点：填充一律白纸底（不用物种色），tone 档叠网点，plain 档平滑灰阶；
 * line / tone 档加折边线与背面外扩的外轮廓。LOD1 在地球上只有图标大小，不画网点。
 */
function applyStyle(parts: { mesh: Mesh }[], style: Style, lod: Lod) {
  for (const { mesh } of parts) {
    mesh.material = createToneMaterial({ base: INK.sheet, mode: style, dots: lod === 0 });
    if (style === "plain") continue;
    const edges = new LineSegments(new EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_DEG[lod]), new LineBasicMaterial({ color: INK.ink, toneMapped: false }));
    edges.name = "edges";
    edges.raycast = () => {};
    mesh.add(edges);
    // 外轮廓与部件共用几何体（dispose 重复调用无害）
    const outline = new Mesh(mesh.geometry, createOutlineMaterial(OUTLINE_PX[lod]));
    outline.name = "outline";
    outline.raycast = () => {};
    mesh.add(outline);
  }
}
