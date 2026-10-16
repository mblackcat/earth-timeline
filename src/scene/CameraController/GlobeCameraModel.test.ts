import {
  DEFAULT_VIEW,
  MAX_ALTITUDE,
  MIN_ALTITUDE,
  applyOrbit,
  applyPan,
  applyZoom,
  computePose,
  maxTiltForAltitude,
  smoothStep,
  surfaceAltitude,
  wrapLon,
  type GlobeCameraState,
} from "./GlobeCameraModel";

const base: GlobeCameraState = { lon: 0, lat: 0, altitude: 2, heading: 0, tilt: 0 };

describe("zoom", () => {
  it("is clamped to [MIN_ALTITUDE, MAX_ALTITUDE]", () => {
    let s = base;
    for (let i = 0; i < 200; i++) s = applyZoom(s, -300);
    expect(s.altitude).toBeCloseTo(MIN_ALTITUDE, 12);
    for (let i = 0; i < 200; i++) s = applyZoom(s, 300);
    expect(s.altitude).toBeCloseTo(MAX_ALTITUDE, 12);
  });

  it("changes altitude proportionally, so a wheel step never jumps near the surface", () => {
    const near = applyZoom({ ...base, altitude: 0.05 }, -100);
    const far = applyZoom({ ...base, altitude: 4 }, -100);
    expect(near.altitude / 0.05).toBeCloseTo(far.altitude / 4, 12);
    expect(near.altitude / 0.05).toBeGreaterThan(0.8);
  });
});

describe("pan", () => {
  it("drags the ground: dragging right moves the view west, dragging down moves it north", () => {
    expect(applyPan(base, 100, 0, 800, 45).lon).toBeLessThan(0);
    expect(applyPan(base, 0, 100, 800, 45).lat).toBeGreaterThan(0);
  });

  it("moves less per pixel when closer to the surface", () => {
    const far = applyPan({ ...base, altitude: 2 }, 100, 0, 800, 45);
    const near = applyPan({ ...base, altitude: 0.05 }, 100, 0, 800, 45);
    expect(Math.abs(near.lon)).toBeLessThan(Math.abs(far.lon) / 10);
  });

  it("respects heading: with heading 180° the directions invert", () => {
    const s = applyPan({ ...base, heading: Math.PI }, 100, 0, 800, 45);
    expect(s.lon).toBeGreaterThan(0);
  });

  it("clamps latitude and wraps longitude", () => {
    expect(applyPan(base, 0, 1e6, 800, 45).lat).toBeLessThanOrEqual(89);
    expect(wrapLon(190)).toBeCloseTo(-170);
    expect(wrapLon(-190)).toBeCloseTo(170);
  });
});

describe("tilt", () => {
  it("is not allowed at global altitude and allowed near the surface", () => {
    expect(maxTiltForAltitude(2)).toBe(0);
    expect(applyOrbit(base, 0, 400, 800).tilt).toBe(0);
    expect(applyOrbit({ ...base, altitude: 0.05 }, 0, 400, 800).tilt).toBeGreaterThan(0);
  });
});

describe("tilt vs. minimum altitude", () => {
  it("never lets tilting bring the camera below MIN_ALTITUDE", () => {
    for (let alt = MIN_ALTITUDE; alt < 1; alt *= 1.2) {
      const s = applyOrbit({ ...base, lat: 30, altitude: alt }, 0, 10_000, 800);
      expect(surfaceAltitude(computePose(s))).toBeGreaterThanOrEqual(MIN_ALTITUDE * 0.999);
    }
  });
});

describe("computePose", () => {
  it("places the camera above the target at the given altitude and looks at it", () => {
    const pose = computePose({ ...base, lon: 90, altitude: 1.5 });
    expect(pose.target[0]).toBeCloseTo(1);
    expect(pose.position[0]).toBeCloseTo(2.5);
    expect(surfaceAltitude(pose)).toBeCloseTo(1.5);
  });

  it("keeps the camera above the surface for every allowed tilt", () => {
    for (let alt = MIN_ALTITUDE; alt < 1; alt *= 1.3) {
      const pose = computePose({ ...base, lat: 40, altitude: alt, tilt: maxTiltForAltitude(alt) });
      expect(surfaceAltitude(pose)).toBeGreaterThan(0);
      // up 向量与视线方向正交
      const view = pose.target.map((t, i) => t - pose.position[i]!);
      const dot = view.reduce((acc, v, i) => acc + v * pose.up[i]!, 0);
      expect(Math.abs(dot)).toBeLessThan(1e-9);
    }
  });
});

describe("smoothStep", () => {
  it("converges to the target without overshoot and takes the short way across the antimeridian", () => {
    let s: GlobeCameraState = { ...base, lon: 170 };
    const target: GlobeCameraState = { ...DEFAULT_VIEW, lon: -170 };
    let minAbsLon = 180;
    for (let i = 0; i < 200; i++) {
      s = smoothStep(s, target, 1 / 60);
      minAbsLon = Math.min(minAbsLon, Math.abs(s.lon));
    }
    expect(s.lon).toBeCloseTo(-170, 3);
    expect(s.altitude).toBeCloseTo(DEFAULT_VIEW.altitude, 3);
    expect(minAbsLon).toBeGreaterThan(160); // 没有绕经 0°
  });
});
