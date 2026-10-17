import { MODERN_BASELINE_CE_YEAR } from "../data/schema";

export { MODERN_BASELINE_CE_YEAR };

/**
 * 距今年数 ↔ 公元纪年 / 人类可读时间文本（TASKS 风险 R6）。
 *
 * 现代基准（yearsAgo = 0）定义为公元 2000 年初，常量化集中管理。
 * 传统公元纪年没有公元 0 年：天文年 0 对应公元前 1 年，天文年 -1 对应公元前 2 年。
 * 公元前 / 后只用于较近的时间尺度；更古老的时间用 ka / Ma / Ga 表达。
 * 完整的地质年代名称（宙/代/纪/世）由 Phase 3 的 ICS 年代表提供。
 */

export interface CalendarYear {
  era: "BCE" | "CE";
  /** 正整数，无 0 年。 */
  year: number;
}

/** 天文年（含 0 年）= 基准年 − 距今年数。 */
export function yearsAgoToAstronomicalYear(yearsAgo: number): number {
  return MODERN_BASELINE_CE_YEAR - yearsAgo;
}

export function astronomicalYearToYearsAgo(astronomicalYear: number): number {
  return MODERN_BASELINE_CE_YEAR - astronomicalYear;
}

/** 距今年数所处的公历年（向下取整，无公元 0 年）。 */
export function yearsAgoToCalendarYear(yearsAgo: number): CalendarYear {
  const astro = Math.floor(yearsAgoToAstronomicalYear(yearsAgo));
  return astro >= 1 ? { era: "CE", year: astro } : { era: "BCE", year: 1 - astro };
}

/** 公历年（该年 1 月 1 日）→ 距今年数。year 必须是 ≥ 1 的整数，不存在公元 0 年。 */
export function calendarYearToYearsAgo(cal: CalendarYear): number {
  if (!Number.isInteger(cal.year) || cal.year < 1) {
    throw new RangeError("calendar year must be an integer >= 1 (there is no year 0)");
  }
  const astro = cal.era === "CE" ? cal.year : 1 - cal.year;
  return astronomicalYearToYearsAgo(astro);
}

/** 公元时间文本适用的范围：距今 10,000 年以内（含未来）。 */
const CALENDAR_LIMIT_YEARS_AGO = 10_000;

function trimNumber(n: number, digits: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits });
}

/** 距今年数 → 简短显示文本。 */
export function formatTime(yearsAgo: number): string {
  if (!Number.isFinite(yearsAgo)) return "—";
  if (yearsAgo < -CALENDAR_LIMIT_YEARS_AGO) {
    return `未来 ${trimNumber(-yearsAgo, 0)} 年`;
  }
  if (yearsAgo <= CALENDAR_LIMIT_YEARS_AGO) {
    const { era, year } = yearsAgoToCalendarYear(yearsAgo);
    return era === "CE" ? `公元 ${year} 年` : `公元前 ${year} 年`;
  }
  return formatDeepTime(yearsAgo);
}

/** 深时文本：距今 N ka / Ma / Ga。 */
export function formatDeepTime(yearsAgo: number): string {
  const abs = Math.abs(yearsAgo);
  if (abs >= 1e9) return `距今 ${trimNumber(abs / 1e9, 3)} Ga（十亿年）`;
  if (abs >= 1e6) return `距今 ${trimNumber(abs / 1e6, abs >= 1e8 ? 1 : 2)} Ma（百万年）`;
  return `距今 ${trimNumber(abs / 1e3, 1)} ka（千年）`;
}

/** 时间范围/速率的紧凑展示：1.5 千年、2 百万年等。 */
export function formatYearsSpan(years: number): string {
  const abs = Math.abs(years);
  if (abs >= 1e9) return `${trimNumber(years / 1e9, 2)} 十亿年`;
  if (abs >= 1e6) return `${trimNumber(years / 1e6, 2)} 百万年`;
  if (abs >= 1e3) return `${trimNumber(years / 1e3, 2)} 千年`;
  return `${trimNumber(years, 3)} 年`;
}
