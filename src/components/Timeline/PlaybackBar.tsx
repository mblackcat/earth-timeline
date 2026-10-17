import { useShallow } from "zustand/react/shallow";
import { useTimeStore } from "../../state/timeStore";
import { formatTime, formatYearsSpan } from "../../timeline/CalendarAdapter";
import { timeEngine } from "../../timeline/runtime";
import { SPEED_PRESETS, applySpeedPreset, matchSpeedPreset } from "../../timeline/speeds";

const CUSTOM = "custom";

/** 只有时间读数随每帧重渲染（TASKS 风险 R2）。 */
function TimeReadout() {
  const yearsAgo = useTimeStore((s) => s.currentTimeYearsAgo);
  return (
    <span className="playback-now" data-testid="playback-now" data-years-ago={yearsAgo}>
      {formatTime(yearsAgo)}
    </span>
  );
}

/**
 * 底部的精简播放控制：播放 / 暂停 + 倍速。
 * 方向、单步、自定义倍率、跳转等运行参数在右侧设置面板的"播放"分组中。
 */
export function PlaybackBar() {
  const s = useTimeStore(
    useShallow((st) => ({
      isPlaying: st.isPlaying,
      direction: st.direction,
      mode: st.mode,
      rate: st.rate,
      maxYearsAgo: st.maxYearsAgo,
      minYearsAgo: st.minYearsAgo,
      boundary: st.boundary,
    })),
  );
  const preset = matchSpeedPreset(s);

  return (
    <div className="playback-bar" data-testid="playback-bar">
      <button
        type="button"
        className="play-btn"
        aria-pressed={s.isPlaying}
        onClick={() => (s.isPlaying ? timeEngine.pause() : timeEngine.playOrRestart())}
        data-testid="btn-play"
        title={s.isPlaying ? "暂停" : "播放（到达终点时从头开始）"}
      >
        {s.isPlaying ? "❚❚ 暂停" : s.direction === "forward" ? "▶ 播放" : "◀ 回溯"}
      </button>
      <label className="speed" title="播放倍速">
        <span>倍速</span>
        <select
          value={preset?.id ?? CUSTOM}
          onChange={(e) => {
            const p = SPEED_PRESETS.find((x) => x.id === e.target.value);
            if (p) applySpeedPreset(timeEngine, p);
          }}
          data-testid="speed-select"
        >
          {SPEED_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
          {!preset && <option value={CUSTOM}>自定义 {formatYearsSpan(s.rate)}/秒</option>}
        </select>
      </label>
      <TimeReadout />
      {!s.isPlaying && s.boundary !== "none" && (
        <span className="playback-hint" data-testid="playback-hint">
          {s.boundary === "modern" ? "已到达现代 · 再点播放从地球形成开始" : "已到达地球形成 · 再点回溯从现代开始"}
        </span>
      )}
      <span className="playback-state" data-testid="playback-state" data-playing={s.isPlaying} data-direction={s.direction} hidden />
    </div>
  );
}
