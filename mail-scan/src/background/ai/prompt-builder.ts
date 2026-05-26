import type { EmailData, BasicAnalysisResult } from "@shared/types";

const MAX_BODY_LENGTH = 3000;

export function buildPrompt(
  email: EmailData,
  basicResult: BasicAnalysisResult,
): string {
  const truncatedBody =
    email.bodyText.length > MAX_BODY_LENGTH
      ? email.bodyText.slice(0, MAX_BODY_LENGTH) + "... [truncated]"
      : email.bodyText;

  const urlList =
    email.links.length > 0
      ? email.links.map((l) => `  - Text: "${l.text}" -> URL: ${l.href}`).join("\n")
      : "  (none)";

  const flagList =
    basicResult.flags.length > 0
      ? basicResult.flags.map((f) => `  - [${f.severity}] ${f.message}`).join("\n")
      : "  (none)";

  return `Analyze the following email for phishing indicators. Return ONLY a valid JSON object with this exact structure, no additional text:
{"risk": "low"|"medium"|"high", "confidence": 0-100, "reasons": ["string"], "recommendation": "string"}

=== EMAIL DATA ===
Subject: ${email.subject}
Sender: ${email.senderName} <${email.senderEmail}>

Body:
${truncatedBody}

URLs found:
${urlList}

Basic analysis flags (pre-computed):
${flagList}
Basic analysis score: ${basicResult.score}/100 (${basicResult.riskLevel} risk)

=== END EMAIL DATA ===

Evaluate this email for signs of phishing, social engineering, or fraud. Consider the sender legitimacy, URL safety, language patterns, urgency tactics, and the basic analysis flags provided. Return ONLY the JSON object.`;
}
