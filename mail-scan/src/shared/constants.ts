export const MSG = {
  SCAN_EMAIL: "SCAN_EMAIL",
  EXTRACT_EMAIL: "EXTRACT_EMAIL",
  PING: "PING",
  UNLOCK_VAULT: "UNLOCK_VAULT",
  LOCK_VAULT: "LOCK_VAULT",
  INIT_VAULT: "INIT_VAULT",
  CHECK_VAULT: "CHECK_VAULT",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_SETTINGS: "GET_SETTINGS",
  SAVE_SECRET: "SAVE_SECRET",
  GET_SECRET: "GET_SECRET",
  SENTRY_LOG_LOGIN: "SENTRY_LOG_LOGIN",
  SENTRY_LOG_STATUS: "SENTRY_LOG_STATUS",
} as const;

export const STORAGE_KEYS = {
  VAULT_META: "vault_meta",
  SETTINGS: "user_settings",
  SECRET_PREFIX: "secret_",
} as const;

export const SECRET_KEYS = {
  AI_API_KEY: "ai_api_key",
  CUSTOM_AI_ENDPOINT: "custom_ai_endpoint",
  SENTRY_LOG_SERVER: "sentry_log_server",
  SENTRY_LOG_USERNAME: "sentry_log_username",
  SENTRY_LOG_PASSWORD: "sentry_log_password",
  SENTRY_LOG_TOKEN: "sentry_log_token",
} as const;

export const DEFAULT_SENTRY_LOG_SERVER = "http://localhost:8080";

export const RISK_THRESHOLDS = {
  LOW_MAX: 29,
  MEDIUM_MAX: 59,
} as const;

export const DEFAULT_SETTINGS = {
  analysisMode: "basic" as const,
  aiProvider: "gemini" as const,
  loggingEnabled: false,
};

export const EXTENSION_VERSION = "0.1.0";
