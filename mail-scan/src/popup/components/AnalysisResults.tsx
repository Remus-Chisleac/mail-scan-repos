import type { AnalysisResult, RiskLevel } from "@shared/types";
import { RISK_THRESHOLDS } from "@shared/constants";

interface Props {
  result: AnalysisResult | null;
  error: string | null;
}

const RISK_COPY: Record<RiskLevel, string> = {
  low: "Looks safe",
  medium: "Be cautious",
  high: "Likely phishing",
};

function riskFromScore(score: number): RiskLevel {
  if (score <= RISK_THRESHOLDS.LOW_MAX) return "low";
  if (score <= RISK_THRESHOLDS.MEDIUM_MAX) return "medium";
  return "high";
}

/**
 * The AI returns a risk level + a confidence, not a 0-100 phishing score. Map
 * it onto the same scale as the local engine so the two are comparable: the
 * risk level picks the band, and confidence moves the value toward that band's
 * extreme (a confidently-safe verdict scores near 0, a confidently-malicious
 * one near 100).
 */
function aiScoreFromRisk(risk: RiskLevel, confidence: number): number {
  const c = Math.max(0, Math.min(100, confidence)) / 100;
  if (risk === "high") return Math.round(60 + 40 * c);
  if (risk === "low") return Math.round(RISK_THRESHOLDS.LOW_MAX * (1 - c));
  return Math.round(35 + 20 * c); // medium band, kept mid-range
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

  const aiScore = aiAnalysis
    ? aiScoreFromRisk(aiAnalysis.risk, aiAnalysis.confidence)
    : null;

  // Headline reflects the more alarming of the two analyses.
  const heroScore =
    aiScore !== null ? Math.max(basicAnalysis.score, aiScore) : basicAnalysis.score;
  const heroRisk = riskFromScore(heroScore);

  return (
    <div className="card results">
      <div className={`risk-hero ${heroRisk}`}>
        <div className="risk-hero-gauge">
          <span className="risk-hero-score">{heroScore}</span>
          <span className="risk-hero-max">/100</span>
        </div>
        <div className="risk-hero-text">
          <span className="risk-hero-headline">{RISK_COPY[heroRisk]}</span>
          <span className="risk-hero-sub">
            {aiScore !== null ? "highest of local & AI" : `${heroRisk} risk`}{" "}
            &middot; scanned {new Date(timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="email-meta">
        <div className="email-meta-subject">{emailMeta.subject || "(no subject)"}</div>
        <div className="email-meta-sender">{emailMeta.sender || "Unknown sender"}</div>
      </div>

      <div className="analysis-section">
        <div className="analysis-section-head">
          <span className="analysis-section-title">Local heuristics</span>
          <span className={`risk-badge ${basicAnalysis.riskLevel}`}>
            {basicAnalysis.riskLevel} &middot; {basicAnalysis.score}/100
          </span>
        </div>
        {topFlags.length > 0 ? (
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
        ) : (
          <p className="hint">No suspicious signals detected.</p>
        )}
      </div>

      {aiAnalysis && aiScore !== null && (
        <div className="analysis-section">
          <div className="analysis-section-head">
            <span className="analysis-section-title">AI assessment</span>
            <span className={`risk-badge ${aiAnalysis.risk}`}>
              {aiAnalysis.risk} &middot; {aiScore}/100
            </span>
          </div>
          <p className="hint" style={{ marginBottom: 2 }}>
            {aiAnalysis.confidence}% confidence
          </p>
          {aiAnalysis.reasons.length > 0 && (
            <ul className="flags-list">
              {aiAnalysis.reasons.map((reason, i) => (
                <li key={i} className={aiAnalysis.risk}>
                  {reason}
                </li>
              ))}
            </ul>
          )}
          {aiAnalysis.recommendation && (
            <p className="recommendation">{aiAnalysis.recommendation}</p>
          )}
        </div>
      )}
    </div>
  );
}
