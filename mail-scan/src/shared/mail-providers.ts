export type MailProvider = "gmail" | "outlook";

const GMAIL_HOSTS = ["mail.google.com"];
const OUTLOOK_HOSTS = [
  "outlook.live.com",
  "outlook.office.com",
  "outlook.office365.com",
  "outlook.cloud.microsoft",
];

export function detectMailProvider(url: string): MailProvider | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (GMAIL_HOSTS.includes(host)) return "gmail";
    if (OUTLOOK_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
      return "outlook";
    }
  } catch {
    return null;
  }
  return null;
}

export function isSupportedMailUrl(url: string): boolean {
  return detectMailProvider(url) !== null;
}

export function supportedMailLabel(url: string): string {
  const provider = detectMailProvider(url);
  if (provider === "gmail") return "Gmail";
  if (provider === "outlook") return "Outlook";
  return "Gmail or Outlook";
}

function matchPattern(url: string, pattern: string): boolean {
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*") +
      "$",
  );
  return regex.test(url);
}

export function getContentScriptFilesForUrl(url: string): string[] {
  const manifest = chrome.runtime.getManifest();
  for (const entry of manifest.content_scripts ?? []) {
    if (entry.matches?.some((pattern) => matchPattern(url, pattern))) {
      return entry.js ?? [];
    }
  }
  return [];
}
