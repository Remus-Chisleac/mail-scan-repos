import { MSG, SECRET_KEYS } from "@shared/constants";
import {
  getContentScriptFilesForUrl,
  isSupportedMailUrl,
  supportedMailLabel,
} from "@shared/mail-providers";
import {
  saveSecret,
  getSecret,
  saveSettings,
  getSettings,
} from "@shared/storage";
import type {
  AnalysisResult,
  BasicAnalysisResult,
  EmailData,
  AIProvider,
  AnalysisMode,
} from "@shared/types";
import {
  buildSentryLogBody,
  isTokenExpired,
  loginToSentryLog,
  parseJwtPayload,
} from "@shared/sentry-log";
import { formatSenderLabel } from "@shared/email-format";
import { runBasicAnalysisWithNetwork } from "./analysis/basic-engine";
import { analyzeWithGemini } from "./ai/gemini";
import { analyzeWithChatGPT } from "./ai/chatgpt";
import { analyzeWithClaude } from "./ai/claude";
import { analyzeWithCustom } from "./ai/custom";
import { sendSentryLog } from "./logging/telemetry";

const log = (...args: unknown[]) => console.log("[Mail Scan BG]", ...args);
const logErr = (...args: unknown[]) => console.error("[Mail Scan BG]", ...args);

async function ensureContentScript(tabId: number, url: string): Promise<void> {
  const ping = () =>
    new Promise<boolean>((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: MSG.PING }, (response) => {
        resolve(!chrome.runtime.lastError && response?.ok === true);
      });
    });

  if (await ping()) return;

  const files = getContentScriptFilesForUrl(url);
  if (files.length === 0) {
    throw new Error("No content script registered for this mail provider.");
  }

  log("Injecting content script into tab", tabId);
  await chrome.scripting.executeScript({
    target: { tabId },
    files,
  });

  if (!(await ping())) {
    throw new Error(
      "Could not connect to the mail page. Refresh the tab and try again.",
    );
  }
}

async function requestEmailExtraction(tabId: number): Promise<EmailData> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: MSG.EXTRACT_EMAIL },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(
            new Error(
              chrome.runtime.lastError.message ??
                "Failed to communicate with content script.",
            ),
          );
          return;
        }
        if (!response?.success) {
          reject(new Error(response?.error ?? "Failed to extract email."));
          return;
        }
        resolve(response.data);
      },
    );
  });
}

async function extractEmailFromTab(): Promise<EmailData> {
  log("Querying active tab...");
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (!tab?.id || !tab.url) {
    throw new Error("No active tab found.");
  }

  log("Active tab:", tab.id, tab.url.slice(0, 80));

  if (!isSupportedMailUrl(tab.url)) {
    throw new Error(
      `Please open an email in ${supportedMailLabel(tab.url)} before scanning.`,
    );
  }

  await ensureContentScript(tab.id, tab.url);

  log("Sending EXTRACT_EMAIL to content script...");
  const data = await requestEmailExtraction(tab.id);

  log("Email extracted:", {
    subject: data.subject?.slice(0, 50),
    sender: data.senderEmail,
    bodyLength: data.bodyText?.length,
    linkCount: data.links?.length,
  });

  return data;
}

async function runAIAnalysis(
  email: EmailData,
  basicResult: BasicAnalysisResult,
  provider: AIProvider,
) {
  log("Running AI analysis with provider:", provider);
  const apiKey = await getSecret(SECRET_KEYS.AI_API_KEY);
  if (!apiKey) {
    throw new Error(
      "No API key configured. Save your API key in the AI Provider section.",
    );
  }

  switch (provider) {
    case "gemini":
      return analyzeWithGemini(email, basicResult, apiKey);
    case "chatgpt":
      return analyzeWithChatGPT(email, basicResult, apiKey);
    case "claude":
      return analyzeWithClaude(email, basicResult, apiKey);
    case "custom": {
      const endpoint = await getSecret(SECRET_KEYS.CUSTOM_AI_ENDPOINT);
      if (!endpoint) {
        throw new Error("No custom endpoint configured.");
      }
      return analyzeWithCustom(email, basicResult, apiKey, endpoint);
    }
  }
}

async function ensureSentryLogToken(): Promise<{
  serverUrl: string;
  token: string;
} | null> {
  const serverUrl = await getSecret(SECRET_KEYS.SENTRY_LOG_SERVER);
  const username = await getSecret(SECRET_KEYS.SENTRY_LOG_USERNAME);
  const password = await getSecret(SECRET_KEYS.SENTRY_LOG_PASSWORD);
  let token = await getSecret(SECRET_KEYS.SENTRY_LOG_TOKEN);

  if (!serverUrl || !username || !password) {
    return null;
  }

  if (!token || isTokenExpired(token)) {
    const session = await loginToSentryLog({ serverUrl, username, password });
    token = session.token;
    await saveSecret(SECRET_KEYS.SENTRY_LOG_TOKEN, token);
  }

  return { serverUrl, token };
}

async function handleLogging(
  result: AnalysisResult,
  mode: AnalysisMode,
  provider: AIProvider,
) {
  const settings = await getSettings();
  if (!settings.loggingEnabled) {
    log("Logging disabled, skipping");
    return;
  }

  log("Sending log to SENTRY_LOG...");
  const session = await ensureSentryLogToken();
  if (!session) {
    log("SENTRY_LOG credentials not configured, skipping");
    return;
  }

  const body = buildSentryLogBody(result, mode, provider);

  try {
    await sendSentryLog(session.serverUrl, session.token, body);
    log("Log sent successfully");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("token")) {
      await saveSecret(SECRET_KEYS.SENTRY_LOG_TOKEN, "");
      logErr("Log send failed, token cleared:", message);
      return;
    }
    logErr("Log send failed:", message);
  }
}

type HandlerResponse = Record<string, unknown>;

type MessageHandler = (
  message: Record<string, unknown>,
) => Promise<HandlerResponse>;

const handlers: Record<string, MessageHandler> = {
  [MSG.SAVE_SETTINGS]: async (msg) => {
    log("SAVE_SETTINGS ->", msg.settings);
    await saveSettings(
      msg.settings as Parameters<typeof saveSettings>[0],
    );
    return { success: true };
  },

  [MSG.GET_SETTINGS]: async () => {
    const settings = await getSettings();
    log("GET_SETTINGS ->", settings);
    return { settings };
  },

  [MSG.SAVE_SECRET]: async (msg) => {
    log("SAVE_SECRET -> key:", msg.key);
    await saveSecret(msg.key as string, msg.value as string);
    return { success: true };
  },

  [MSG.GET_SECRET]: async (msg) => {
    log("GET_SECRET -> key:", msg.key);
    const value = await getSecret(msg.key as string);
    log("GET_SECRET -> found:", value !== null);
    return { value };
  },

  [MSG.SENTRY_LOG_LOGIN]: async () => {
    log("SENTRY_LOG_LOGIN -> attempting...");
    try {
      const serverUrl = await getSecret(SECRET_KEYS.SENTRY_LOG_SERVER);
      const username = await getSecret(SECRET_KEYS.SENTRY_LOG_USERNAME);
      const password = await getSecret(SECRET_KEYS.SENTRY_LOG_PASSWORD);

      if (!serverUrl || !username || !password) {
        return {
          success: false,
          error: "Server URL, username, and password are required",
        };
      }

      const session = await loginToSentryLog({
        serverUrl,
        username,
        password,
      });
      await saveSecret(SECRET_KEYS.SENTRY_LOG_TOKEN, session.token);

      log("SENTRY_LOG_LOGIN -> success:", session.username);
      return { success: true, username: session.username };
    } catch (err) {
      logErr("SENTRY_LOG_LOGIN -> failed:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Login failed",
      };
    }
  },

  [MSG.SENTRY_LOG_STATUS]: async () => {
    const token = await getSecret(SECRET_KEYS.SENTRY_LOG_TOKEN);
    if (!token || isTokenExpired(token)) {
      return { connected: false };
    }

    const payload = parseJwtPayload(token);
    return {
      connected: true,
      username: payload?.username,
    };
  },

  [MSG.SCAN_EMAIL]: async (msg) => {
    log("SCAN_EMAIL -> mode:", msg.mode, "provider:", msg.provider);
    const email = await extractEmailFromTab();

    log("Running basic analysis...");
    const basicResult = await runBasicAnalysisWithNetwork(email);
    log("Basic analysis ->", {
      score: basicResult.score,
      riskLevel: basicResult.riskLevel,
      flagCount: basicResult.flags.length,
    });

    const result: AnalysisResult = {
      timestamp: new Date().toISOString(),
      emailMeta: {
        sender: formatSenderLabel(email.senderName, email.senderEmail),
        subject: email.subject,
      },
      basicAnalysis: basicResult,
    };

    if (msg.mode === "advanced") {
      try {
        result.aiAnalysis = await runAIAnalysis(
          email,
          basicResult,
          msg.provider as AIProvider,
        );
        log("AI analysis ->", {
          risk: result.aiAnalysis?.risk,
          confidence: result.aiAnalysis?.confidence,
        });
      } catch (err) {
        logErr("AI analysis failed:", err);
        return {
          success: true,
          result,
          error: `AI analysis failed: ${err instanceof Error ? err.message : String(err)}. Basic analysis results are still available.`,
        };
      }
    }

    handleLogging(result, msg.mode as AnalysisMode, msg.provider as AIProvider);

    log("SCAN_EMAIL complete -> risk:", basicResult.riskLevel, "score:", basicResult.score);
    return { success: true, result };
  },
};

export function initMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const msgType = message.type as string;
    log(`Message received: ${msgType}`, "from:", sender.id ? "extension" : sender.tab?.url?.slice(0, 40));

    const handler = handlers[msgType];
    if (!handler) {
      logErr("Unknown message type:", msgType);
      sendResponse({ error: `Unknown message type: ${msgType}` });
      return false;
    }

    handler(message as Record<string, unknown>)
      .then((result) => {
        log(`Message ${msgType} -> responding`, Object.keys(result));
        sendResponse(result);
      })
      .catch((err: Error) => {
        logErr(`Message ${msgType} -> error:`, err.message);
        sendResponse({
          success: false,
          error: err.message ?? "Unknown error",
        });
      });

    return true;
  });
}
