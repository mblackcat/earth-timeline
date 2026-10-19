import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3, type Group } from "three";
import type { HistoricalEvent, PaleoPointsFile } from "../../data/schema";
import { useGeographyStore } from "../../state/geographyStore";
import { usePaleoPointsStore, useSceneStore } from "../../state/sceneStore";
import { eventPositionInFrame } from "../../simulation/paleoPositions";
import { currentPaleoFrame } from "../../state/paleoFrame";
import { useSelectionStore } from "../../state/selectionStore";
import type { EventEmphasis } from "../../simulation/VisibilityResolver";
import { lonLatToXYZ } from "../../utils/geo";
import { INK } from "../Ink/inkPalette";

const MARKER_RADIUS = 1.006;
/** 标记所在法线与视线夹角的余弦低于该值时隐藏（转到地球背面）。 */
const HIDE_BELOW_DOT = 0.12;

function Marker({ event, emphasis, paleo }: { event: HistoricalEvent; emphasis: EventEmphasis; paleo: PaleoPointsFile | null }) {
  const groupRef = useRef<Group>(null);
  const normal = useRef(new Vector3());
  const elRef = useRef<HTMLDivElement>(null);
  const selectedId = useSelectionStore((s) => s.selectedEventId);
  const selectEvent = useSelectionStore((s) => s.selectEvent);
  // 纸面标签用墨色；灾变 / 灭绝类用红笔
  const color = event.category === "extinction" ? INK.mark : INK.ink;
  const tmp = useRef(new Vector3());

  // 随板块漂移移动；背面隐藏直接改 DOM 样式，不触发 React 渲染。
  useFrame(({ camera }) => {
    const el = elRef.current;
    const g = groupRef.current;
    if (!el || !g) return;
    const ll = eventPositionInFrame(event, currentPaleoFrame(), paleo);
    if (ll) {
      g.position.set(...lonLatToXYZ(ll[0], ll[1], MARKER_RADIUS));
      normal.current.copy(g.position).normalize();
    }
    const toCam = tmp.current.copy(camera.position).sub(normal.current).normalize();
    const visible = !!ll && normal.current.dot(toCam) > HIDE_BELOW_DOT;
    el.style.visibility = visible ? "visible" : "hidden";
  });

  return (
    <group ref={groupRef}>
      <Html center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
        <div ref={elRef} className={`event-marker ${emphasis}${selectedId === event.id ? " selected" : ""}`} style={{ color, visibility: "hidden" }}>
          <button
            type="button"
            className="event-marker-btn"
            data-testid={`marker-${event.id}`}
            data-emphasis={emphasis}
            onClick={() => selectEvent(event.id)}
            title={`${event.title}（点击查看详情）`}
          >
            <span className="event-marker-dot" style={{ background: color }} />
            <span className="event-marker-label">{event.title}</span>
          </button>
        </div>
      </Html>
    </group>
  );
}

/** 当前时间附近的历史事件在地球上的标记（有位置的事件，按当前地理切片的参考系放置）。全球事件显示在场景左上角列表中。 */
export function EventMarkers() {
  const events = useSceneStore((s) => s.visible.events);
  const paleo = usePaleoPointsStore((s) => s.data);
  // 切片变化时重新判断哪些事件可以标注
  useGeographyStore((s) => s.slice);
  const frame = currentPaleoFrame();
  return (
    <group name="event-markers">
      {events.map(({ event, emphasis }) =>
        // 与海岸线同一参考系；该切片内没有重建位置时不在地球上标注（仍出现在"此时期"列表中）
        eventPositionInFrame(event, frame, paleo) ? <Marker key={event.id} event={event} emphasis={emphasis} paleo={paleo} /> : null,
      )}
    </group>
  );
}
