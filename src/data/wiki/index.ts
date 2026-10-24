import { SPECIES_BY_ID } from "../species";
import type { Species } from "../schema";
import { WIKI_ENTRIES_FISH_REPTILES_BIRDS } from "./entries/fish-reptiles-birds";
import { WIKI_ENTRIES_MAMMALS_A } from "./entries/mammals-a";
import { WIKI_ENTRIES_MAMMALS_B } from "./entries/mammals-b";
import { WIKI_ENTRIES_PLANTS_INVERTEBRATES } from "./entries/plants-invertebrates";
import type { WikiEntry, WikiNode } from "./schema";
import { WIKI_TREE } from "./tree";

export { WIKI_TREE } from "./tree";
export { DIET_LABELS, type DietType, type WikiEntry, type WikiNode } from "./schema";

export const WIKI_ENTRIES: Record<string, WikiEntry> = {
  ...WIKI_ENTRIES_PLANTS_INVERTEBRATES,
  ...WIKI_ENTRIES_FISH_REPTILES_BIRDS,
  ...WIKI_ENTRIES_MAMMALS_A,
  ...WIKI_ENTRIES_MAMMALS_B,
};

/** 叶节点中的物种，按出现年代由古到今排序。 */
export function nodeSpecies(node: WikiNode): Species[] {
  return (node.speciesIds ?? [])
    .map((id) => SPECIES_BY_ID[id])
    .filter((s): s is Species => !!s)
    .sort((a, b) => b.time.fromYearsAgo - a.time.fromYearsAgo);
}

/** 节点下（含子孙）的物种数。 */
export function nodeCount(node: WikiNode): number {
  return (node.speciesIds?.length ?? 0) + (node.children ?? []).reduce((n, c) => n + nodeCount(c), 0);
}

/** 物种在分类树中的路径（根 → 叶节点）。 */
export function wikiPath(speciesId: string, nodes: WikiNode[] = WIKI_TREE): WikiNode[] | null {
  for (const n of nodes) {
    if (n.speciesIds?.includes(speciesId)) return [n];
    const sub = n.children ? wikiPath(speciesId, n.children) : null;
    if (sub) return [n, ...sub];
  }
  return null;
}

/** 树的展示顺序（深度优先、叶内按年代）下的全部物种 id，用于上一条 / 下一条与默认选中。 */
export const WIKI_ORDER: string[] = (function walk(nodes: WikiNode[]): string[] {
  return nodes.flatMap((n) => [...nodeSpecies(n).map((s) => s.id), ...walk(n.children ?? [])]);
})(WIKI_TREE);
