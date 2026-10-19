import { EVENTS, eventAnchorYearsAgo } from "../data/events";
import { GEO_UNITS } from "../data/geology/timescale";
import { SPECIES } from "../data/species";
import type { PacingAnchor } from "../timeline/pacing";

/** 智能倍速的放慢权重：事件 > 物种出现 / 灭绝 > 纪的边界。 */
export const PACING_WEIGHTS = { event: 1, species: 0.6, period: 0.4 } as const;

/**
 * 纪的边界只取显生宙：元古宙的成冰纪以前多为年代地层划分（整数年龄），
 * 不代表内容变化，计入会让前寒武纪整体放慢。
 * 古地理切片不计入：切片只是重建的采样年代，漂移在切片之间是连续的。
 */
const PHANEROZOIC_YEARS_AGO = 538_800_000;

/** 从数据收集智能倍速的峰值锚点。新增事件 / 物种会自动影响节奏。 */
export function collectPacingAnchors(): PacingAnchor[] {
  const out: PacingAnchor[] = [];
  for (const e of EVENTS) out.push({ yearsAgo: eventAnchorYearsAgo(e), weight: PACING_WEIGHTS.event });
  for (const s of SPECIES) {
    out.push({ yearsAgo: s.time.fromYearsAgo, weight: PACING_WEIGHTS.species });
    // 现生物种的 toYearsAgo = 0，"现在"已经有事件锚点
    if (s.time.toYearsAgo > 0) out.push({ yearsAgo: s.time.toYearsAgo, weight: PACING_WEIGHTS.species });
  }
  for (const p of GEO_UNITS.period) {
    const t = p.range.toYearsAgo;
    if (t > 0 && t <= PHANEROZOIC_YEARS_AGO) out.push({ yearsAgo: t, weight: PACING_WEIGHTS.period });
  }
  return out;
}
