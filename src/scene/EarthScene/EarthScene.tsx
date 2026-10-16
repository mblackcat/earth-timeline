import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useSettingsStore } from "../../state/settingsStore";
import { GlobeCameraController } from "../CameraController/GlobeCameraController";
import { GeographyOutlines } from "../Terrain/GeographyOutlines";
import { PALETTE } from "../Wireframe/palette";
import { Atmosphere, Globe } from "./Globe";
import { Graticule } from "./Graticule";

export function EarthScene() {
  const showGraticule = useSettingsStore((s) => s.showGraticule);
  const showOutlines = useSettingsStore((s) => s.showOutlines);

  return (
    <Canvas
      className="earth-canvas"
      data-testid="earth-canvas"
      dpr={[1, 2]}
      camera={{ fov: 45, near: 0.01, far: 100, position: [0, 0, 3.4] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[PALETTE.background]} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 3, 5]} intensity={1.4} />
      <Stars radius={60} depth={20} count={2500} factor={2} fade speed={0} />
      <Globe />
      <Atmosphere />
      {showGraticule && <Graticule />}
      {showOutlines && <GeographyOutlines />}
      <GlobeCameraController />
    </Canvas>
  );
}
