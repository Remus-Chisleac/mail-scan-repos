import type { EmailData, EmailLink } from "@shared/types";
import { cleanDisplayText } from "@shared/email-format";

export { cleanDisplayText };

export type ExtractResult = {
  success: boolean;
  data?: EmailData;
  error?: string;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function decodeRedirectUrl(href: string): string {
  try {
    const url = new URL(href);
    if (
      url.hostname.includes("google.com") &&
      url.pathname === "/url" &&
      url.searchParams.has("q")
    ) {
      return url.searchParams.get("q") ?? href;
    }
    if (
      (url.hostname.includes("outlook.") ||
        url.hostname.includes("safelinks.protection.outlook.com")) &&
      url.searchParams.has("url")
    ) {
      return decodeURIComponent(url.searchParams.get("url") ?? href);
    }
    // Yahoo / AOL Mail route outbound links through a tracking redirector and
    // carry the real destination in the RU= (redirect URL) parameter.
    if (url.hostname.endsWith(".yahoo.com") && url.searchParams.has("RU")) {
      return decodeURIComponent(url.searchParams.get("RU") ?? href);
    }
  } catch {
    return href;
  }
  return href;
}

export function collectLinks(container: ParentNode): EmailLink[] {
  const links: EmailLink[] = [];
  const seen = new Set<string>();

  container.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    const rawHref = anchor.getAttribute("href") ?? "";
    const href = decodeRedirectUrl(rawHref);
    if (!href || href.startsWith("mailto:") || href.startsWith("#")) return;

    const key = `${href}|${anchor.innerText.trim()}`;
    if (seen.has(key)) return;
    seen.add(key);

    links.push({
      text: anchor.innerText.trim() || anchor.getAttribute("aria-label") || href,
      href,
    });
  });

  return links;
}

export function extractEmailFromText(text: string): string {
  const match = cleanDisplayText(text).match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  );
  return match?.[0] ?? "";
}

export function parseEmailAddress(text: string): { name: string; email: string } {
  const trimmed = cleanDisplayText(text);
  if (!trimmed) return { name: "", email: "" };

  const angleMatch = trimmed.match(/^(.+?)\s*<([^>]+@[^>]+)>$/);
  if (angleMatch) {
    return {
      name: cleanDisplayText(angleMatch[1]),
      email: angleMatch[2].trim(),
    };
  }

  const parenMatch = trimmed.match(/^(.+?)\s*\(([^)]+@[^)]+)\)$/);
  if (parenMatch) {
    return {
      name: cleanDisplayText(parenMatch[1]),
      email: parenMatch[2].trim(),
    };
  }

  const email = extractEmailFromText(trimmed);
  if (email) {
    const name = cleanDisplayText(
      trimmed.replace(email, "").replace(/[<>()"']/g, "").replace(/^From:\s*/i, ""),
    );
    return { name, email };
  }

  if (/^From:\s*/i.test(trimmed)) {
    return parseEmailAddress(trimmed.replace(/^From:\s*/i, ""));
  }

  return { name: trimmed, email: "" };
}

export function isLikelyPersonName(text: string): boolean {
  const cleaned = cleanDisplayText(text);
  if (!cleaned) return false;
  if (extractEmailFromText(cleaned)) return true;
  if (cleaned.length <= 1) return false;
  if (!/[A-Za-z0-9]/.test(cleaned)) return false;
  return true;
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\s+\n/g, "\n").trim();
}

export function buildResult(
  subject: string,
  senderName: string,
  senderEmail: string,
  bodyText: string,
  links: EmailLink[],
): ExtractResult {
  // The subject lands in the DOM almost immediately (header / document title)
  // while the message body is lazy-rendered a beat later. Treating a
  // subject-only result as success would analyze empty content and report a
  // misleading score of 0, so we require something analyzable (body text or
  // links) and otherwise signal "not ready" so the caller retries.
  const hasAnalyzableContent = bodyText.length > 0 || links.length > 0;
  if (!hasAnalyzableContent) {
    return {
      success: false,
      error: subject
        ? "Could not read the message body. Open the email fully, wait for it to load, then scan again."
        : "Could not extract email content. Open a message and wait for it to finish loading.",
    };
  }

  return {
    success: true,
    data: {
      subject: normalizeWhitespace(subject),
      senderName: normalizeWhitespace(senderName),
      senderEmail: senderEmail.trim(),
      bodyText: normalizeWhitespace(bodyText),
      links,
    },
  };
}
