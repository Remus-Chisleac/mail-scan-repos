import {
  buildResult,
  cleanDisplayText,
  collectLinks,
  extractEmailFromText,
  isLikelyPersonName,
  parseEmailAddress,
  type ExtractResult,
} from "./shared";

// Yahoo Mail is a React app that tags most meaningful nodes with stable
// `data-test-id` attributes. We try those first and fall back to structural
// selectors / generic text parsing so the extractor degrades gracefully when
// Yahoo tweaks its markup.

function getReadingPane(): HTMLElement | null {
  const selectors = [
    '[data-test-id="message-view-scroller"]',
    '[data-test-id="message-group-view-scroller"]',
    '[data-test-id="message-view-body"]',
    'div[role="main"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }

  return null;
}

function getBodyContainer(readingPane: HTMLElement): HTMLElement | null {
  const selectors = [
    '[data-test-id="message-view-body-content"]',
    '[data-test-id="message-view-body"]',
    ".msg-body",
    '[class*="msg-body"]',
  ];

  for (const selector of selectors) {
    const el = readingPane.querySelector<HTMLElement>(selector);
    if (el?.innerText.trim()) return el;
  }

  return null;
}

function getSubjectFromTitle(): string {
  const match = document.title.match(/^(.+?)\s*[-–|]\s*Yahoo(?:\s*Mail)?/i);
  return match?.[1] ? cleanDisplayText(match[1]) : "";
}

function getSubject(readingPane: HTMLElement): string {
  const selectors = [
    '[data-test-id="message-subject"]',
    '[data-test-id="message-group-subject-text"]',
    '[role="heading"][aria-level="1"]',
    '[role="heading"][aria-level="2"]',
  ];

  for (const selector of selectors) {
    const el = readingPane.querySelector<HTMLElement>(selector);
    const text =
      cleanDisplayText(el?.innerText ?? "") ||
      cleanDisplayText(el?.getAttribute("title") ?? "");
    if (text && text.length > 1 && !extractEmailFromText(text)) return text;
  }

  return getSubjectFromTitle();
}

function getSender(readingPane: HTMLElement): { name: string; email: string } {
  // Yahoo exposes the real address on the sender node's `data-test-id` element,
  // usually via a `title`/`email` attribute, plus a separate display name.
  const senderSelectors = [
    '[data-test-id="message-sender"]',
    '[data-test-id="message-from"]',
    '[data-test-id="email-pill"]',
  ];

  let displayName = "";
  for (const selector of senderSelectors) {
    const el = readingPane.querySelector<HTMLElement>(selector);
    if (!el) continue;

    const attrEmail =
      el.getAttribute("data-test-email") ??
      el.getAttribute("email") ??
      extractEmailFromText(el.getAttribute("title") ?? "");
    const name =
      cleanDisplayText(
        el.querySelector<HTMLElement>('[data-test-id="message-sender-name"]')
          ?.innerText ?? "",
      ) || cleanDisplayText(el.getAttribute("data-test-name") ?? "");

    if (name && isLikelyPersonName(name) && !displayName) displayName = name;
    if (attrEmail) {
      return {
        name: displayName || name,
        email: attrEmail.trim(),
      };
    }
  }

  // Any node advertising an address via title/aria-label.
  const titled = readingPane.querySelectorAll<HTMLElement>(
    '[title*="@"], [aria-label*="@"]',
  );
  for (const el of titled) {
    const text =
      cleanDisplayText(el.getAttribute("title") ?? "") ||
      cleanDisplayText(el.getAttribute("aria-label") ?? "");
    const email = extractEmailFromText(text);
    if (email) {
      const name = cleanDisplayText(text.replace(email, "").replace(/[<>]/g, ""));
      return {
        name: name && isLikelyPersonName(name) ? name : displayName,
        email,
      };
    }
  }

  // Last resort: scan the leading header text for an address.
  const headerText = cleanDisplayText(readingPane.innerText.slice(0, 1200));
  const parsed = parseEmailAddress(headerText);
  if (parsed.email) return { name: displayName || parsed.name, email: parsed.email };

  return { name: displayName, email: "" };
}

function isEmailViewOpen(readingPane: HTMLElement): boolean {
  return Boolean(getBodyContainer(readingPane) || getSubjectFromTitle());
}

export function extractYahooEmail(): ExtractResult {
  const readingPane = getReadingPane();
  if (!readingPane || !isEmailViewOpen(readingPane)) {
    return {
      success: false,
      error: "No email is open. Open a message in Yahoo Mail, then scan again.",
    };
  }

  const bodyContainer = getBodyContainer(readingPane);
  const subject = getSubject(readingPane);
  const { name: senderName, email: senderEmail } = getSender(readingPane);
  const bodyText = bodyContainer?.innerText.trim() ?? "";
  const links = bodyContainer ? collectLinks(bodyContainer) : [];

  return buildResult(subject, senderName, senderEmail, bodyText, links);
}
