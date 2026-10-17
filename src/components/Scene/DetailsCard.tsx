import { EVENT_BY_ID } from "../../data/events";
import { REGIONS } from "../../data/regions";
import type { EvidenceLevel, Source, SpatialExtent } from "../../data/schema";
import { getSource } from "../../data/sources";
import { HABITAT_LABELS, SPECIES_BY_ID } from "../../data/species";
import { focusEventOnGlobe, focusSpeciesOnGlobe, jumpToEvent } from "../../state/actions";
import { useGeographyStore } from "../../state/geographyStore";
import { useFossilSitesStore, usePaleoPointsStore } from "../../state/sceneStore";
import { frameFor, speciesSitesInFrame } from "../../simulation/paleoPositions";
import { useSelectionStore } from "../../state/selectionStore";
import { SPECIES_COLORS } from "../../scene/Living/speciesColors";
import { eventAnchorLonLat } from "../../simulation/VisibilityResolver";
import { formatTimeRange } from "../../timeline/CalendarAdapter";
import { CATEGORY_STYLE } from "../Timeline/categories";

const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  "well-established": "证据充分",
  estimated: "估计值",
  uncertain: "不确定",
};

const RANK_LABELS = { class: "纲", genus: "属", species: "种" } as const;

function describeLocation(loc: SpatialExtent | undefined): string | null {
  if (!loc) return null;
  if (loc.kind === "global") return "全球";
  const region = loc.regionId ? REGIONS[loc.regionId]?.label : undefined;
  const parts = [region, loc.note].filter(Boolean);
  if (loc.coordinates) parts.push(`${loc.coordinates[1].toFixed(1)}°, ${loc.coordinates[0].toFixed(1)}°（纬度, 经度）`);
  return parts.join(" · ") || null;
}

function Sources({ ids }: { ids: string[] }) {
  return (
    <ul className="detail-sources">
      {ids.map((id) => {
        const s: Source | undefined = getSource(id);
        if (!s) return <li key={id}>{id}（来源未登记）</li>;
        return (
          <li key={id}>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}
            {s.license && <span className="detail-license"> · {s.license}</span>}
          </li>
        );
      })}
    </ul>
  );
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
  const sites = useFossilSitesStore((s) => s.data?.species[id]);
  const paleo = usePaleoPointsStore((s) => s.data);
  const reconstructionMa = useGeographyStore((s) => s.slice?.reconstructionMa);
  if (!sp) return <p className="detail-missing">未找到物种数据：{id}</p>;
  const frame = frameFor(reconstructionMa);
  const shown = sites ? speciesSitesInFrame(id, sites.sites, frame, paleo).length : 0;
  return (
    <>
      <div className="detail-kicker" style={{ color: SPECIES_COLORS[id] }}>
        ● 代表性生物 · {RANK_LABELS[sp.rank]}
      </div>
      <h3 className="detail-title">
        {sp.commonName} <i className="detail-sci">{sp.scientificName}</i>
      </h3>
      <div className="detail-time" data-testid="detail-time">
        {formatTimeRange(sp.time)}
      </div>
      <p className="detail-desc">{sp.description}</p>
      <div className="detail-row">栖息环境：{sp.habitatIds.map((h) => HABITAT_LABELS[h]).join("、")}</div>
      <div className="detail-row">
        分布：
        {!sites
          ? "化石点数据尚未加载"
          : frame.kind === "paleo"
            ? `${sites.sites.length} 个化石点（${sites.occurrences} 条 PBDB 记录），已按板块重建旋转到 ${frame.ma} Ma 的位置，其中 ${shown} 个可重建`
            : `${sites.sites.length} 个化石点（${sites.occurrences} 条 PBDB 记录，现代坐标）`}
      </div>
      <div className="detail-row">
        <span className={`evidence ${sp.evidenceLevel}`}>{EVIDENCE_LABELS[sp.evidenceLevel]}</span>
        <span className="detail-note">{sp.evidenceNote}</span>
      </div>
      <div className="detail-actions">
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
      <h4>来源</h4>
      <Sources ids={sp.sourceIds} />
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
