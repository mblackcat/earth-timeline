import { EVENTS, eventAnchorYearsAgo } from "../data/events";
import { SPECIES } from "../data/species";
import { PACING_WEIGHTS, collectPacingAnchors } from "./pacingAnchors";

describe("collectPacingAnchors", () => {
  const anchors = collectPacingAnchors();
  const has = (t: number, w: number) => anchors.some((a) => a.yearsAgo === t && a.weight === w);

  it("includes every event anchor", () => {
    for (const e of EVENTS) expect(has(eventAnchorYearsAgo(e), PACING_WEIGHTS.event)).toBe(true);
  });

  it("includes species appearances and extinctions, but not 'extant' (0)", () => {
    for (const s of SPECIES) {
      expect(has(s.time.fromYearsAgo, PACING_WEIGHTS.species)).toBe(true);
      if (s.time.toYearsAgo > 0) expect(has(s.time.toYearsAgo, PACING_WEIGHTS.species)).toBe(true);
    }
    expect(anchors.some((a) => a.yearsAgo === 0 && a.weight === PACING_WEIGHTS.species)).toBe(false);
  });

  it("includes Phanerozoic period boundaries only", () => {
    expect(has(66_000_000, PACING_WEIGHTS.period)).toBe(true);
    expect(has(538_800_000, PACING_WEIGHTS.period)).toBe(true);
    expect(anchors.some((a) => a.weight === PACING_WEIGHTS.period && a.yearsAgo > 538_800_000)).toBe(false);
  });
});
