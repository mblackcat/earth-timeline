import { EARTH_RADIUS, lonLatToXYZ } from "../../utils/geo";

/**
 * 球面相机模型（纯数学，不依赖 Three/React，便于测试）。
 *
 * 相机状态以"注视的地表点 + 距离 + 朝向 + 倾斜"描述：
 *   - lon/lat：屏幕中心注视的地表点
 *   - altitude：相机到该地表点的距离（地球半径为单位）
 *   - heading：绕地表法线的朝向（弧度，0 = 正北朝上）
 *   - tilt：相对地表法线的倾斜（弧度，0 = 垂直俯视）
 *
 * 这样旋转 / 平移 / 缩放都是在同一个连续模型里进行，不会让旋转中心偏离球心。
 */
export interface GlobeCameraState {
  lon: number;
  lat: number;
  altitude: number;
  heading: number;
  tilt: number;
}

export const MIN_ALTITUDE = 0.02; // ≈127 km，L3 上沿；L4 待局部坐标系（TASKS R1）
export const MAX_ALTITUDE = 6;
export const MAX_LAT = 89;
const MAX_TILT = (70 * Math.PI) / 180;

export const DEFAULT_VIEW: GlobeCameraState = { lon: 20, lat: 15, altitude: 2.4, heading: 0, tilt: 0 };
export const GLOBAL_ALTITUDE = 2.4;

const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * 倾斜上限随高度变化：全球视角不允许倾斜，接近地表时最多 70°。
 * 同时保证倾斜后相机离地高度（≥ altitude·cos(tilt)）不低于 MIN_ALTITUDE。
 */
export function maxTiltForAltitude(altitude: number): number {
  const byAltitude = MAX_TILT * clamp((1 - altitude) / 0.8, 0, 1);
  const byGround = Math.acos(clamp(MIN_ALTITUDE / altitude, 0, 1));
  return Math.min(byAltitude, byGround);
}

export function normalizeState(s: GlobeCameraState): GlobeCameraState {
  const altitude = clamp(s.altitude, MIN_ALTITUDE, MAX_ALTITUDE);
  return {
    lon: wrapLon(s.lon),
    lat: clamp(s.lat, -MAX_LAT, MAX_LAT),
    altitude,
    heading: s.heading,
    tilt: clamp(s.tilt, 0, maxTiltForAltitude(altitude)),
  };
}

/** 每像素对应的地表角度（度）。与高度成正比，保证近景拖动不会"飞走"。 */
export function degreesPerPixel(altitude: number, viewportHeight: number, fovDeg: number): number {
  const visibleSpan = 2 * Math.min(altitude, 3) * Math.tan((fovDeg * DEG) / 2);
  return visibleSpan / DEG / Math.max(1, viewportHeight);
}

/** 抓取式平移：把地表沿拖动方向拖走。 */
export function applyPan(
  s: GlobeCameraState,
  dxPx: number,
  dyPx: number,
  viewportHeight: number,
  fovDeg: number,
): GlobeCameraState {
  const k = degreesPerPixel(s.altitude, viewportHeight, fovDeg);
  // 注视点向拖动的反方向移动。屏幕右方在地面上为 east·cos h − north·sin h，
  // 屏幕上方为 north·cos h + east·sin h。
  const cos = Math.cos(s.heading);
  const sin = Math.sin(s.heading);
  const east = (-dxPx * cos + dyPx * sin) * k;
  const north = (dxPx * sin + dyPx * cos) * k;
  const lonScale = 1 / Math.max(0.2, Math.cos(s.lat * DEG));
  return normalizeState({ ...s, lon: s.lon + east * lonScale, lat: s.lat + north });
}

/** 对数缩放：每个滚轮步长按比例改变高度，近景与远景手感一致、无跳变。 */
export function applyZoom(s: GlobeCameraState, wheelDelta: number, sensitivity = 0.0015): GlobeCameraState {
  return normalizeState({ ...s, altitude: s.altitude * Math.exp(wheelDelta * sensitivity) });
}

export function applyOrbit(s: GlobeCameraState, dxPx: number, dyPx: number, viewportHeight: number): GlobeCameraState {
  const k = Math.PI / Math.max(1, viewportHeight);
  return normalizeState({ ...s, heading: s.heading - dxPx * k, tilt: s.tilt + dyPx * k });
}

/** 指数平滑：current 趋向 target。高度在对数空间插值，经度走最短路径。 */
export function smoothStep(current: GlobeCameraState, target: GlobeCameraState, dtSeconds: number, rate = 10): GlobeCameraState {
  const a = 1 - Math.exp(-rate * dtSeconds);
  const dLon = wrapLon(target.lon - current.lon);
  const logAlt = Math.log(current.altitude) + (Math.log(target.altitude) - Math.log(current.altitude)) * a;
  return {
    lon: wrapLon(current.lon + dLon * a),
    lat: current.lat + (target.lat - current.lat) * a,
    altitude: Math.exp(logAlt),
    heading: current.heading + (target.heading - current.heading) * a,
    tilt: current.tilt + (target.tilt - current.tilt) * a,
  };
}

export function statesClose(a: GlobeCameraState, b: GlobeCameraState): boolean {
  return (
    Math.abs(wrapLon(a.lon - b.lon)) < 1e-4 &&
    Math.abs(a.lat - b.lat) < 1e-4 &&
    Math.abs(Math.log(a.altitude / b.altitude)) < 1e-4 &&
    Math.abs(a.heading - b.heading) < 1e-5 &&
    Math.abs(a.tilt - b.tilt) < 1e-5
  );
}

type Vec3 = [number, number, number];

const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  up: Vec3;
}

/** 由状态计算相机位置、注视点和上方向。 */
export function computePose(s: GlobeCameraState): CameraPose {
  const target = lonLatToXYZ(s.lon, s.lat, EARTH_RADIUS);
  const normal = norm(target);
  const east = norm(cross([0, 1, 0], normal));
  const north = cross(normal, east);
  // heading 旋转后的"前方"（屏幕上方）方向。
  const ch = Math.cos(s.heading);
  const sh = Math.sin(s.heading);
  const forward: Vec3 = [
    north[0] * ch + east[0] * sh,
    north[1] * ch + east[1] * sh,
    north[2] * ch + east[2] * sh,
  ];
  const ct = Math.cos(s.tilt);
  const st = Math.sin(s.tilt);
  const offset: Vec3 = [
    (normal[0] * ct - forward[0] * st) * s.altitude,
    (normal[1] * ct - forward[1] * st) * s.altitude,
    (normal[2] * ct - forward[2] * st) * s.altitude,
  ];
  const up: Vec3 = [
    forward[0] * ct + normal[0] * st,
    forward[1] * ct + normal[1] * st,
    forward[2] * ct + normal[2] * st,
  ];
  return {
    position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]],
    target,
    up,
  };
}

/** 相机到地表的高度（用于决定空间层级）。 */
export function surfaceAltitude(pose: CameraPose): number {
  return Math.hypot(...pose.position) - EARTH_RADIUS;
}
