import type { LonLat } from "../data/schema";

/**
 * 多边形"融合"：把相邻 / 重叠的陆块多边形合并，只保留外轮廓线。
 *
 * 板块重建的海岸线按板块与地体切成许多多边形，直接描边会在大陆内部留下大量切割线。
 * 这里先把多边形栅格化到经纬度网格（逐行扫描、奇偶规则处理内环），
 * 再用 marching squares 提取陆地 / 海洋分界线并串成折线。经度方向首尾相接。
 * 用于离线数据生成（scripts/fetch-paleogeography.mjs）。
 */

export interface LandGrid {
  width: number;
  height: number;
  resDeg: number;
  /** 行优先，第 0 行在北（纬度 90 - res/2）。1 = 陆地。 */
  cells: Uint8Array;
}

export function rasterizePolygons(polygons: LonLat[][][], resDeg: number): LandGrid {
  const width = Math.round(360 / resDeg);
  const height = Math.round(180 / resDeg);
  const cells = new Uint8Array(width * height);
  const xs: number[] = [];
  for (const rings of polygons) {
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const ring of rings) {
      for (const p of ring) {
        minLat = Math.min(minLat, p[1]);
        maxLat = Math.max(maxLat, p[1]);
      }
    }
    const j0 = Math.max(0, Math.floor((90 - maxLat) / resDeg));
    const j1 = Math.min(height - 1, Math.ceil((90 - minLat) / resDeg));
    for (let j = j0; j <= j1; j++) {
      const lat = 90 - (j + 0.5) * resDeg;
      xs.length = 0;
      for (const ring of rings) {
        for (let k = 0, n = ring.length; k < n; k++) {
          const a = ring[k]!;
          const b = ring[(k + 1) % n]!;
          if (a[1] <= lat !== b[1] <= lat) xs.push(a[0] + ((lat - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil((xs[k]! + 180) / resDeg - 0.5));
        const i1 = Math.min(width - 1, Math.floor((xs[k + 1]! + 180) / resDeg - 0.5));
        for (let i = i0; i <= i1; i++) cells[j * width + i] = 1;
      }
    }
  }
  return { width, height, resDeg, cells };
}

/** 网格分界线（经度首尾相接），返回经纬度折线。 */
export function contourLines(grid: LandGrid): LonLat[][] {
  const { width: W, height: H, resDeg: r, cells } = grid;
  const at = (i: number, j: number) => cells[j * W + (((i % W) + W) % W)]!;
  // 边的编号：水平边 (i,j)-(i+1,j) 与竖直边 (i,j)-(i,j+1)，交点取边中点
  const hId = (i: number, j: number) => (j * W + (((i % W) + W) % W)) * 2;
  const vId = (i: number, j: number) => (j * W + (((i % W) + W) % W)) * 2 + 1;
  const pos = (id: number): LonLat => {
    const cell = id >> 1;
    const i = cell % W;
    const j = Math.floor(cell / W);
    const lon = -180 + (i + 0.5) * r + (id & 1 ? 0 : r / 2);
    const lat = 90 - (j + 0.5) * r - (id & 1 ? r / 2 : 0);
    return [lon > 180 ? lon - 360 : lon, lat];
  };

  const adj = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    (adj.get(a) ?? adj.set(a, []).get(a)!).push(b);
    (adj.get(b) ?? adj.set(b, []).get(b)!).push(a);
  };

  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W; i++) {
      const tl = at(i, j);
      const tr = at(i + 1, j);
      const br = at(i + 1, j + 1);
      const bl = at(i, j + 1);
      const code = tl * 8 + tr * 4 + br * 2 + bl;
      if (code === 0 || code === 15) continue;
      const top = hId(i, j);
      const bottom = hId(i, j + 1);
      const left = vId(i, j);
      const right = vId(i + 1, j);
      switch (code) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(top, right); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, top); break;
        // 鞍点：按陆地连通处理（避免细窄陆桥被切断）
        case 5: link(left, top); link(bottom, right); break;
        case 10: link(top, right); link(left, bottom); break;
      }
    }
  }

  // 串成折线：先从端点（度为 1）开始走开放线，再处理剩余的闭合环
  const visited = new Set<string>();
  const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
  const walk = (start: number): LonLat[] => {
    const line = [start];
    let prev = -1;
    let cur = start;
    for (;;) {
      const next = (adj.get(cur) ?? []).find((n) => n !== prev && !visited.has(key(cur, n)));
      if (next === undefined) break;
      visited.add(key(cur, next));
      line.push(next);
      prev = cur;
      cur = next;
      if (cur === start) break;
    }
    return line.map(pos);
  };
  const lines: LonLat[][] = [];
  for (const [node, ns] of adj) if (ns.length === 1 && !visited.has(key(node, ns[0]!))) lines.push(walk(node));
  for (const [node, ns] of adj) for (const n of ns) if (!visited.has(key(node, n))) lines.push(walk(node));
  return lines.filter((l) => l.length >= 2);
}
