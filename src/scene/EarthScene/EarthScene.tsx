import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useSettingsStore } from "../../state/settingsStore";
import { GlobeCameraController } from "../CameraController/GlobeCameraController";
import { GeographyOutlines } from "../Terrain/GeographyOutlines";
import { EventMarkers } from "../Living/EventMarkers";
import { FossilSites } from "../Living/FossilSites";
import { GlobeCreatures } from "../Living/GlobeCreatures";
import { PALETTE } from "../Wireframe/palette";
import { Atmosphere, Globe } from "./Globe";
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
    >
      <color attach="background" args={[PALETTE.background]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} />
      {!lowPerformance && <Stars radius={60} depth={20} count={2500} factor={2} fade speed={0} />}
      <Globe />
      <Atmosphere />
      {showGraticule && <Graticule />}
      {showOutlines && <GeographyOutlines />}
      <FossilSites />
      <GlobeCreatures />
      <EventMarkers />
      <GlobeCameraController />
    </Canvas>
  );
}
