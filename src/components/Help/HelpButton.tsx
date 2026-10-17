import { useEffect, useRef, useState } from "react";
import { CATEGORY_STYLE } from "../Timeline/categories";

/** 顶部栏的帮助按钮：操作说明与时间轴图例（默认收起）。 */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="help" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="help-popover"
        onClick={() => setOpen((v) => !v)}
        data-testid="btn-help"
        title="操作说明"
      >
        ? 帮助
      </button>
      {open && (
        <div className="help-popover" id="help-popover" role="dialog" aria-label="操作说明" data-testid="help-popover">
          <section>
            <h3>地球视角</h3>
            <ul>
              <li>左键拖动：旋转地球 / 平移区域</li>
              <li>右键或 Shift + 拖动：调整朝向与倾斜（近地表）</li>
              <li>滚轮 / 触控板捏合：缩放</li>
              <li>双击地表：飞向该点</li>
            </ul>
          </section>
          <section>
            <h3>地图上的内容</h3>
            <ul>
              <li>
                <b>大陆轮廓</b>：全新世（1.17 万年内）为现代海岸线；更早为板块重建模型（Cao et al. 2024，可回溯 18 亿年）给出的大陆位置，表示陆块在当时的大致位置，不是当时的真实海岸线。更早的时期没有重建数据，可显示灰色现代海岸线作为参考。
              </li>
              <li>
                <b>彩色圆点</b>：代表性生物的化石发现地（PBDB），只在该生物生存的年代显示，并随大陆一起旋转到当时的位置。
              </li>
              <li>
                <b>带名称的标记</b>：当前时间附近的历史事件。左上角"此时期"列出全部可见内容，点击可查看来源。
              </li>
            </ul>
          </section>
          <section>
            <h3>时间轴怎么看</h3>
            <ul>
              <li>
                <b>顶部刻度</b>：真实年代。1 万年以内用公元纪年（"前500" = 公元前 500 年），更早用 ka（千年）/ Ma（百万年）/ Ga（十亿年）。
              </li>
              <li>
                <b>宙 · 代 · 纪 · 世</b>四条色带：国际地层委员会（ICS 2024/12）的地质年代，从粗到细逐级嵌套，颜色为国际标准配色。缩放不够时只显示宙、代，放大后出现纪、世。
              </li>
              <li>
                <b>菱形点</b>一行：关键历史事件，横条表示持续一段时间的事件。点击即跳转到该时间。
              </li>
              <li>
                <b>金色竖线</b>：当前时间。超出视野时在边缘显示箭头。
              </li>
            </ul>
            <div className="help-legend">
              {Object.entries(CATEGORY_STYLE).map(([k, v]) => (
                <span key={k}>
                  <span className="tl-dot" style={{ background: v.color }} />
                  {v.label}
                </span>
              ))}
            </div>
          </section>
          <section>
            <h3>时间轴操作</h3>
            <ul>
              <li>在刻度或事件行上拖动 / 点击：定位时间</li>
              <li>滚轮：缩放时间轴（不影响地球视角）</li>
              <li>拖动色带或 Shift + 滚轮：平移</li>
              <li>点击某个年代色块：缩放到该时期</li>
              <li>聚焦时间轴后：← → 单步，+ − 缩放</li>
            </ul>
          </section>
          <section>
            <h3>关于刻度</h3>
            <p>
              默认的"分段压缩"刻度在 538.8 Ma、66 Ma、2.58 Ma、11.7 ka 处改变比例（虚线标出），否则 45 亿年中人类历史只占不到一个像素。各段的视觉长度不代表真实时间间隔；可在设置面板切换为"线性"查看真实比例。
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
