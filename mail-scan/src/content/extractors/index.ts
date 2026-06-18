import { detectMailProvider } from "@shared/mail-providers";
import { extractGmailEmail } from "./gmail";
import { extractOutlookEmail } from "./outlook";
import { sleep, type ExtractResult } from "./shared";

export type { ExtractResult } from "./shared";

export async function extractCurrentEmail(): Promise<ExtractResult> {
  const provider = detectMailProvider(window.location.href);
  let lastResult: ExtractResult = {
    success: false,
    error: "Could not extract the open email.",
  };

  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastResult =
      provider === "outlook" ? extractOutlookEmail() : extractGmailEmail();
    if (lastResult.success) return lastResult;
    if (attempt < maxAttempts - 1) await sleep(350);
  }

  return lastResult;
}
