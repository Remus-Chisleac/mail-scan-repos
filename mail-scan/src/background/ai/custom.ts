import type { EmailData, BasicAnalysisResult, AIAnalysisResult } from "@shared/types";
import { buildPrompt } from "./prompt-builder";

export async function analyzeWithCustom(
  email: EmailData,
  basicResult: BasicAnalysisResult,
  apiKey: string,
  endpoint: string,
): Promise<AIAnalysisResult> {
  const prompt = buildPrompt(email, basicResult);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt,
      email: {
        subject: email.subject,
        sender: `${email.senderName} <${email.senderEmail}>`,
        bodyText: email.bodyText.slice(0, 3000),
        links: email.links,
      },
      basicAnalysis: basicResult,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Custom API error ${response.status}: ${errText}`);
  }

  const data = await response.json();

  if (data.risk && data.confidence !== undefined) {
    return {
      risk: data.risk,
      confidence: Number(data.confidence) || 50,
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
      recommendation: data.recommendation ?? "",
      rawResponse: JSON.stringify(data),
    };
  }

  const rawText = typeof data === "string" ? data : JSON.stringify(data);
  return parseAIResponse(rawText);
}

function parseAIResponse(raw: string): AIAnalysisResult {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      risk: "medium",
      confidence: 50,
      reasons: ["Custom endpoint returned unexpected format"],
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
      reasons: ["Failed to parse custom endpoint response"],
      recommendation: raw.slice(0, 200),
      rawResponse: raw,
    };
  }
}
