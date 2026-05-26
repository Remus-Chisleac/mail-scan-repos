import type { EmailData, BasicAnalysisResult, AIAnalysisResult } from "@shared/types";
import { buildPrompt } from "./prompt-builder";

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

export async function analyzeWithGemini(
  email: EmailData,
  basicResult: BasicAnalysisResult,
  apiKey: string,
): Promise<AIAnalysisResult> {
  const prompt = buildPrompt(email, basicResult);

  const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 512,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
