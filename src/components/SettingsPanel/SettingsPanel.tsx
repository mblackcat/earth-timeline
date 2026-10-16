import { useSettingsStore } from "../../state/settingsStore";

export function SettingsPanel() {
  const panelOpen = useSettingsStore((s) => s.panelOpen);
  const setPanelOpen = useSettingsStore((s) => s.setPanelOpen);
  const showGraticule = useSettingsStore((s) => s.showGraticule);
  const setShowGraticule = useSettingsStore((s) => s.setShowGraticule);
  const showOutlines = useSettingsStore((s) => s.showOutlines);
  const setShowOutlines = useSettingsStore((s) => s.setShowOutlines);

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

          <section>
            <h3>视觉</h3>
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
          </section>

          <section>
            <h3>相机操作</h3>
            <ul className="hints">
              <li>左键拖动：旋转地球 / 平移区域</li>
              <li>右键或 Shift + 拖动：调整朝向与倾斜（近地表）</li>
              <li>滚轮 / 触控板捏合：缩放</li>
              <li>双击地表：飞向该点</li>
            </ul>
          </section>

          <section className="pending">
            <h3>尚未实现</h3>
            <p>播放设置（Phase 2/4）、图层（Phase 4）、场景风格（Phase 4）、动画设置（Phase 6）。</p>
          </section>
        </div>
      )}
    </aside>
  );
}
