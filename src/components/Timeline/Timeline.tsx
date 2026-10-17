import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { EVENTS, eventAnchorYearsAgo } from "../../data/events";
import type { HistoricalEvent } from "../../data/schema";
import { GEO_RANKS, GEO_RANK_LABELS, GEO_UNITS, GEO_UNIT_BY_ID, type GeoRank } from "../../data/geology/timescale";
import { useSelectionStore } from "../../state/selectionStore";
import { useSettingsStore } from "../../state/settingsStore";
import { useTimeStore } from "../../state/timeStore";
import { formatTime } from "../../timeline/CalendarAdapter";
import { timeEngine } from "../../timeline/runtime";
import {
  FULL_VIEW,
  TimeScale,
  computeTicks,
  ensureVisible,
  fitView,
  formatTick,
  panView,
  uToX,
  xToU,
  zoomView,
  type ScaleKind,
  type ViewWindow,
} from "../../timeline/TimeScale";
import { CATEGORY_STYLE } from "./categories";

// ── 布局（px） ──
const GUTTER = 30; // 左侧行名
const AXIS_H = 22;
const ROW_H = 15;
const EVENT_H = 30;
/** 一行单位中至少有一个可见宽度达到该值才显示这一行（随缩放决定显示层级）。 */
const MIN_ROW_UNIT_PX = 36;
const DRAG_THRESHOLD_PX = 4;

type Drag =
  | { kind: "scrub"; pointerId: number }
  | { kind: "pan"; pointerId: number; startX: number; startView: ViewWindow; moved: boolean; unitId: string | null };

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 当前时间指示器：唯一随每帧时间变化而重渲染的部分（TASKS 风险 R2）。 */
function Indicator({ scale, view, trackW, height }: { scale: TimeScale; view: ViewWindow; trackW: number; height: number }) {
  const yearsAgo = useTimeStore((s) => s.currentTimeYearsAgo);
  const u = scale.toU(yearsAgo);
  const x = uToX(view, trackW, u);
  const side = x < 0 ? "left" : x > trackW ? "right" : "in";
  const cx = GUTTER + Math.min(trackW, Math.max(0, x));
  return (
    <g className="tl-indicator" data-testid="timeline-indicator" data-x={x.toFixed(2)} data-side={side} pointerEvents="none">
      {side === "in" ? (
        <>
          <line x1={cx} x2={cx} y1={0} y2={height} />
          <path d={`M${cx - 5},0 L${cx + 5},0 L${cx},7 Z`} />
        </>
      ) : (
        <path
          className="tl-indicator-offscreen"
          d={side === "left" ? `M${cx + 2},${height / 2} l9,-7 v14 Z` : `M${cx - 2},${height / 2} l-9,-7 v14 Z`}
        />
      )}
    </g>
  );
}

interface LabeledEvent {
  event: HistoricalEvent;
  x0: number;
  x1: number;
  ax: number;
  showLabel: boolean;
}

/** 事件标记布局：标记总是绘制；标签在不与右侧相邻标签重叠时才显示。 */
function layoutEvents(scale: TimeScale, view: ViewWindow, trackW: number): LabeledEvent[] {
  const items = EVENTS.map((event) => ({
    event,
    x0: uToX(view, trackW, scale.toU(event.time.fromYearsAgo)),
    x1: uToX(view, trackW, scale.toU(event.time.toYearsAgo)),
    ax: uToX(view, trackW, scale.toU(eventAnchorYearsAgo(event))),
    showLabel: false,
  }))
    .filter((e) => e.x1 >= -8 && e.x0 <= trackW + 8)
    .sort((a, b) => a.ax - b.ax);
  let nextFree = -Infinity;
  for (const it of items) {
    const w = it.event.title.length * 12 + 10;
    if (it.ax >= nextFree && it.ax + w <= trackW + 4) {
      it.showLabel = true;
      nextFree = it.ax + w;
    }
  }
  return items;
}

/**
 * 时间轴。`leading` 渲染在同一行工具栏的左侧（底部的播放控制）。
 * 刻度类型与跟随开关来自设置面板（settingsStore）。
 */
export function Timeline({ leading }: { leading?: ReactNode }) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>();
  const svgRef = useRef<SVGSVGElement>(null);
  const maxYearsAgo = useTimeStore((s) => s.maxYearsAgo);
  const minYearsAgo = useTimeStore((s) => s.minYearsAgo);
  const selectedEventId = useSelectionStore((s) => s.selectedEventId);
  const selectEvent = useSelectionStore((s) => s.selectEvent);

  const scaleKind = useSettingsStore((s) => s.timelineScale);
  const follow = useSettingsStore((s) => s.timelineFollow);
  // 视窗与刻度类型绑定：切换刻度后回到全景（不用 effect 重置，避免额外渲染）。
  const [viewState, setViewState] = useState<{ kind: ScaleKind; view: ViewWindow }>({ kind: scaleKind, view: FULL_VIEW });
  const view = viewState.kind === scaleKind ? viewState.view : FULL_VIEW;
  const setView = useCallback(
    (next: ViewWindow | ((v: ViewWindow) => ViewWindow)) =>
      setViewState((st) => {
        const cur = st.kind === scaleKind ? st.view : FULL_VIEW;
        return { kind: scaleKind, view: typeof next === "function" ? next(cur) : next };
      }),
    [scaleKind],
  );
  const dragRef = useRef<Drag | null>(null);

  const scale = useMemo(() => new TimeScale(scaleKind, maxYearsAgo, minYearsAgo), [scaleKind, maxYearsAgo, minYearsAgo]);
  const trackW = Math.max(0, width - GUTTER);

  // 跟随：播放中当前时间离开视窗时平移视窗（只平移，不缩放）。
  useEffect(() => {
    if (!follow) return;
    const check = (t: number) => setView((v) => ensureVisible(v, scale.toU(t)));
    check(useTimeStore.getState().currentTimeYearsAgo);
    return useTimeStore.subscribe((s, prev) => {
      if (s.currentTimeYearsAgo !== prev.currentTimeYearsAgo) check(s.currentTimeYearsAgo);
    });
  }, [follow, scale, setView]);

  const rows = useMemo(() => {
    const visibleUnits = (rank: GeoRank) =>
      GEO_UNITS[rank]
        .map((unit) => {
          const x0 = uToX(view, trackW, scale.toU(unit.range.fromYearsAgo));
          const x1 = uToX(view, trackW, scale.toU(unit.range.toYearsAgo));
          return { unit, x0: Math.max(0, x0), x1: Math.min(trackW, x1) };
        })
        .filter((r) => r.x1 > r.x0);
    return GEO_RANKS.map((rank) => ({ rank, units: visibleUnits(rank) })).filter(
      (r, i) => i < 2 || r.units.some((u) => u.x1 - u.x0 >= MIN_ROW_UNIT_PX),
    );
  }, [scale, view, trackW]);

  const ticks = useMemo(() => computeTicks(scale, view, trackW), [scale, view, trackW]);
  const events = useMemo(() => layoutEvents(scale, view, trackW), [scale, view, trackW]);

  const bandsTop = AXIS_H;
  const eventsTop = bandsTop + rows.length * ROW_H + 4;
  const height = eventsTop + EVENT_H;

  // 滚轮缩放 / 横向平移：需要非 passive 监听才能阻止页面滚动。
  useEffect(() => {
    const el = svgRef.current;
    if (!el || trackW <= 0) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const x = e.clientX - el.getBoundingClientRect().left - GUTTER;
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        const d = e.shiftKey ? e.deltaY || e.deltaX : e.deltaX;
        setView((v) => panView(v, (d / trackW) * (v.u1 - v.u0)));
        return;
      }
      setView((v) => zoomView(scale, v, Math.exp(-e.deltaY * 0.0015), xToU(v, trackW, Math.min(trackW, Math.max(0, x)))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale, trackW, setView]);

  const localX = (e: ReactPointerEvent) => e.clientX - svgRef.current!.getBoundingClientRect().left - GUTTER;
  const seekToX = (x: number) => timeEngine.seek(scale.fromU(xToU(view, trackW, Math.min(trackW, Math.max(0, x)))));

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || trackW <= 0) return;
    const y = e.clientY - svgRef.current!.getBoundingClientRect().top;
    svgRef.current!.setPointerCapture(e.pointerId);
    if (y >= bandsTop && y < eventsTop) {
      const unitId = (e.target as Element).closest("[data-unit-id]")?.getAttribute("data-unit-id") ?? null;
      dragRef.current = { kind: "pan", pointerId: e.pointerId, startX: e.clientX, startView: view, moved: false, unitId };
    } else {
      dragRef.current = { kind: "scrub", pointerId: e.pointerId };
      seekToX(localX(e));
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    if (d.kind === "scrub") {
      seekToX(localX(e));
      return;
    }
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return;
    d.moved = true;
    const sv = d.startView;
    setView(panView(sv, (-dx / trackW) * (sv.u1 - sv.u0)));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    // 点击（未拖动）地质年代单位：缩放到该单位
    if (d.kind === "pan" && !d.moved && d.unitId) {
      const unit = GEO_UNIT_BY_ID[d.unitId];
      if (unit) setView(fitView(scale, Math.min(unit.range.fromYearsAgo, maxYearsAgo), unit.range.toYearsAgo));
    }
  };

  const jumpToEvent = (ev: HistoricalEvent) => {
    selectEvent(ev.id);
    timeEngine.seek(eventAnchorYearsAgo(ev));
  };

  const zoomCenter = (factor: number) => {
    const t = useTimeStore.getState().currentTimeYearsAgo;
    setView((v) => {
      const cu = scale.toU(t);
      return zoomView(scale, v, factor, cu >= v.u0 && cu <= v.u1 ? cu : (v.u0 + v.u1) / 2);
    });
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowLeft") timeEngine.step("backward");
    else if (e.key === "ArrowRight") timeEngine.step("forward");
    else if (e.key === "+" || e.key === "=") zoomCenter(2);
    else if (e.key === "-") zoomCenter(0.5);
    else return;
    e.preventDefault();
  };

  const selected = EVENTS.find((ev) => ev.id === selectedEventId);
  const viewOlder = scale.fromU(view.u0);
  const viewYounger = scale.fromU(view.u1);

  return (
    <div className="timeline" data-testid="timeline">
      <div className="tl-toolbar">
        {leading}
        {selected && (
          <span className="tl-selected" data-testid="timeline-selected" title={selected.title}>
            <span className="tl-dot" style={{ background: CATEGORY_STYLE[selected.category].color }} />
            {selected.title}
          </span>
        )}
        <span className="tl-spacer" />
        <span
          className="tl-window"
          data-testid="timeline-window"
          data-u0={view.u0.toFixed(6)}
          data-u1={view.u1.toFixed(6)}
          title={`时间轴视窗：${formatTime(viewOlder)} — ${formatTime(viewYounger)}`}
        >
          {formatTick(viewOlder, viewOlder - viewYounger)} — {formatTick(viewYounger, viewOlder - viewYounger)}
        </span>
        <div className="seg" role="group" aria-label="时间轴缩放">
          <button type="button" onClick={() => zoomCenter(0.5)} data-testid="tl-zoom-out" aria-label="缩小时间轴" title="缩小时间轴">
            −
          </button>
          <button type="button" onClick={() => zoomCenter(2)} data-testid="tl-zoom-in" aria-label="放大时间轴" title="放大时间轴">
            +
          </button>
          <button type="button" onClick={() => setView(FULL_VIEW)} data-testid="tl-zoom-all" title="显示全部历史">
            全部
          </button>
        </div>
      </div>

      <div className="tl-track" ref={wrapRef}>
        <svg
          ref={svgRef}
          width={width}
          height={height}
          role="slider"
          tabIndex={0}
          aria-label="时间轴：拖动定位时间，滚轮缩放，Shift+滚轮或拖动年代色带平移"
          aria-valuemin={minYearsAgo}
          aria-valuemax={maxYearsAgo}
          aria-valuetext="见当前时间读数"
          data-testid="timeline-svg"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
        >
          {/* 刻度 */}
          <g className="tl-axis">
            <rect x={GUTTER} y={0} width={trackW} height={AXIS_H} className="tl-axis-bg" />
            {ticks.map((t) => (
              <g key={`${t.yearsAgo}-${t.boundary}`} transform={`translate(${GUTTER + t.x},0)`} className={t.boundary ? "tl-tick boundary" : "tl-tick"}>
                <line y1={AXIS_H - 6} y2={t.boundary ? height : AXIS_H} />
                <text x={3} y={12} textAnchor={t.x > trackW - 40 ? "end" : "start"} dx={t.x > trackW - 40 ? -6 : 0}>
                  {t.label}
                </text>
              </g>
            ))}
          </g>

          {/* 地质年代色带 */}
          {rows.map((row, i) => (
            <g key={row.rank} className="tl-row" data-rank={row.rank} transform={`translate(0,${bandsTop + i * ROW_H})`}>
              <text x={GUTTER - 6} y={ROW_H - 4} textAnchor="end" className="tl-row-label">
                {GEO_RANK_LABELS[row.rank]}
              </text>
              {row.units.map(({ unit, x0, x1 }) => (
                <g key={unit.id} data-unit-id={unit.id} className="tl-unit">
                  <rect x={GUTTER + x0} y={0} width={x1 - x0} height={ROW_H - 1} fill={unit.color}>
                    <title>
                      {`${unit.name}（${unit.nameEn}）${formatTick(unit.range.fromYearsAgo, unit.range.fromYearsAgo)} – ${formatTick(unit.range.toYearsAgo, unit.range.fromYearsAgo)}${unit.approximate ? "（含近似边界）" : ""}\n点击缩放到该时期`}
                    </title>
                  </rect>
                  {x1 - x0 > unit.name.length * 11 + 6 && (
                    <text x={GUTTER + (x0 + x1) / 2} y={ROW_H - 4} textAnchor="middle" className="tl-unit-label">
                      {unit.name}
                    </text>
                  )}
                </g>
              ))}
            </g>
          ))}

          {/* 事件 */}
          <g transform={`translate(${GUTTER},${eventsTop})`} className="tl-events">
            {events.map(({ event, x0, x1, ax, showLabel }) => {
              const color = CATEGORY_STYLE[event.category].color;
              const isSel = event.id === selectedEventId;
              return (
                <g
                  key={event.id}
                  className={`tl-event${isSel ? " selected" : ""}`}
                  data-testid={`event-${event.id}`}
                  data-x={ax.toFixed(2)}
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => jumpToEvent(event)}
                >
                  <title>{`${event.title}\n${formatTime(event.time.fromYearsAgo)}${event.time.toYearsAgo !== event.time.fromYearsAgo ? ` — ${formatTime(event.time.toYearsAgo)}` : ""}\n${CATEGORY_STYLE[event.category].label} · 点击跳转`}</title>
                  {x1 - x0 > 2 && <rect x={x0} y={3} width={x1 - x0} height={4} fill={color} opacity={0.55} />}
                  <rect x={ax - 8} y={0} width={16} height={EVENT_H} fill="transparent" />
                  <path d={`M${ax},1 l5,5 l-5,5 l-5,-5 Z`} fill={color} stroke={isSel ? "#fff" : "none"} />
                  {showLabel && (
                    <text x={ax + 7} y={22} fill={color} className="tl-event-label">
                      {event.title}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          <Indicator scale={scale} view={view} trackW={trackW} height={height} />
        </svg>
      </div>

    </div>
  );
}
