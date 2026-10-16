import { getSource } from "../../data/sources";
import { useGeographyStore } from "../../state/geographyStore";
import { useSettingsStore } from "../../state/settingsStore";

/** 场景左下角：当前地理轮廓的数据状态、示意标注与来源（PLAN §3.3.3、§9.3）。 */
export function GeographyCaption() {
  const { slice, status, message, loadState, error } = useGeographyStore();
  const showOutlines = useSettingsStore((s) => s.showOutlines);
  if (!showOutlines) return null;

  return (
    <div className="geo-caption" data-testid="geo-caption" data-status={status} data-load={loadState}>
      <div className="geo-title">
        地理轮廓：{message}
        {slice?.isSchematic && <span className="badge badge-schematic">示意数据</span>}
        {status === "fallback" && <span className="badge badge-warn">借用相邻时期</span>}
      </div>
      {loadState === "loading" && <div className="geo-line">加载中…</div>}
      {loadState === "error" && <div className="geo-line geo-error">轮廓加载失败：{error}</div>}
      {slice && (
        <>
          <div className="geo-line">{slice.note}</div>
          <div className="geo-line geo-source">
            来源：
            {slice.sourceIds.map((id) => {
              const src = getSource(id);
              if (!src) return <span key={id}>{id}（未登记）</span>;
              return src.url ? (
                <a key={id} href={src.url} target="_blank" rel="noreferrer">
                  {src.title}
                </a>
              ) : (
                <span key={id}>{src.title}</span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
