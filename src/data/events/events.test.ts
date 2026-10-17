import { EVENTS, eventAnchorYearsAgo } from "./index";
import { SOURCES } from "../sources";
import { EARTH_FORMATION_YEARS_AGO } from "../../timeline/TimeEngine";

describe("key events (PLAN §5.2)", () => {
  it("has the 17 required events with unique ids", () => {
    expect(EVENTS).toHaveLength(17);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(17);
  });

  it.each(EVENTS.map((e) => [e.id, e] as const))("%s is well-formed and sourced", (_id, e) => {
    expect(e.title).not.toBe("");
    expect(e.description).not.toBe("");
    expect(e.time.fromYearsAgo).toBeGreaterThanOrEqual(e.time.toYearsAgo);
    expect(e.time.fromYearsAgo).toBeLessThanOrEqual(EARTH_FORMATION_YEARS_AGO);
    expect(e.time.toYearsAgo).toBeGreaterThanOrEqual(0);
    expect(e.sourceIds.length).toBeGreaterThan(0);
    for (const id of e.sourceIds) expect(SOURCES[id], `${e.id} → ${id}`).toBeDefined();
    expect(e.isSample).toBeFalsy();
  });

  it("converts calendar and BP dates onto the 2000 CE baseline", () => {
    const byId = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
    expect(byId["industrial-revolution"]!.time).toMatchObject({ fromYearsAgo: 240, toYearsAgo: 160 });
    // 3400 BCE = 天文年 -3399 → 2000 - (-3399)
    expect(byId["early-writing"]!.time.fromYearsAgo).toBe(5399);
    // 11,500 cal BP（1950 基准）→ 11,550 b2k
    expect(byId["near-east-agriculture"]!.time.fromYearsAgo).toBe(11_550);
    expect(eventAnchorYearsAgo(byId["jurassic"]!)).toBe(201_400_000);
  });
});
