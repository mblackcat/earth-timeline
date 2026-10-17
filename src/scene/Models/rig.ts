import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type Material,
} from "three";

/**
 * 程序化低多边形模型的基础设施：关节层级、部件、渲染风格。
 * 纯 Three.js，不依赖 React，可在测试中构建与检查。
 */

export type Lod = 0 | 1;
export type Style = "wireframe" | "solid" | "hybrid";

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
  /** "body" 用主体色，"accent" 用强调色。 */
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

  finish(style: Style, color: string, accent: string, height: number): Rig {
    applyStyle(this.parts, style, color, accent, this.lod);
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
const EDGE_THRESHOLD_DEG: Record<Style, Record<Lod, number>> = {
  wireframe: { 0: 20, 1: 40 },
  hybrid: { 0: 28, 1: 50 },
  solid: { 0: 90, 1: 90 },
};
const FILL_DARK = "#0b111c";

function applyStyle(parts: { mesh: Mesh; tone: PartSpec["tone"] }[], style: Style, color: string, accent: string, lod: Lod) {
  for (const { mesh, tone } of parts) {
    const base = new Color(tone === "body" ? color : accent);
    // 填充：实体 / 混合用固有色；线稿用深色填充，只遮挡背面线条
    const fill = new MeshStandardMaterial({
      color: style === "wireframe" ? new Color(FILL_DARK) : base,
      flatShading: true,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    mesh.material = fill;
    if (style === "solid") continue;
    // 线稿：明亮的强调色线条（深色背景下可辨认）；混合：固有色压暗的轮廓
    const lineColor = style === "wireframe" ? base.clone().lerp(new Color("#ffffff"), 0.55) : base.clone().multiplyScalar(0.45);
    const edges = new LineSegments(
      new EdgesGeometry(mesh.geometry, EDGE_THRESHOLD_DEG[style][lod]),
      new LineBasicMaterial({ color: lineColor }),
    );
    edges.name = "edges";
    edges.raycast = () => {};
    mesh.add(edges);
  }
}
