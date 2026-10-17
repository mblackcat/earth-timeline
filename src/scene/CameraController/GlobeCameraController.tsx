import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { PerspectiveCamera, Ray, Sphere, Vector2, Vector3, Raycaster } from "three";
import { useViewStore, type CameraCommand } from "../../state/viewStore";
import { EARTH_RADIUS, altitudeToLevel, xyzToLonLat } from "../../utils/geo";
import {
  DEFAULT_VIEW,
  GLOBAL_ALTITUDE,
  applyOrbit,
  applyPan,
  applyZoom,
  computePose,
  normalizeState,
  smoothStep,
  statesClose,
  surfaceAltitude,
  type GlobeCameraState,
} from "./GlobeCameraModel";

const PUBLISH_INTERVAL_MS = 100;

/** 定位到地表某点时的默认高度（约 4,500 km，L0/L1 之间，能看到周边大陆）。 */
export const FOCUS_ALTITUDE = 0.7;

function commandTarget(cmd: CameraCommand, current: GlobeCameraState): GlobeCameraState {
  if (cmd.kind === "default") return { ...DEFAULT_VIEW };
  if (cmd.kind === "focus" && cmd.target) {
    const { lon, lat, altitude = FOCUS_ALTITUDE } = cmd.target;
    return normalizeState({ ...current, lon, lat, altitude, heading: 0, tilt: 0 });
  }
  // 返回全球视角：保留当前注视的经纬度，只拉远并取消倾斜/旋转。
  return normalizeState({ ...current, altitude: GLOBAL_ALTITUDE, heading: 0, tilt: 0 });
}

/**
 * 地球相机控制：
 *   左键拖动 = 抓取平移（全球视角下表现为旋转地球）
 *   右键 / Shift+左键拖动 = 旋转朝向与倾斜（近地表时可用）
 *   滚轮 / 触控板捏合 = 按高度比例缩放
 *   双击地表 = 飞向该点并拉近
 */
export function GlobeCameraController() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const dom = useThree((s) => s.gl.domElement);
  const target = useRef<GlobeCameraState>({ ...DEFAULT_VIEW });
  const current = useRef<GlobeCameraState>({ ...DEFAULT_VIEW });
  const lastPublish = useRef(0);
  const lastCommandId = useRef(useViewStore.getState().command?.id ?? 0);

  useEffect(() => {
    return useViewStore.subscribe((s) => {
      const cmd = s.command;
      if (!cmd || cmd.id === lastCommandId.current) return;
      lastCommandId.current = cmd.id;
      target.current = commandTarget(cmd, target.current);
    });
  }, []);

  useEffect(() => {
    const pointers = new Map<number, { x: number; y: number }>();
    let mode: "pan" | "orbit" | null = null;
    let pinchDistance = 0;

    const height = () => dom.clientHeight || 1;

    const onPointerDown = (e: PointerEvent) => {
      dom.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDistance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        mode = null;
      } else {
        mode = e.button === 2 || e.shiftKey || e.ctrlKey ? "orbit" : "pan";
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinchDistance > 0 && d > 0) {
          target.current = normalizeState({ ...target.current, altitude: target.current.altitude * (pinchDistance / d) });
        }
        pinchDistance = d;
        return;
      }
      if (mode === "pan") target.current = applyPan(target.current, dx, dy, height(), camera.fov);
      else if (mode === "orbit") target.current = applyOrbit(target.current, dx, dy, height());
    };

    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
      if (pointers.size === 0) mode = null;
      pinchDistance = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16; // 按行滚动
      if (e.ctrlKey) delta *= 4; // 触控板捏合手势的增量较小
      delta = Math.max(-300, Math.min(300, delta));
      target.current = applyZoom(target.current, delta);
    };

    const raycaster = new Raycaster();
    const sphere = new Sphere(new Vector3(), EARTH_RADIUS);
    const onDoubleClick = (e: MouseEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = (raycaster.ray as Ray).intersectSphere(sphere, new Vector3());
      if (!hit) return;
      const [lon, lat] = xyzToLonLat(hit.x, hit.y, hit.z);
      target.current = normalizeState({ ...target.current, lon, lat, altitude: target.current.altitude * 0.5 });
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("dblclick", onDoubleClick);
    dom.addEventListener("contextmenu", onContextMenu);
    return () => {
      dom.removeEventListener("pointerdown", onPointerDown);
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerup", onPointerUp);
      dom.removeEventListener("pointercancel", onPointerUp);
      dom.removeEventListener("wheel", onWheel);
      dom.removeEventListener("dblclick", onDoubleClick);
      dom.removeEventListener("contextmenu", onContextMenu);
    };
  }, [camera, dom]);

  useFrame((state, dt) => {
    const cam = state.camera as PerspectiveCamera;
    // 限制 dt，避免标签页切回时一次性跳到目标。
    const step = Math.min(dt, 0.1);
    current.current = statesClose(current.current, target.current)
      ? target.current
      : smoothStep(current.current, target.current, step);

    const pose = computePose(current.current);
    cam.position.set(...pose.position);
    cam.up.set(...pose.up);
    cam.lookAt(...pose.target);

    // 动态近/远裁剪面，保证近景深度精度（线框与球面不发生 z-fighting）。
    const alt = surfaceAltitude(pose);
    const near = Math.max(0.0005, alt * 0.25);
    const far = 200; // 深度精度主要由 near 决定；far 需容纳星空背景
    if (Math.abs(cam.near - near) > near * 0.01 || cam.far !== far) {
      cam.near = near;
      cam.far = far;
      cam.updateProjectionMatrix();
    }

    const now = performance.now();
    if (now - lastPublish.current > PUBLISH_INTERVAL_MS) {
      lastPublish.current = now;
      const view = useViewStore.getState();
      const level = altitudeToLevel(alt);
      const next = { altitude: alt, level, lon: current.current.lon, lat: current.current.lat };
      if (
        view.level !== level ||
        Math.abs(view.altitude - alt) > alt * 0.001 ||
        Math.abs(view.lon - next.lon) > 0.01 ||
        Math.abs(view.lat - next.lat) > 0.01
      ) {
        view.setView(next);
      }
    }
  });

  return null;
}
