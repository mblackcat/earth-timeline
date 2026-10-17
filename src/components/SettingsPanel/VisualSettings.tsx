import type { ReactNode } from "react";
import { useSettingsStore, type ModelDetail, type VisualStyle } from "../../state/settingsStore";

type GroupComponent = (props: { title: string; testId: string; children: ReactNode }) => ReactNode;

/** 设置面板"视觉"与"动画"分组（PLAN §7.3、§7.4）。 */
export function VisualSettings({ Group }: { Group: GroupComponent }) {
  const s = useSettingsStore();
  const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void, testId: string, title?: string) => (
    <label className="toggle" title={title}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      {label}
    </label>
  );
  return (
    <>
      <Group title="视觉" testId="group-visual">
        <div className="settings-group-body">
          <div className="field">
            <label className="field-label" htmlFor="visual-style">
              模型风格
            </label>
            <select id="visual-style" value={s.visualStyle} onChange={(e) => s.setVisualStyle(e.target.value as VisualStyle)} data-testid="visual-style">
              <option value="hybrid">线稿 + 实体</option>
              <option value="wireframe">3D 线稿</option>
              <option value="solid">纯色低多边形</option>
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="model-detail">
              细节等级
            </label>
            <select id="model-detail" value={s.modelDetail} onChange={(e) => s.setModelDetail(e.target.value as ModelDetail)} data-testid="model-detail">
              <option value="auto">自动（按距离）</option>
              <option value="low">简化</option>
              <option value="high">完整</option>
            </select>
          </div>
        </div>
      </Group>
      <Group title="动画" testId="group-animation">
        <div className="settings-group-body">
          {toggle("生物动画", s.animationsEnabled, s.setAnimationsEnabled, "toggle-animations")}
          {toggle("时间暂停时继续 Idle", s.idleWhenPaused, s.setIdleWhenPaused, "toggle-idle-paused", "暂停历史时间时，生物是否继续呼吸、摆头等动作")}
          {toggle("简单行为（漫游、进食）", s.behaviorEnabled, s.setBehaviorEnabled, "toggle-behavior")}
          {toggle("低性能模式", s.lowPerformance, s.setLowPerformance, "toggle-low-perf", "降低分辨率与动画更新频率，减少模型数量，隐藏星空")}
        </div>
      </Group>
    </>
  );
}
