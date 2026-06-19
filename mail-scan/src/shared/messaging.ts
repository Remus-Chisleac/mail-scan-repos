import { MSG } from "./constants";
import type {
  AnalysisMode,
  AIProvider,
  AnalysisResult,
  EmailData,
  UserSettings,
} from "./types";

export interface MessageMap {
  [MSG.SCAN_EMAIL]: {
    request: { mode: AnalysisMode; provider: AIProvider };
    response: { success: boolean; result?: AnalysisResult; error?: string };
  };
  [MSG.EXTRACT_EMAIL]: {
    request: Record<string, never>;
    response: { success: boolean; data?: EmailData; error?: string };
  };
  [MSG.PING]: {
    request: Record<string, never>;
    response: { ok: boolean };
  };
  [MSG.SAVE_SETTINGS]: {
    request: { settings: UserSettings };
    response: { success: boolean };
  };
  [MSG.GET_SETTINGS]: {
    request: Record<string, never>;
    response: { settings: UserSettings };
  };
  [MSG.SAVE_SECRET]: {
    request: { key: string; value: string };
    response: { success: boolean };
  };
  [MSG.GET_SECRET]: {
    request: { key: string };
    response: { value: string | null };
  };
  [MSG.SENTRY_LOG_LOGIN]: {
    request: Record<string, never>;
    response: { success: boolean; username?: string; error?: string };
  };
  [MSG.SENTRY_LOG_STATUS]: {
    request: Record<string, never>;
    response: { connected: boolean; username?: string };
  };
}

type MessageType = keyof MessageMap;

export function sendMessage<T extends MessageType>(
  type: T,
  payload: MessageMap[T]["request"],
): Promise<MessageMap[T]["response"]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as MessageMap[T]["response"]);
      }
    });
  });
}

export function sendTabMessage<T extends MessageType>(
  tabId: number,
  type: T,
  payload: MessageMap[T]["request"],
): Promise<MessageMap[T]["response"]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response as MessageMap[T]["response"]);
      }
    });
  });
}
