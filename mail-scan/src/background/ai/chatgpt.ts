import type { EmailData, BasicAnalysisResult, AIAnalysisResult } from "@shared/types";
import { buildPrompt } from "./prompt-builder";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

export async function analyzeWithChatGPT(
  email: EmailData,
  basicResult: BasicAnalysisResult,
  apiKey: string,
): Promise<AIAnalysisResult> {
  const prompt = buildPrompt(email, basicResult);

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a cybersecurity expert analyzing emails for phishing indicators. Respond only with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ChatGPT API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawText = data?.choices?.[0]?.message?.content ?? "";

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
