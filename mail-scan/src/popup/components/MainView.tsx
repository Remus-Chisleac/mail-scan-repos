import { useState } from "react";
import type { AnalysisMode, AIProvider, AnalysisResult } from "@shared/types";
import ScanButton from "./ScanButton";
import AnalysisResults from "./AnalysisResults";

interface Props {
  mode: AnalysisMode;
  provider: AIProvider;
  onOpenSettings: () => void;
}

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Gemini",
  chatgpt: "ChatGPT",
  claude: "Claude",
  custom: "Custom",
};

export default function MainView({ mode, provider, onOpenSettings }: Props) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modeLabel =
    mode === "advanced"
      ? `Advanced · ${PROVIDER_LABELS[provider]} + local heuristics`
      : "Basic · local heuristics";

  return (
    <div className="app">
      <div className="header">
        <h1>Mail Scan</h1>
        <button
          className="icon-btn"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>

      <div className="scan-panel">
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
        <button className="mode-pill" onClick={onOpenSettings} title="Change in Settings">
          {modeLabel}
        </button>
      </div>

      <AnalysisResults result={result} error={error} />
    </div>
  );
}
