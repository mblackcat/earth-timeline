import { EVENT_BY_ID } from "../../data/events";
import { REGIONS } from "../../data/regions";
import type { SpatialExtent } from "../../data/schema";
import { SPECIES_BY_ID } from "../../data/species";
import { focusEventOnGlobe, focusSpeciesOnGlobe, jumpToEvent } from "../../state/actions";
import { useGeographyStore } from "../../state/geographyStore";
import { useFossilSitesStore, usePaleoPointsStore, useModernRangesStore } from "../../state/sceneStore";
import { abundanceTier } from "../../simulation/abundance";
import { speciesSitesInFrame } from "../../simulation/paleoPositions";
import { currentPaleoFrame } from "../../state/paleoFrame";
import { useSelectionStore } from "../../state/selectionStore";
import { SPECIES_COLORS_MUTED } from "../../scene/Living/speciesColors";
import { eventAnchorLonLat } from "../../simulation/VisibilityResolver";
import { formatTimeRange } from "../../timeline/CalendarAdapter";
import { CATEGORY_STYLE } from "../Timeline/categories";
import { EVIDENCE_LABELS, RANK_LABELS } from "../common/labels";
import { Sources } from "../common/Sources";
import { useWikiStore } from "../../state/wikiStore";
import { WIKI_ENTRIES } from "../../data/wiki";

function describeLocation(loc: SpatialExtent | undefined): string | null {
  if (!loc) return null;
  if (loc.kind === "global") return "全球";
  const region = loc.regionId ? REGIONS[loc.regionId]?.label : undefined;
  const parts = [region, loc.note].filter(Boolean);
  if (loc.coordinates) parts.push(`${loc.coordinates[1].toFixed(1)}°, ${loc.coordinates[0].toFixed(1)}°（纬度, 经度）`);
  return parts.join(" · ") || null;
}

function EventDetail({ id }: { id: string }) {
  const event = EVENT_BY_ID[id];
  if (!event) return <p className="detail-missing">未找到事件数据：{id}</p>;
  const style = CATEGORY_STYLE[event.category];
  const where = describeLocation(event.location);
  return (
    <>
      <div className="detail-kicker" style={{ color: style.color }}>
        ◆ {style.label}
      </div>
      <h3 className="detail-title">{event.title}</h3>
      <div className="detail-time" data-testid="detail-time">
        {formatTimeRange(event.time)}
      </div>
      <p className="detail-desc">{event.description}</p>
      {where && <div className="detail-row">地点：{where}</div>}
      <div className="detail-row">
        <span className={`evidence ${event.evidenceLevel}`}>{EVIDENCE_LABELS[event.evidenceLevel]}</span>
        {event.evidenceNote && <span className="detail-note">{event.evidenceNote}</span>}
      </div>
      <div className="detail-actions">
        <button type="button" onClick={() => jumpToEvent(event, { moveCamera: false })} data-testid="detail-jump">
          跳转到该时间
        </button>
        {eventAnchorLonLat(event) && (
          <button type="button" onClick={() => focusEventOnGlobe(event)} data-testid="detail-focus">
            在地球上定位
          </button>
        )}
      </div>
      <h4>来源</h4>
      <Sources ids={event.sourceIds} />
    </>
  );
}

function SpeciesDetail({ id }: { id: string }) {
  const sp = SPECIES_BY_ID[id];
  const openSpecimen = useSelectionStore((s) => s.openSpecimen);
  const openWiki = useWikiStore((s) => s.openWiki);
  const sites = useFossilSitesStore((s) => s.data?.species[id]);
  const living = useModernRangesStore((s) => s.data?.species[id]);
  const paleo = usePaleoPointsStore((s) => s.data);
  // 切片变化时重新计数（同一切片内形变不改变可重建的点数）
  useGeographyStore((s) => s.slice);
  if (!sp) return <p className="detail-missing">未找到物种数据：{id}</p>;
  const frame = currentPaleoFrame();
  const shown = sites ? speciesSitesInFrame(id, sites.sites, frame, paleo).length : 0;
  // 全新世的现生类群显示现代观测点
  const showLiving = frame.kind === "modern" && !!living?.sites.length;
  return (
    <>
      <div className="detail-kicker" style={{ color: SPECIES_COLORS_MUTED[id] }}>
        ● 代表性生物 · {RANK_LABELS[sp.rank]}
      </div>
      <h3 className="detail-title">
        {sp.commonName} <i className="detail-sci">{sp.scientificName}</i>
      </h3>
      <div className="detail-time" data-testid="detail-time">
        {formatTimeRange(sp.time)}
      </div>
      <p className="detail-desc">{WIKI_ENTRIES[id]?.tagline ?? sp.description}</p>
      <div className="detail-row">
        分布：
        {showLiving
          ? `${living!.cells} 个 1° 分布格（GBIF ${living!.records.toLocaleString("zh-CN")} 条野外观测记录）`
          : !sites
          ? "化石点数据尚未加载"
          : frame.kind === "paleo"
            ? `${sites.sites.length} 个化石点（${sites.occurrences} 条 PBDB 记录），已按板块重建旋转到 ${frame.ma} → ${frame.nextMa} Ma 之间的位置，其中 ${shown} 个可重建`
            : `${sites.sites.length} 个化石点（${sites.occurrences} 条 PBDB 记录，现代坐标）`}
      </div>
      {showLiving ? (
        <div className="detail-row" data-testid="detail-abundance" title="观测记录数受调查强度影响，只是丰度的粗略代理">
          现代观测丰度：{living!.records.toLocaleString("zh-CN")} 条（数量级 {abundanceTier(living!.records, "gbif")} / 4，仅为粗略代理）
        </div>
      ) : (
        sites && (
          <div className="detail-row" data-testid="detail-abundance" title="记录数受保存条件与采样强度影响，只是丰度的粗略代理">
            化石记录丰度：{sites.occurrences.toLocaleString("zh-CN")} 条（数量级 {abundanceTier(sites.occurrences)} / 4，仅为粗略代理）
          </div>
        )
      )}
      <div className="detail-actions">
        <button type="button" onClick={() => openWiki(id)} data-testid="detail-wiki">
          查看百科
        </button>
        {sp.visualizationId && (
          <button type="button" onClick={() => openSpecimen(id)} data-testid="detail-specimen">
            近距离观察
          </button>
        )}
        {shown > 0 && (
          <button type="button" onClick={() => focusSpeciesOnGlobe(id)} data-testid="detail-focus">
            在地球上定位
          </button>
        )}
      </div>
    </>
  );
}

/** 事件 / 对象详情浮层（PLAN §3.1 区域 4）。 */
export function DetailsCard() {
  const detail = useSelectionStore((s) => s.detail);
  const eventId = useSelectionStore((s) => s.selectedEventId);
  const speciesId = useSelectionStore((s) => s.selectedSpeciesId);
  const close = useSelectionStore((s) => s.closeDetail);
  if (!detail) return null;
  const id = detail === "event" ? eventId : speciesId;
  if (!id) return null;
  return (
    <aside className="details-card" data-testid="details-card" data-kind={detail} aria-label="详情">
      <button type="button" className="details-close" onClick={close} aria-label="关闭详情" data-testid="details-close">
        ×
      </button>
      {detail === "event" ? <EventDetail id={id} /> : <SpeciesDetail id={id} />}
    </aside>
  );
}
