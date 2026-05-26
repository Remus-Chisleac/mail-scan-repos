import type { AnalysisResult } from "@shared/types";

interface Props {
  result: AnalysisResult | null;
  error: string | null;
}

export default function AnalysisResults({ result, error }: Props) {
  if (error) {
    return (
      <div className="card">
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  const { basicAnalysis, aiAnalysis, timestamp, emailMeta } = result;
  const topFlags = basicAnalysis.flags.slice(0, 6);
  const hiddenFlagCount = basicAnalysis.flags.length - topFlags.length;

  return (
    <div className="card results">
      <div className="email-meta">
        <div className="email-meta-subject">{emailMeta.subject || "(no subject)"}</div>
        <div className="email-meta-sender">{emailMeta.sender || "Unknown sender"}</div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 10,
        }}
      >
        <span className={`risk-badge ${basicAnalysis.riskLevel}`}>
          {basicAnalysis.riskLevel} risk &middot; {basicAnalysis.score}/100
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>

      {topFlags.length > 0 && (
        <ul className="flags-list">
          {topFlags.map((flag, i) => (
            <li key={i} className={flag.severity}>
              {flag.message}
            </li>
          ))}
          {hiddenFlagCount > 0 && (
            <li className="low">+ {hiddenFlagCount} more signal(s)</li>
          )}
        </ul>
      )}

      {basicAnalysis.flags.length === 0 && (
        <p className="hint" style={{ marginTop: 10 }}>
          No suspicious signals detected in basic analysis.
        </p>
      )}

      {aiAnalysis && (
        <div className="ai-summary">
          <h4>
            AI Assessment &middot;{" "}
            <span className={`risk-badge ${aiAnalysis.risk}`}>
              {aiAnalysis.risk}
            </span>{" "}
            ({aiAnalysis.confidence}% confidence)
          </h4>
          <ul style={{ paddingLeft: 16, marginTop: 4 }}>
            {aiAnalysis.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          {aiAnalysis.recommendation && (
            <p style={{ marginTop: 6, fontStyle: "italic" }}>
              {aiAnalysis.recommendation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
