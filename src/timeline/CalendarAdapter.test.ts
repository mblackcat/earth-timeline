import {
  formatTimeRange,
  astronomicalYearToYearsAgo,
  calendarYearToYearsAgo,
  formatDeepTime,
  formatTime,
  yearsAgoToCalendarYear,
} from "./CalendarAdapter";

describe("CalendarAdapter", () => {
  it("has no year 0: 1 BCE is directly followed by 1 CE", () => {
    expect(yearsAgoToCalendarYear(2000)).toEqual({ era: "BCE", year: 1 });
    expect(yearsAgoToCalendarYear(1999)).toEqual({ era: "CE", year: 1 });
    expect(yearsAgoToCalendarYear(2001)).toEqual({ era: "BCE", year: 2 });
    expect(yearsAgoToCalendarYear(0)).toEqual({ era: "CE", year: 2000 });
  });

  it("round-trips calendar years", () => {
    for (const cal of [
      { era: "BCE", year: 1 },
      { era: "CE", year: 1 },
      { era: "BCE", year: 44 },
      { era: "CE", year: 1969 },
      { era: "BCE", year: 5000 },
    ] as const) {
      expect(yearsAgoToCalendarYear(calendarYearToYearsAgo(cal))).toEqual(cal);
    }
    expect(calendarYearToYearsAgo({ era: "CE", year: 1 }) - calendarYearToYearsAgo({ era: "BCE", year: 1 })).toBe(-1);
    expect(() => calendarYearToYearsAgo({ era: "CE", year: 0 })).toThrow();
  });

  it("exposes astronomical year conversion with a year 0", () => {
    expect(astronomicalYearToYearsAgo(0)).toBe(2000);
  });

  it("formats recent, deep and future times", () => {
    expect(formatTime(0)).toBe("公元 2000 年");
    expect(formatTime(2000)).toBe("公元前 1 年");
    expect(formatTime(2044)).toBe("公元前 45 年");
    expect(formatTime(-50)).toBe("公元 2050 年");
    expect(formatTime(-1_000_000)).toBe("未来 1,000,000 年");
    expect(formatTime(66_000_000)).toContain("66");
    expect(formatTime(66_000_000)).toContain("Ma");
    expect(formatDeepTime(4_540_000_000)).toContain("4.54 Ga");
    expect(formatDeepTime(50_000)).toContain("ka");
    expect(formatTime(Number.NaN)).toBe("—");
  });

  it("formats time ranges with 'until now' and labelled uncertainty", () => {
    expect(formatTimeRange({ fromYearsAgo: 315_000, toYearsAgo: 0, uncertaintyYears: { older: 34_000, younger: 0 } })).toBe(
      "距今 315 ka（千年） — 至今（起点 ± 34 千年）",
    );
    expect(formatTimeRange({ fromYearsAgo: 66e6, toYearsAgo: 66e6, uncertaintyYears: { older: 11_000, younger: 11_000 } })).toBe(
      "距今 66 Ma（百万年）（± 11 千年）",
    );
    expect(formatTimeRange({ fromYearsAgo: 240, toYearsAgo: 160 })).toBe("公元 1760 年 — 公元 1840 年");
  });
});
