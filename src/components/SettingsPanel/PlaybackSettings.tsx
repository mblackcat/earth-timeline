import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTimeStore } from "../../state/timeStore";
import { formatYearsSpan } from "../../timeline/CalendarAdapter";
import { timeEngine } from "../../timeline/runtime";
import { modeForRate } from "../../timeline/speeds";
import { MAX_TARGET_SECONDS, MIN_TARGET_SECONDS, STEP_SIZES, isValidRate } from "../../timeline/TimeEngine";

/** 设置面板"播放"分组：方向、单步、自定义倍率、全史时长、快速跳转。 */
export function PlaybackSettings() {
  const s = useTimeStore(
    useShallow((st) => ({
      direction: st.direction,
      mode: st.mode,
      rate: st.rate,
      stepSize: st.stepSize,
      maxYearsAgo: st.maxYearsAgo,
      minYearsAgo: st.minYearsAgo,
    })),
  );
  const [customRate, setCustomRate] = useState("");
  const [targetSeconds, setTargetSeconds] = useState("60");
  const [error, setError] = useState<string | null>(null);

  const applyCustomRate = () => {
    const v = Number(customRate);
    if (customRate.trim() === "" || !isValidRate(v)) {
      setError("自定义倍率需在 0.001 – 10,000,000,000 年/秒之间");
      return;
    }
    setError(null);
    timeEngine.setMode(modeForRate(v));
    timeEngine.setRate(v);
  };

  const applyTarget = () => {
    const v = Number(targetSeconds);
    timeEngine.setMode("deep");
    if (targetSeconds.trim() === "" || timeEngine.setTargetDuration(v) === null) {
      setError(`时长需在 ${MIN_TARGET_SECONDS} – ${MAX_TARGET_SECONDS} 秒之间`);
      return;
    }
    setError(null);
  };

  return (
    <div className="settings-group-body">
      <div className="field">
        <span className="field-label">方向</span>
        <div className="seg" role="group" aria-label="播放方向">
          <button
            type="button"
            aria-pressed={s.direction === "forward"}
            onClick={() => timeEngine.setDirection("forward")}
            data-testid="dir-forward"
          >
            向现代 ▶
          </button>
          <button
            type="button"
            aria-pressed={s.direction === "backward"}
            onClick={() => timeEngine.setDirection("backward")}
            data-testid="dir-backward"
          >
            ◀ 回溯过去
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label">当前倍率</span>
        <span data-testid="current-rate" data-mode={s.mode}>
          {formatYearsSpan(s.rate)}/秒 · {s.mode === "fine" ? "精细模式" : "深时模式"}
        </span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="custom-rate">
          自定义
        </label>
        <div className="inline">
          <input
            id="custom-rate"
            type="number"
            min="0"
            placeholder="年/秒"
            value={customRate}
            onChange={(e) => setCustomRate(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyCustomRate()}
            data-testid="custom-rate"
          />
          <button type="button" onClick={applyCustomRate} data-testid="apply-custom-rate">
            应用
          </button>
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="target-seconds">
          全史播完
        </label>
        <div className="inline">
          <input
            id="target-seconds"
            type="number"
            min={MIN_TARGET_SECONDS}
            max={MAX_TARGET_SECONDS}
            value={targetSeconds}
            onChange={(e) => setTargetSeconds(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyTarget()}
            data-testid="target-seconds"
          />
          <span className="unit">秒</span>
          <button type="button" onClick={applyTarget} data-testid="apply-target">
            应用
          </button>
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="step-size">
          单步
        </label>
        <div className="inline">
          <button type="button" onClick={() => timeEngine.step("backward")} data-testid="btn-step-back" title="后退一步（回到过去）">
            ◂
          </button>
          <select
            id="step-size"
            value={s.stepSize}
            onChange={(e) => timeEngine.setStepSize(Number(e.target.value))}
            data-testid="step-size"
          >
            {STEP_SIZES.map((n) => (
              <option key={n} value={n}>
                {n.toLocaleString("zh-CN")} 年
              </option>
            ))}
          </select>
          <button type="button" onClick={() => timeEngine.step("forward")} data-testid="btn-step-forward" title="前进一步（走向现代）">
            ▸
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label">跳转</span>
        <div className="inline">
          <button type="button" onClick={() => timeEngine.seek(s.maxYearsAgo)} data-testid="btn-seek-origin">
            地球形成
          </button>
          <button type="button" onClick={() => timeEngine.seek(s.minYearsAgo)} data-testid="btn-seek-modern">
            现代
          </button>
        </div>
      </div>

      {error && (
        <p className="field-error" role="alert" data-testid="playback-error">
          {error}
        </p>
      )}
    </div>
  );
}
