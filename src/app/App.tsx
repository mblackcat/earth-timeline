import { useEffect } from "react";
import { TopBar } from "../components/TopBar/TopBar";
import { SettingsPanel } from "../components/SettingsPanel/SettingsPanel";
import { PlaybackBar } from "../components/Timeline/PlaybackBar";
import { Timeline } from "../components/Timeline/Timeline";
import { paleoGeographyProvider } from "../data/geology";
import { EarthScene } from "../scene/EarthScene/EarthScene";
import { GeographyCaption } from "../scene/EarthScene/GeographyCaption";
import { startTimeRuntime } from "../timeline/runtime";
import { loadReferenceCoastline, startGeographySync } from "../state/geographyStore";
import { PALEO_SLICES } from "../data/geology/slices";
import { loadFossilSites, loadPaleoPoints, startVisibilitySync } from "../state/sceneStore";
import { PALEO_POINTS_URL } from "../data/geology/reconstruction";
import { fetchStaticJson } from "../data/fetchStatic";
import { NowPanel } from "../components/Scene/NowPanel";
import { DetailsCard } from "../components/Scene/DetailsCard";
import { useSettingsStore } from "../state/settingsStore";
import { ErrorBoundary } from "./ErrorBoundary";

export function App() {
  const panelOpen = useSettingsStore((s) => s.panelOpen);

  useEffect(() => startTimeRuntime(), []);
  useEffect(() => startGeographySync(paleoGeographyProvider), []);
  useEffect(() => startVisibilitySync(), []);
  useEffect(() => {
    const modern = PALEO_SLICES.find((s) => s.kind === "modern-schematic");
    if (modern) void loadReferenceCoastline(paleoGeographyProvider, modern);
  }, []);
  useEffect(() => {
    void loadFossilSites(fetchStaticJson);
    void loadPaleoPoints(PALEO_POINTS_URL, fetchStaticJson);
  }, []);

  return (
    <div className={`app-shell ${panelOpen ? "panel-open" : "panel-collapsed"}`}>
      <TopBar />
      <main className="scene-region" data-testid="scene-region">
        <ErrorBoundary
          fallback={(err) => (
            <div className="scene-error" role="alert">
              <h2>3D 场景无法启动</h2>
              <p>请确认浏览器支持并启用了 WebGL。</p>
              <pre>{err.message}</pre>
            </div>
          )}
        >
          <EarthScene />
        </ErrorBoundary>
        <GeographyCaption />
        <NowPanel />
        <DetailsCard />
      </main>
      <SettingsPanel />
      <footer className="timeline-region" data-testid="timeline-region">
        <Timeline leading={<PlaybackBar />} />
      </footer>
    </div>
  );
}
