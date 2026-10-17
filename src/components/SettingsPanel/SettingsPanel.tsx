import type { ReactNode } from "react";
import { useSettingsStore } from "../../state/settingsStore";
import { PlaybackSettings } from "./PlaybackSettings";

/** 可折叠分组（原生 <details>，默认展开）。 */
function Group({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <details className="settings-group" open data-testid={testId}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function SettingsPanel() {
  const panelOpen = useSettingsStore((s) => s.panelOpen);
  const setPanelOpen = useSettingsStore((s) => s.setPanelOpen);
  const showGraticule = useSettingsStore((s) => s.showGraticule);
  const setShowGraticule = useSettingsStore((s) => s.setShowGraticule);
  const showOutlines = useSettingsStore((s) => s.showOutlines);
  const setShowOutlines = useSettingsStore((s) => s.setShowOutlines);
  const timelineScale = useSettingsStore((s) => s.timelineScale);
  const setTimelineScale = useSettingsStore((s) => s.setTimelineScale);
  const timelineFollow = useSettingsStore((s) => s.timelineFollow);
  const setTimelineFollow = useSettingsStore((s) => s.setTimelineFollow);

  return (
    <aside className={`settings-panel ${panelOpen ? "open" : "collapsed"}`} data-testid="settings-panel">
      <button
        type="button"
        className="panel-toggle"
        data-testid="btn-toggle-panel"
        aria-expanded={panelOpen}
        aria-controls="settings-body"
        onClick={() => setPanelOpen(!panelOpen)}
        title={panelOpen ? "折叠设置面板" : "展开设置面板"}
      >
        {panelOpen ? "›" : "‹"}
      </button>
      {panelOpen && (
        <div className="panel-body" id="settings-body">
          <h2>设置</h2>

          <Group title="播放" testId="group-playback">
            <PlaybackSettings />
          </Group>

          <Group title="时间轴" testId="group-timeline">
            <div className="settings-group-body">
              <div className="field">
                <label className="field-label" htmlFor="tl-scale">
                  刻度
                </label>
                <select
                  id="tl-scale"
                  value={timelineScale}
                  onChange={(e) => setTimelineScale(e.target.value as typeof timelineScale)}
                  data-testid="tl-scale"
                >
                  <option value="segmented">分段压缩</option>
                  <option value="linear">线性（真实比例）</option>
                </select>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={timelineFollow}
                  onChange={(e) => setTimelineFollow(e.target.checked)}
                  data-testid="tl-follow"
                />
                播放时跟随当前时间
              </label>
            </div>
          </Group>

          <Group title="图层" testId="group-layers">
            <div className="settings-group-body">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showGraticule}
                  onChange={(e) => setShowGraticule(e.target.checked)}
                  data-testid="toggle-graticule"
                />
                经纬网
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={showOutlines}
                  onChange={(e) => setShowOutlines(e.target.checked)}
                  data-testid="toggle-outlines"
                />
                大陆轮廓
              </label>
            </div>
          </Group>
        </div>
      )}
    </aside>
  );
}
