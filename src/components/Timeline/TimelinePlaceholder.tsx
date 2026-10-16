import { useTimeStore } from "../../state/timeStore";
import { formatYearsAgoPlain } from "../../timeline/format";

/** Phase 1 占位：仅显示统一时间状态，不提供任何未实现的控件。 */
export function TimelinePlaceholder() {
  const yearsAgo = useTimeStore((s) => s.currentTimeYearsAgo);
  return (
    <footer className="timeline-region" data-testid="timeline-region">
      <div className="timeline-now">当前时间：{formatYearsAgoPlain(yearsAgo)}</div>
      <div className="timeline-pending">时间引擎与时间轴将在 Phase 2 / Phase 3 实现（播放、拖动、地质年代色带、事件导航）。</div>
    </footer>
  );
}
