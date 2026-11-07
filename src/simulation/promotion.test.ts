import { choosePromoted } from "./promotion";

const keys = Array.from({ length: 10 }, (_, i) => `k${i}`);

describe("choosePromoted", () => {
  it("takes the nearest max keys when nothing is promoted yet", () => {
    expect([...choosePromoted(keys, new Set(), 3, 4)]).toEqual(["k0", "k1", "k2"]);
  });
  it("keeps current members ranked within keepWithin (hysteresis)", () => {
    expect([...choosePromoted(keys, new Set(["k3"]), 3, 4)].sort()).toEqual(["k0", "k1", "k3"]);
  });
  it("drops current members ranked beyond keepWithin", () => {
    expect([...choosePromoted(keys, new Set(["k8"]), 3, 4)]).toEqual(["k0", "k1", "k2"]);
  });
  it("never exceeds max", () => {
    expect(choosePromoted(keys, new Set(keys), 3, 10).size).toBe(3);
  });
});
