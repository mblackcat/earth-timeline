import { useTimeStore } from "../../state/timeStore";
import { useViewStore } from "../../state/viewStore";
import { HelpButton } from "../Help/HelpButton";
import { describeGeoPeriod } from "../../data/geology/timescale";
import { formatTime } from "../../timeline/CalendarAdapter";
import { EARTH_RADIUS_KM, LEVEL_LABELS } from "../../utils/geo";

export function TopBar() {
  const yearsAgo = useTimeStore((s) => s.currentTimeYearsAgo);
  const level = useViewStore((s) => s.level);
  const altitude = useViewStore((s) => s.altitude);
  const lon = useViewStore((s) => s.lon);
  const lat = useViewStore((s) => s.lat);
  const requestCamera = useViewStore((s) => s.requestCamera);
  const altitudeKm = Math.round(altitude * EARTH_RADIUS_KM);

  return (
    <header className="top-bar">
      <div className="brand">
        <span className="brand-title">Earth Through Time</span>
        <span className="brand-sub">地球时空演化图谱</span>
      </div>
      <div className="top-time" data-testid="current-time">
        {formatTime(yearsAgo)}
      </div>
      <GeoPeriod />
      <div className="top-view">
        <span
          className="view-level"
          data-testid="view-level"
          data-level={level}
          data-altitude={altitude.toFixed(5)}
          data-lon={lon.toFixed(3)}
          data-lat={lat.toFixed(3)}
          title="当前空间层级（由相机到地表的高度决定）"
        >
          {LEVEL_LABELS[level]} · 高度 {altitudeKm.toLocaleString("zh-CN")} km
        </span>
        <button type="button" onClick={() => requestCamera("global")} data-testid="btn-global-view">
          返回全球视角
        </button>
        <button type="button" onClick={() => requestCamera("default")} data-testid="btn-reset-view">
          重置视角
        </button>
        <HelpButton />
      </div>
    </header>
  );
}

/** 当前历史时期（ICS 宙/代/纪/世）。只在所属单位变化时更新文本。 */
function GeoPeriod() {
  const text = useTimeStore((s) => describeGeoPeriod(s.currentTimeYearsAgo));
  return (
    <div className="top-period" data-testid="current-period" title="当前地质年代（ICS v2024/12）">
      {text}
    </div>
  );
}
