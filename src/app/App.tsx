import { useEffect } from "react";
import { TopBar } from "../components/TopBar/TopBar";
import { SettingsPanel } from "../components/SettingsPanel/SettingsPanel";
import { TimelinePlaceholder } from "../components/Timeline/TimelinePlaceholder";
import { paleoGeographyProvider } from "../data/geology";
import { EarthScene } from "../scene/EarthScene/EarthScene";
import { GeographyCaption } from "../scene/EarthScene/GeographyCaption";
import { startGeographySync } from "../state/geographyStore";
import { useSettingsStore } from "../state/settingsStore";
import { ErrorBoundary } from "./ErrorBoundary";

export function App() {
  const panelOpen = useSettingsStore((s) => s.panelOpen);

  useEffect(() => startGeographySync(paleoGeographyProvider), []);

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
      </main>
      <SettingsPanel />
      <TimelinePlaceholder />
    </div>
  );
}
