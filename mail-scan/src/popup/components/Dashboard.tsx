import { useState, useEffect } from "react";
import { sendMessage } from "@shared/messaging";
import { MSG } from "@shared/constants";
import type { AnalysisMode, AIProvider, AnalysisResult } from "@shared/types";
import AnalysisModeSelector from "./AnalysisModeSelector";
import AIProviderConfig from "./AIProviderConfig";
import LoggingConfig from "./LoggingConfig";
import ScanButton from "./ScanButton";
import AnalysisResults from "./AnalysisResults";

interface Props {
  onLock: () => void;
}

export default function Dashboard({ onLock }: Props) {
  const [mode, setMode] = useState<AnalysisMode>("basic");
  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [loggingEnabled, setLoggingEnabled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sendMessage(MSG.GET_SETTINGS, {}).then((res) => {
      setMode(res.settings.analysisMode);
      setProvider(res.settings.aiProvider);
      setLoggingEnabled(res.settings.loggingEnabled);
    });
  }, []);

  function persistSettings(
    newMode?: AnalysisMode,
    newProvider?: AIProvider,
    newLogging?: boolean,
  ) {
    const settings = {
      analysisMode: newMode ?? mode,
      aiProvider: newProvider ?? provider,
      loggingEnabled: newLogging ?? loggingEnabled,
    };
    sendMessage(MSG.SAVE_SETTINGS, { settings });
  }

  function handleModeChange(m: AnalysisMode) {
    setMode(m);
    persistSettings(m);
  }

  function handleProviderChange(p: AIProvider) {
    setProvider(p);
    persistSettings(undefined, p);
  }

  function handleLoggingToggle(enabled: boolean) {
    setLoggingEnabled(enabled);
    persistSettings(undefined, undefined, enabled);
  }

  function handleLock() {
    sendMessage(MSG.LOCK_VAULT, {});
    onLock();
  }

  return (
    <div className="app">
      <div className="header">
        <h1>Mail Scan</h1>
        <button className="lock-btn" onClick={handleLock}>
          Lock
        </button>
      </div>

      <AnalysisModeSelector mode={mode} onChange={handleModeChange} />

      {mode === "advanced" && (
        <AIProviderConfig
          provider={provider}
          onProviderChange={handleProviderChange}
        />
      )}

      <LoggingConfig
        enabled={loggingEnabled}
        onToggle={handleLoggingToggle}
      />

      <ScanButton
        mode={mode}
        provider={provider}
        scanning={scanning}
        onScanStart={() => {
          setScanning(true);
          setResult(null);
          setError(null);
        }}
        onScanComplete={(r) => {
          setResult(r);
          setScanning(false);
        }}
        onScanError={(e) => {
          setError(e);
          setScanning(false);
        }}
      />

      <AnalysisResults result={result} error={error} />
    </div>
  );
}
