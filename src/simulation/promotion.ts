/**
 * 完整档选择：sorted 为按离视野中心距离排好的候选键。
 * 已升档且排名在 keepWithin 以内的保留，其余名额按距离补足，总数不超过 max。
 * 进 max / 出 keepWithin 的滞回避免镜头微动时个体反复切换。
 */
export function choosePromoted(sorted: string[], current: ReadonlySet<string>, max: number, keepWithin: number): Set<string> {
  const out = new Set<string>();
  for (const k of sorted.slice(0, keepWithin)) {
    if (out.size >= max) break;
    if (current.has(k)) out.add(k);
  }
  for (const k of sorted) {
    if (out.size >= max) break;
    out.add(k);
  }
  return out;
}
