import type { AIProvider, AnalysisMode, AnalysisResult } from "./types";
import { EXTENSION_VERSION } from "./constants";

export interface SentryLogCredentials {
  serverUrl: string;
  username: string;
  password: string;
}

export interface SentryLogSession {
  serverUrl: string;
  username: string;
  token: string;
}

export interface SentryLogSubmitBody {
  analysis_mode: string;
  ai_provider: string;
  phishing_detected: boolean;
  raw_data: Record<string, unknown>;
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function parseJwtPayload(
  token: string,
): { username?: string; exp?: number } | null {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = parseJwtPayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= payload.exp * 1000;
}

export async function loginToSentryLog(
  credentials: SentryLogCredentials,
): Promise<{ token: string; username: string }> {
  const serverUrl = normalizeServerUrl(credentials.serverUrl);
  const response = await fetch(`${serverUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: credentials.username,
      password: credentials.password,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof data.error === "string" ? data.error : "Login failed",
    );
  }

  if (!data.token) {
    throw new Error("Login succeeded but no token was returned");
  }

  const payload = parseJwtPayload(data.token);
  return {
    token: data.token,
    username: payload?.username ?? credentials.username,
  };
}

export function buildSentryLogBody(
  result: AnalysisResult,
  mode: AnalysisMode,
  provider: AIProvider,
): SentryLogSubmitBody {
  const risk = result.aiAnalysis?.risk ?? result.basicAnalysis.riskLevel;

  return {
    analysis_mode: mode,
    ai_provider: mode === "advanced" ? provider : "none",
    phishing_detected: risk === "high" || risk === "medium",
    raw_data: {
      timestamp: result.timestamp,
      emailMeta: result.emailMeta,
      basicAnalysis: result.basicAnalysis,
      aiAnalysis: result.aiAnalysis,
      extensionVersion: EXTENSION_VERSION,
    },
  };
}
