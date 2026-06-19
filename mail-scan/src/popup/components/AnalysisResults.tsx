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

  const riskCopy: Record<string, string> = {
    low: "Looks safe",
    medium: "Be cautious",
    high: "Likely phishing",
  };

  return (
    <div className="card results">
      <div className={`risk-hero ${basicAnalysis.riskLevel}`}>
        <div className="risk-hero-gauge">
          <span className="risk-hero-score">{basicAnalysis.score}</span>
          <span className="risk-hero-max">/100</span>
        </div>
        <div className="risk-hero-text">
          <span className="risk-hero-headline">
            {riskCopy[basicAnalysis.riskLevel] ?? basicAnalysis.riskLevel}
          </span>
          <span className="risk-hero-sub">
            {basicAnalysis.riskLevel} risk &middot; scanned{" "}
            {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="email-meta">
        <div className="email-meta-subject">{emailMeta.subject || "(no subject)"}</div>
        <div className="email-meta-sender">{emailMeta.sender || "Unknown sender"}</div>
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
