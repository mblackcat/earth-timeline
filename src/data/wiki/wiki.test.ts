import { SPECIES } from "../species";
import { DIET_LABELS, WIKI_ENTRIES, WIKI_ORDER, WIKI_TREE, nodeCount, wikiPath, type WikiNode } from "./index";

function leaves(nodes: WikiNode[]): WikiNode[] {
  return nodes.flatMap((n) => [...(n.speciesIds ? [n] : []), ...leaves(n.children ?? [])]);
}

describe("wiki tree", () => {
  it("places every species in exactly one leaf", () => {
    const placed = leaves(WIKI_TREE).flatMap((n) => n.speciesIds!);
    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual(SPECIES.map((s) => s.id).sort());
    expect(WIKI_ORDER).toHaveLength(SPECIES.length);
    expect(WIKI_TREE.reduce((n, c) => n + nodeCount(c), 0)).toBe(SPECIES.length);
  });

  it("has unique node ids and no empty nodes", () => {
    const all = (function walk(ns: WikiNode[]): WikiNode[] {
      return ns.flatMap((n) => [n, ...walk(n.children ?? [])]);
    })(WIKI_TREE);
    expect(new Set(all.map((n) => n.id)).size).toBe(all.length);
    for (const n of all) expect(nodeCount(n), n.id).toBeGreaterThan(0);
  });

  it("resolves a species' path from root to leaf", () => {
    expect(wikiPath("tyrannosaurus-rex")?.map((n) => n.id)).toEqual(["reptiles", "dinosaurs", "theropods"]);
    expect(wikiPath("nope")).toBeNull();
  });
});

describe("wiki entries", () => {
  it("has no entries for unknown species", () => {
    const ids = new Set(SPECIES.map((s) => s.id));
    for (const id of Object.keys(WIKI_ENTRIES)) expect(ids.has(id), id).toBe(true);
  });

  it.each(SPECIES.map((s) => [s.id] as const))("%s has a complete structured entry", (id) => {
    const e = WIKI_ENTRIES[id];
    expect(e, id).toBeDefined();
    for (const k of ["tagline", "size", "anatomy", "ecology", "discovery", "significance"] as const) {
      expect(e![k].trim().length, `${id}.${k}`).toBeGreaterThan(k === "tagline" || k === "size" ? 4 : 30);
    }
    expect(DIET_LABELS[e!.diet]).toBeDefined();
    expect(e!.facts.length).toBeGreaterThanOrEqual(2);
    expect(e!.facts.length).toBeLessThanOrEqual(3);
  });
});
