import type { AnalysisMode } from "@shared/types";

interface Props {
  mode: AnalysisMode;
  onChange: (mode: AnalysisMode) => void;
}

export default function AnalysisModeSelector({ mode, onChange }: Props) {
  return (
    <div className="card">
      <div className="card-title">Analysis Mode</div>
      <div className="form-group">
        <select
          value={mode}
          onChange={(e) => onChange(e.target.value as AnalysisMode)}
        >
          <option value="basic">Basic (Local heuristics only)</option>
          <option value="advanced">Advanced (Local + AI analysis)</option>
        </select>
      </div>
    </div>
  );
}
