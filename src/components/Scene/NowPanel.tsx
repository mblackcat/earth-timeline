import { useState } from "react";
import { useFossilSitesStore, useSceneStore } from "../../state/sceneStore";
import { useSelectionStore } from "../../state/selectionStore";
import { eventAnchorLonLat } from "../../simulation/VisibilityResolver";
import { SPECIES_COLORS_MUTED } from "../../scene/Living/speciesColors";
import { CATEGORY_STYLE } from "../Timeline/categories";

/** 场景左上角：当前时间可见的物种与事件（随时间自动变化，点击查看详情）。 */
export function NowPanel() {
  const { events, species } = useSceneStore((s) => s.visible);
  const sitesLoad = useFossilSitesStore((s) => s.loadState);
  const sitesError = useFossilSitesStore((s) => s.error);
  const selectEvent = useSelectionStore((s) => s.selectEvent);
  const selectSpecies = useSelectionStore((s) => s.selectSpecies);
  const [collapsed, setCollapsed] = useState(false);
  const empty = events.length === 0 && species.length === 0;

  return (
    <div className="now-panel" data-testid="now-panel">
      <button type="button" className="now-head" onClick={() => setCollapsed((v) => !v)} aria-expanded={!collapsed}>
        此时期 <span className="now-count">{species.length + events.length}</span>
        <span className="now-caret">{collapsed ? "▸" : "▾"}</span>
      </button>
      {!collapsed && (
        <div className="now-body">
          {empty && <p className="now-empty">这个时间没有已收录的代表性生物或关键事件。</p>}
          {species.length > 0 && (
            <ul className="now-list" aria-label="可见物种">
              {species.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => selectSpecies(s.id)} data-testid={`now-species-${s.id}`}>
                    <span className="now-dot round" style={{ background: SPECIES_COLORS_MUTED[s.id] }} />
                    {s.commonName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {events.length > 0 && (
            <ul className="now-list" aria-label="附近的事件">
              {events.map(({ event, emphasis }) => (
                <li key={event.id} className={emphasis}>
                  <button type="button" onClick={() => selectEvent(event.id)} data-testid={`now-event-${event.id}`}>
                    <span className="now-dot" style={{ background: CATEGORY_STYLE[event.category].color }} />
                    {event.title}
                    {!eventAnchorLonLat(event) && <span className="now-tag">全球</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {sitesLoad === "error" && <p className="now-error">化石点数据加载失败：{sitesError}</p>}
        </div>
      )}
    </div>
  );
}
