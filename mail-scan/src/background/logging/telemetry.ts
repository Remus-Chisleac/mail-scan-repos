import type { SentryLogSubmitBody } from "@shared/sentry-log";
import { normalizeServerUrl } from "@shared/sentry-log";

const TIMEOUT_MS = 5000;

export async function sendSentryLog(
  serverUrl: string,
  token: string,
  body: SentryLogSubmitBody,
): Promise<void> {
  const base = normalizeServerUrl(serverUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${base}/api/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message =
        typeof data.error === "string"
          ? data.error
          : `${response.status} ${response.statusText}`;
      throw new Error(message);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Logging request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
