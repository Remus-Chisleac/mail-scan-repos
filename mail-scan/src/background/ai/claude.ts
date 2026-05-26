import type { EmailData, BasicAnalysisResult, AIAnalysisResult } from "@shared/types";
import { buildPrompt } from "./prompt-builder";

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export async function analyzeWithClaude(
  email: EmailData,
  basicResult: BasicAnalysisResult,
  apiKey: string,
): Promise<AIAnalysisResult> {
  const prompt = buildPrompt(email, basicResult);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
      system:
        "You are a cybersecurity expert analyzing emails for phishing indicators. Respond only with valid JSON.",
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.content?.[0]?.text ?? "";

  return parseAIResponse(rawText);
}

function parseAIResponse(raw: string): AIAnalysisResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      risk: "medium",
      confidence: 50,
      reasons: ["AI returned non-JSON response"],
      recommendation: raw.slice(0, 200),
      rawResponse: raw,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      risk: parsed.risk ?? "medium",
      confidence: Number(parsed.confidence) || 50,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [],
      recommendation: parsed.recommendation ?? "",
      rawResponse: raw,
    };
  } catch {
    return {
      risk: "medium",
      confidence: 50,
      reasons: ["Failed to parse AI response"],
      recommendation: raw.slice(0, 200),
      rawResponse: raw,
    };
  }
}
