import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { CATEGORY_STYLE } from "../../components/Timeline/categories";
import type { HistoricalEvent, LonLat } from "../../data/schema";
import { useGeographyStore } from "../../state/geographyStore";
import { usePaleoPointsStore, useSceneStore } from "../../state/sceneStore";
import { eventPositionInFrame, frameFor } from "../../simulation/paleoPositions";
import { useSelectionStore } from "../../state/selectionStore";
import type { EventEmphasis } from "../../simulation/VisibilityResolver";
import { lonLatToXYZ } from "../../utils/geo";

const MARKER_RADIUS = 1.006;
/** 标记所在法线与视线夹角的余弦低于该值时隐藏（转到地球背面）。 */
const HIDE_BELOW_DOT = 0.12;

function Marker({ event, emphasis, lonLat }: { event: HistoricalEvent; emphasis: EventEmphasis; lonLat: LonLat }) {
  const position = lonLatToXYZ(lonLat[0], lonLat[1], MARKER_RADIUS);
  const normal = new Vector3(...position).normalize();
  const elRef = useRef<HTMLDivElement>(null);
  const selectedId = useSelectionStore((s) => s.selectedEventId);
  const selectEvent = useSelectionStore((s) => s.selectEvent);
  const color = CATEGORY_STYLE[event.category].color;
  const tmp = useRef(new Vector3());

  // 背面隐藏：直接改 DOM 样式，不触发 React 渲染。
  useFrame(({ camera }) => {
    const el = elRef.current;
    if (!el) return;
    const toCam = tmp.current.copy(camera.position).sub(normal).normalize();
    const visible = normal.dot(toCam) > HIDE_BELOW_DOT;
    el.style.visibility = visible ? "visible" : "hidden";
  });

  return (
    <Html position={position} center zIndexRange={[20, 10]} style={{ pointerEvents: "none" }}>
      <div ref={elRef} className={`event-marker ${emphasis}${selectedId === event.id ? " selected" : ""}`} style={{ color }}>
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
  );
}

/** 当前时间附近的历史事件在地球上的标记（有位置的事件，按当前地理切片的参考系放置）。全球事件显示在场景左上角列表中。 */
export function EventMarkers() {
  const events = useSceneStore((s) => s.visible.events);
  const paleo = usePaleoPointsStore((s) => s.data);
  const reconstructionMa = useGeographyStore((s) => s.slice?.reconstructionMa);
  const frame = frameFor(reconstructionMa);
  return (
    <group name="event-markers">
      {events.map(({ event, emphasis }) => {
        // 与海岸线同一参考系；该年代没有重建位置时不在地球上标注（仍出现在"此时期"列表中）
        const lonLat = eventPositionInFrame(event, frame, paleo);
        return lonLat ? <Marker key={`${event.id}@${lonLat.join(",")}`} event={event} emphasis={emphasis} lonLat={lonLat} /> : null;
      })}
    </group>
  );
}
