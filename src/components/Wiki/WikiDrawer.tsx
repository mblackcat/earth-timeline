import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { unitAt } from "../../data/geology/timescale";
import type { Species } from "../../data/schema";
import { HABITAT_LABELS, SPECIES, SPECIES_BY_ID } from "../../data/species";
import { VISUAL_BY_ID } from "../../data/visuals";
import { DIET_LABELS, WIKI_ENTRIES, WIKI_ORDER, WIKI_TREE, nodeCount, nodeSpecies, wikiPath, type WikiNode } from "../../data/wiki";
import { SPECIES_COLORS_MUTED } from "../../scene/Living/speciesColors";
import { WikiModelScene } from "../../scene/Wiki/WikiModelScene";
import { jumpToSpecies } from "../../state/actions";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore, type VisualStyle } from "../../state/settingsStore";
import { useWikiStore } from "../../state/wikiStore";
import { formatTime, formatTimeRange } from "../../timeline/CalendarAdapter";
import { EVIDENCE_LABELS, KINGDOM_LABELS, RANK_LABELS } from "../common/labels";
import { Sources } from "../common/Sources";

const STYLE_LABELS: Record<VisualStyle, string> = { line: "线稿", tone: "网点", plain: "白模" };

/** 起止所在的"纪"：同一纪只写一次。 */
function periodSpan(sp: Species): string {
  const a = unitAt("period", sp.time.fromYearsAgo)?.name;
  // 终点常落在纪的边界上（如 66 Ma），取区间内侧一点
  const b = unitAt("period", Math.min(sp.time.toYearsAgo + 1, sp.time.fromYearsAgo))?.name;
  if (!a) return "—";
  return !b || a === b ? a : `${a} — ${b}`;
}

function matches(sp: Species, q: string): boolean {
  return sp.commonName.includes(q) || sp.scientificName.toLowerCase().includes(q.toLowerCase());
}

function TreeNode({ node, depth, isOpen, toggle, query, selectedId, onSelect }: {
  node: WikiNode;
  depth: number;
  isOpen: (id: string) => boolean;
  toggle: (id: string) => void;
  query: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const species = nodeSpecies(node).filter((s) => !query || matches(s, query));
  const children = node.children ?? [];
  // 搜索时只保留有命中的分支，并全部展开
  const hits = query ? species.length + children.reduce((n, c) => n + (hasHit(c, query) ? 1 : 0), 0) : 1;
  if (!hits) return null;
  const open = !!query || isOpen(node.id);
  return (
    <li className="wiki-node" data-depth={depth}>
      <button
        type="button"
        className="wiki-node-btn"
        aria-expanded={open}
        onClick={() => toggle(node.id)}
        data-testid={`wiki-node-${node.id}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        <span className="wiki-caret" aria-hidden="true">{open ? "▾" : "▸"}</span>
        <span className="wiki-node-label">{node.label}</span>
        <span className="wiki-count">{nodeCount(node)}</span>
      </button>
      {open && (
        <ul>
          {children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} isOpen={isOpen} toggle={toggle} query={query} selectedId={selectedId} onSelect={onSelect} />
          ))}
          {species.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="wiki-leaf"
                aria-current={s.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(s.id)}
                data-testid={`wiki-species-${s.id}`}
                style={{ paddingLeft: 22 + depth * 14 }}
              >
                <span className="wiki-dot" style={{ background: SPECIES_COLORS_MUTED[s.id] }} aria-hidden="true" />
                <span className="wiki-leaf-name">{s.commonName}</span>
                <span className="wiki-leaf-time">{formatTime(s.time.fromYearsAgo).replace(/^距今 /, "").replace(/（.*）$/, "")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function hasHit(node: WikiNode, q: string): boolean {
  return nodeSpecies(node).some((s) => matches(s, q)) || (node.children ?? []).some((c) => hasHit(c, q));
}

function Stage({ sp }: { sp: Species }) {
  const asset = sp.visualizationId ? VISUAL_BY_ID[sp.visualizationId] : undefined;
  const style = useSettingsStore((s) => s.visualStyle);
  const setStyle = useSettingsStore((s) => s.setVisualStyle);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);
  return (
    <div className="wiki-stage" data-testid="wiki-stage">
      {asset ? (
        <Canvas flat dpr={lowPerformance ? 1 : [1, 2]} camera={{ fov: 32 }}>
          <WikiModelScene key={sp.id} asset={asset} />
        </Canvas>
      ) : (
        <div className="wiki-stage-empty">暂无模型</div>
      )}
      <div className="wiki-stage-hint">拖动旋转 · 滚轮缩放{asset && " · 示意模型，非精确复原"}</div>
      <div className="seg wiki-stage-style" role="group" aria-label="渲染风格">
        {(Object.keys(STYLE_LABELS) as VisualStyle[]).map((s) => (
          <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)}>
            {STYLE_LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

function Article({ sp, onSelect }: { sp: Species; onSelect: (id: string) => void }) {
  const entry = WIKI_ENTRIES[sp.id];
  const close = useWikiStore((s) => s.close);
  const openSpecimen = useSelectionStore((s) => s.openSpecimen);
  const path = wikiPath(sp.id) ?? [];
  const i = WIKI_ORDER.indexOf(sp.id);
  const prev = i > 0 ? SPECIES_BY_ID[WIKI_ORDER[i - 1]!] : undefined;
  const next = i >= 0 && i < WIKI_ORDER.length - 1 ? SPECIES_BY_ID[WIKI_ORDER[i + 1]!] : undefined;
  const tax = sp.taxonomy ?? {};
  const taxonomy = [tax.kingdom && (KINGDOM_LABELS[tax.kingdom] ?? tax.kingdom), tax.class, tax.order, tax.family].filter(Boolean).join(" › ");

  const facts: [string, string][] = [
    ["学名", sp.scientificName],
    ["分类等级", RANK_LABELS[sp.rank]],
    ...(taxonomy ? ([["分类", taxonomy]] as [string, string][]) : []),
    ["生存年代", formatTimeRange(sp.time)],
    ["地质年代", periodSpan(sp)],
    ...(entry ? ([["体型", entry.size], ["食性", DIET_LABELS[entry.diet]]] as [string, string][]) : []),
    ["栖息环境", sp.habitatIds.map((h) => HABITAT_LABELS[h]).join("、")],
  ];

  const sections: [string, string, string | undefined][] = [
    ["overview", "概述", sp.description],
    ["anatomy", "形态特征", entry?.anatomy],
    ["ecology", "食性与生活方式", entry?.ecology],
    ["discovery", "发现与研究", entry?.discovery],
    ["significance", "演化意义", entry?.significance],
  ];

  return (
    <article className="wiki-article" data-testid="wiki-article" data-species={sp.id}>
      <div className="wiki-crumbs">{path.map((n) => n.label).join(" / ")}</div>
      <h2 className="wiki-title">
        {sp.commonName} <i className="detail-sci">{sp.scientificName}</i>
      </h2>
      {entry && <p className="wiki-tagline">{entry.tagline}</p>}

      <dl className="wiki-facts" data-testid="wiki-facts">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="detail-actions">
        <button
          type="button"
          onClick={() => {
            jumpToSpecies(sp.id, sp.time);
            close();
          }}
          data-testid="wiki-jump"
        >
          在时间轴上查看
        </button>
        {sp.visualizationId && (
          <button
            type="button"
            onClick={() => {
              close();
              openSpecimen(sp.id);
            }}
            data-testid="wiki-specimen"
          >
            近距离观察
          </button>
        )}
      </div>

      {sections.map(([key, title, text]) =>
        text ? (
          <section key={key} className="wiki-section" data-section={key}>
            <h3>{title}</h3>
            <p>{text}</p>
          </section>
        ) : null,
      )}
      {entry && entry.facts.length > 0 && (
        <section className="wiki-section" data-section="facts">
          <h3>趣闻</h3>
          <ul>
            {entry.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}
      <section className="wiki-section" data-section="evidence">
        <h3>年代依据</h3>
        <p>
          <span className={`evidence ${sp.evidenceLevel}`}>{EVIDENCE_LABELS[sp.evidenceLevel]}</span> {sp.evidenceNote}
        </p>
      </section>
      <section className="wiki-section" data-section="sources">
        <h3>来源</h3>
        <Sources ids={sp.sourceIds} />
      </section>

      <nav className="wiki-pager" aria-label="相邻条目">
        {prev ? (
          <button type="button" onClick={() => onSelect(prev.id)} data-testid="wiki-prev">
            ← {prev.commonName}
          </button>
        ) : (
          <span />
        )}
        {next && (
          <button type="button" onClick={() => onSelect(next.id)} data-testid="wiki-next">
            {next.commonName} →
          </button>
        )}
      </nav>
    </article>
  );
}

/** 生物百科：右侧半屏抽屉，左半屏为遮罩。左栏分类树，右栏上方固定 3D 展台、下方滚动的结构化条目。 */
export function WikiDrawer() {
  const open = useWikiStore((s) => s.open);
  const storedId = useWikiStore((s) => s.speciesId);
  const select = useWikiStore((s) => s.select);
  const close = useWikiStore((s) => s.close);
  const mapSelected = useSelectionStore((s) => s.selectedSpeciesId);
  const [query, setQuery] = useState("");
  // 用户手动展开 / 收起的节点；未操作过的节点在包含当前条目时展开
  const [toggled, setToggled] = useState<ReadonlyMap<string, boolean>>(() => new Map());
  const panelRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);

  const speciesId = storedId && SPECIES_BY_ID[storedId] ? storedId : (mapSelected ?? WIKI_ORDER[0] ?? null);
  const sp = speciesId ? SPECIES_BY_ID[speciesId] : undefined;

  const onPath = useMemo(() => new Set((speciesId ? (wikiPath(speciesId) ?? []) : []).map((n) => n.id)), [speciesId]);
  const isOpen = (id: string) => toggled.get(id) ?? onPath.has(id);

  // 切换条目时正文回到顶部
  useEffect(() => {
    if (open) articleRef.current?.scrollTo?.({ top: 0 });
  }, [open, speciesId]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const toggle = (id: string) => setToggled((prev) => new Map(prev).set(id, !isOpen(id)));

  const q = query.trim();
  const hitCount = useMemo(() => (q ? SPECIES.filter((s) => matches(s, q)).length : SPECIES.length), [q]);

  if (!open) return null;
  return (
    <div className="wiki" data-testid="wiki-drawer">
      <div className="wiki-scrim" onClick={close} data-testid="wiki-scrim" aria-hidden="true" />
      <section className="wiki-panel" role="dialog" aria-modal="true" aria-label="生物百科" tabIndex={-1} ref={panelRef}>
        <header className="wiki-head">
          <h2>生物百科</h2>
          <span className="wiki-sub">{SPECIES.length} 个代表性类群</span>
          <input
            type="search"
            className="wiki-search"
            placeholder="搜索名称 / 学名"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="搜索物种"
            data-testid="wiki-search"
          />
          <button type="button" className="details-close" onClick={close} aria-label="关闭百科" data-testid="wiki-close">
            ×
          </button>
        </header>
        <div className="wiki-body">
          <nav className="wiki-tree" aria-label="分类">
            {q && <div className="wiki-hits">{hitCount ? `${hitCount} 个结果` : "没有匹配的物种"}</div>}
            <ul>
              {WIKI_TREE.map((n) => (
                <TreeNode key={n.id} node={n} depth={0} isOpen={isOpen} toggle={toggle} query={q} selectedId={speciesId} onSelect={select} />
              ))}
            </ul>
          </nav>
          <div className="wiki-main">
            {sp ? (
              <>
                <Stage sp={sp} />
                <div className="wiki-scroll" ref={articleRef}>
                  <Article sp={sp} onSelect={select} />
                </div>
              </>
            ) : (
              <p className="detail-missing">请选择一个物种</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
