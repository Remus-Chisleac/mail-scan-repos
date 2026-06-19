export const MSG = {
  SCAN_EMAIL: "SCAN_EMAIL",
  EXTRACT_EMAIL: "EXTRACT_EMAIL",
  PING: "PING",
  SAVE_SETTINGS: "SAVE_SETTINGS",
  GET_SETTINGS: "GET_SETTINGS",
  SAVE_SECRET: "SAVE_SECRET",
  GET_SECRET: "GET_SECRET",
  SENTRY_LOG_LOGIN: "SENTRY_LOG_LOGIN",
  SENTRY_LOG_STATUS: "SENTRY_LOG_STATUS",
} as const;

export const STORAGE_KEYS = {
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

/**
 * Well-known brands frequently impersonated in phishing, mapped to their
 * legitimate domains. Used both for sender/body brand-mismatch detection and
 * for spotting look-alike domains (e.g. "paypal-secure.com").
 */
export const KNOWN_BRANDS: { name: string; domains: string[] }[] = [
  { name: "paypal", domains: ["paypal.com"] },
  { name: "microsoft", domains: ["microsoft.com", "outlook.com", "live.com", "office.com", "office365.com"] },
  { name: "apple", domains: ["apple.com", "icloud.com"] },
  { name: "google", domains: ["google.com", "gmail.com", "googlemail.com"] },
  { name: "yahoo", domains: ["yahoo.com", "yahoo.co.uk", "yahooinc.com", "aol.com"] },
  { name: "amazon", domains: ["amazon.com", "amazon.co", "amazon.co.uk", "amazonses.com"] },
  { name: "netflix", domains: ["netflix.com"] },
  { name: "facebook", domains: ["facebook.com", "fb.com", "facebookmail.com"] },
  { name: "instagram", domains: ["instagram.com"] },
  { name: "linkedin", domains: ["linkedin.com"] },
  { name: "whatsapp", domains: ["whatsapp.com"] },
  { name: "dhl", domains: ["dhl.com"] },
  { name: "fedex", domains: ["fedex.com"] },
  { name: "coinbase", domains: ["coinbase.com"] },
  { name: "dropbox", domains: ["dropbox.com"] },
  { name: "docusign", domains: ["docusign.com", "docusign.net"] },
  { name: "bank of america", domains: ["bankofamerica.com"] },
  { name: "wells fargo", domains: ["wellsfargo.com"] },
  { name: "chase", domains: ["chase.com"] },
];

export const DEFAULT_SETTINGS = {
  analysisMode: "basic" as const,
  aiProvider: "gemini" as const,
  loggingEnabled: false,
};

export const EXTENSION_VERSION = "0.1.0";
