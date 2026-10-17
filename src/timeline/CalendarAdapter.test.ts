import {
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
});
