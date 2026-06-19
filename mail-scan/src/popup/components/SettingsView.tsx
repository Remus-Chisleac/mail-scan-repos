import type { AnalysisMode, AIProvider } from "@shared/types";
import AnalysisModeSelector from "./AnalysisModeSelector";
import AIProviderConfig from "./AIProviderConfig";
import LoggingConfig from "./LoggingConfig";

interface Props {
  mode: AnalysisMode;
  provider: AIProvider;
  loggingEnabled: boolean;
  onModeChange: (mode: AnalysisMode) => void;
  onProviderChange: (provider: AIProvider) => void;
  onLoggingToggle: (enabled: boolean) => void;
  onClose: () => void;
}

export default function SettingsView({
  mode,
  provider,
  loggingEnabled,
  onModeChange,
  onProviderChange,
  onLoggingToggle,
  onClose,
}: Props) {
  return (
    <div className="app">
      <div className="header header-nav">
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Back"
          title="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <h1>Settings</h1>
      </div>

      <AnalysisModeSelector mode={mode} onChange={onModeChange} />

      {mode === "advanced" && (
        <AIProviderConfig
          provider={provider}
          onProviderChange={onProviderChange}
        />
      )}

      <LoggingConfig enabled={loggingEnabled} onToggle={onLoggingToggle} />
    </div>
  );
}
