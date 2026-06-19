import { useState, useEffect } from "react";
import { sendMessage } from "@shared/messaging";
import { MSG } from "@shared/constants";
import type { AnalysisMode, AIProvider } from "@shared/types";
import MainView from "./components/MainView";
import SettingsView from "./components/SettingsView";

type View = "main" | "settings";

export default function App() {
  const [view, setView] = useState<View>("main");
  const [mode, setMode] = useState<AnalysisMode>("basic");
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [loggingEnabled, setLoggingEnabled] = useState(false);

  useEffect(() => {
    sendMessage(MSG.GET_SETTINGS, {}).then((res) => {
      setMode(res.settings.analysisMode);
      setProvider(res.settings.aiProvider);
      setLoggingEnabled(res.settings.loggingEnabled);
    });
  }, []);

  function persist(next: Partial<{
    mode: AnalysisMode;
    provider: AIProvider;
    loggingEnabled: boolean;
  }>) {
    sendMessage(MSG.SAVE_SETTINGS, {
      settings: {
        analysisMode: next.mode ?? mode,
        aiProvider: next.provider ?? provider,
        loggingEnabled: next.loggingEnabled ?? loggingEnabled,
      },
    });
  }

  function handleModeChange(m: AnalysisMode) {
    setMode(m);
    persist({ mode: m });
  }

  function handleProviderChange(p: AIProvider) {
    setProvider(p);
    persist({ provider: p });
  }

  function handleLoggingToggle(enabled: boolean) {
    setLoggingEnabled(enabled);
    persist({ loggingEnabled: enabled });
  }

  if (view === "settings") {
    return (
      <SettingsView
        mode={mode}
        provider={provider}
        loggingEnabled={loggingEnabled}
        onModeChange={handleModeChange}
        onProviderChange={handleProviderChange}
        onLoggingToggle={handleLoggingToggle}
        onClose={() => setView("main")}
      />
    );
  }

  return (
    <MainView
      mode={mode}
      provider={provider}
      onOpenSettings={() => setView("settings")}
    />
  );
}
