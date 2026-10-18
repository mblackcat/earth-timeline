import { Canvas } from "@react-three/fiber";
import { useSettingsStore } from "../../state/settingsStore";
import { GlobeCameraController } from "../CameraController/GlobeCameraController";
import { GeographyOutlines } from "../Terrain/GeographyOutlines";
import { EventMarkers } from "../Living/EventMarkers";
import { FossilSites } from "../Living/FossilSites";
import { GlobeCreatures } from "../Living/GlobeCreatures";
import { INK } from "../Ink/inkPalette";
import { ToneSync } from "../Ink/ToneSync";
import { Globe, GlobeRim } from "./Globe";
import { Graticule } from "./Graticule";

export function EarthScene() {
  const showGraticule = useSettingsStore((s) => s.showGraticule);
  const showOutlines = useSettingsStore((s) => s.showOutlines);
  const lowPerformance = useSettingsStore((s) => s.lowPerformance);

  return (
    <Canvas
      className="earth-canvas"
      data-testid="earth-canvas"
      dpr={lowPerformance ? 1 : [1, 2]}
      camera={{ fov: 45, near: 0.01, far: 100, position: [0, 0, 3.4] }}
      gl={{ antialias: true }}
      flat
    >
      <color attach="background" args={[INK.paper]} />
      <ToneSync />
      <Globe />
      <GlobeRim />
      {showGraticule && <Graticule />}
      {showOutlines && <GeographyOutlines />}
      <FossilSites />
      <GlobeCreatures />
      <EventMarkers />
      <GlobeCameraController />
    </Canvas>
  );
}
