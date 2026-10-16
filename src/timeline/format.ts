/**
 * Phase 1 的最小时间展示：只给出"距今 N 年"。
 * 地质年代 / 公元前后的完整换算由 Phase 2/3 的 CalendarAdapter 负责。
 */
export function formatYearsAgoPlain(yearsAgo: number): string {
  if (yearsAgo === 0) return "现代（距今 0 年）";
  if (yearsAgo < 0) return `未来 ${Math.abs(yearsAgo).toLocaleString("zh-CN")} 年`;
  return `距今 ${yearsAgo.toLocaleString("zh-CN")} 年`;
}
