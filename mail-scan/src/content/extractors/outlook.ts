import {
  buildResult,
  cleanDisplayText,
  collectLinks,
  extractEmailFromText,
  isLikelyPersonName,
  type ExtractResult,
  parseEmailAddress,
} from "./shared";

function getReadingPane(): HTMLElement | null {
  const selectors = [
    '[data-app-section="ReadingPane"]',
    '[aria-label="Reading pane"]',
    '[aria-label="Reading Pane"]',
    "#ReadingPaneContainerId",
    '[role="main"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return el;
  }

  return null;
}

function getBodyContainer(readingPane: HTMLElement): HTMLElement | null {
  const selectors = [
    'div[aria-label="Message body"]',
    'div[role="document"]',
    ".elementToProof",
    '[data-testid="messageBody"]',
    "#UniqueMessageBody",
  ];

  for (const selector of selectors) {
    const el = readingPane.querySelector<HTMLElement>(selector);
    if (el?.innerText.trim()) return el;
  }

  return readingPane.querySelector<HTMLElement>(".elementToProof, [role='document']");
}

function getHeaderRegion(
  readingPane: HTMLElement,
  bodyContainer: HTMLElement | null,
): HTMLElement {
  const headerSelectors = [
    '[data-automation-id="MessageHeader"]',
    '[data-automation-id="messageHeader"]',
    '[role="region"][aria-label*="Message" i]',
  ];

  for (const selector of headerSelectors) {
    const el = readingPane.querySelector<HTMLElement>(selector);
    if (el) return el;
  }

  if (bodyContainer?.parentElement) {
    const parent = bodyContainer.parentElement;
    const clone = parent.cloneNode(true) as HTMLElement;
    clone
      .querySelectorAll(
        '[role="document"], .elementToProof, [aria-label="Message body"]',
      )
      .forEach((node) => node.remove());
    if (clone.innerText.trim()) return parent;
  }

  return readingPane;
}

function getSubjectFromTitle(): string {
  const match = document.title.match(/^(.+?)\s*[-–|]\s*(Outlook|Mail)/i);
  return match?.[1] ? cleanDisplayText(match[1]) : "";
}

function getSubject(headerRegion: HTMLElement): string {
  const selectors = [
    '[data-automation-id="MessageSubject"]',
    '[data-automation-id="messageHeaderSubject"]',
    '[data-automation-id*="subject" i]',
    '[role="heading"][aria-level="2"]',
    '[role="heading"][aria-level="1"]',
  ];

  for (const selector of selectors) {
    const elements = headerRegion.querySelectorAll<HTMLElement>(selector);
    for (const el of elements) {
      const text =
        cleanDisplayText(el.innerText) ||
        cleanDisplayText(el.getAttribute("title") ?? "");
      if (text && text.length > 1 && !extractEmailFromText(text)) {
        return text;
      }
    }
  }

  const titled = headerRegion.querySelector<HTMLElement>(
    ".allowTextSelection[title], [title]",
  );
  const titledText = cleanDisplayText(titled?.getAttribute("title") ?? "");
  if (titledText && !extractEmailFromText(titledText)) {
    return titledText;
  }

  return getSubjectFromTitle();
}

function parseSenderCandidate(raw: string): { name: string; email: string } | null {
  const parsed = parseEmailAddress(raw);
  if (parsed.email) return parsed;
  if (isLikelyPersonName(parsed.name)) return parsed;
  return null;
}

function getSenderFromMailto(headerRegion: HTMLElement): { name: string; email: string } | null {
  const mailtoLinks = headerRegion.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]');
  for (const link of mailtoLinks) {
    const email = decodeURIComponent(
      link.getAttribute("href")?.replace(/^mailto:/i, "").split("?")[0] ?? "",
    );
    if (!email.includes("@")) continue;

    const name =
      cleanDisplayText(link.innerText) ||
      cleanDisplayText(link.getAttribute("aria-label") ?? "") ||
      cleanDisplayText(link.getAttribute("title") ?? "");
    return {
      name: name && !extractEmailFromText(name) ? name : "",
      email,
    };
  }
  return null;
}

function getSender(headerRegion: HTMLElement): {
  name: string;
  email: string;
} {
  const fromMailto = getSenderFromMailto(headerRegion);
  if (fromMailto?.email) return fromMailto;

  const selectors = [
    '[data-automation-id="MessageSenderName"]',
    '[data-automation-id="PersonaName"]',
    '[data-testid="messageHeaderFrom"]',
    '[data-testid="personaName"]',
    ".personaName",
  ];

  let displayName = "";
  for (const selector of selectors) {
    const el = headerRegion.querySelector<HTMLElement>(selector);
    const text = cleanDisplayText(
      el?.innerText ??
        el?.getAttribute("title") ??
        el?.getAttribute("aria-label") ??
        "",
    );
    if (isLikelyPersonName(text) && !extractEmailFromText(text)) {
      displayName = text;
      break;
    }
  }

  const ariaCandidates = headerRegion.querySelectorAll<HTMLElement>(
    '[aria-label*="From" i], [title*="From" i]',
  );
  for (const el of ariaCandidates) {
    const label =
      cleanDisplayText(el.getAttribute("aria-label") ?? "") ||
      cleanDisplayText(el.getAttribute("title") ?? "") ||
      cleanDisplayText(el.innerText);
    if (!label.toLowerCase().includes("from")) continue;

    const parsed = parseSenderCandidate(label.replace(/^From[:\s]*/i, ""));
    if (parsed?.email) return parsed;
    if (parsed?.name && !displayName) displayName = parsed.name;
  }

  const emailElements = headerRegion.querySelectorAll<HTMLElement>(
    'span[title*="@"], [aria-label*="@"]',
  );
  for (const el of emailElements) {
    const text =
      cleanDisplayText(el.getAttribute("title") ?? "") ||
      cleanDisplayText(el.getAttribute("aria-label") ?? "") ||
      cleanDisplayText(el.innerText);
    const email = extractEmailFromText(text);
    if (email) {
      const name = cleanDisplayText(text.replace(email, "").replace(/[<>]/g, ""));
      return {
        name: name && isLikelyPersonName(name) ? name : displayName,
        email,
      };
    }
  }

  const headerText = cleanDisplayText(headerRegion.innerText.slice(0, 1200));
  const email = extractEmailFromText(headerText);
  if (email) {
    return { name: displayName, email };
  }

  if (displayName) {
    return { name: displayName, email: "" };
  }

  return { name: "", email: "" };
}

function isEmailViewOpen(readingPane: HTMLElement): boolean {
  return Boolean(getBodyContainer(readingPane) || getSubjectFromTitle());
}

export function extractOutlookEmail(): ExtractResult {
  const readingPane = getReadingPane();
  if (!readingPane || !isEmailViewOpen(readingPane)) {
    return {
      success: false,
      error:
        "No email is open. Select a message in Outlook, then scan again.",
    };
  }

  const bodyContainer = getBodyContainer(readingPane);
  const headerRegion = getHeaderRegion(readingPane, bodyContainer);
  const subject = getSubject(headerRegion);
  const { name: senderName, email: senderEmail } = getSender(headerRegion);
  const bodyText = bodyContainer?.innerText.trim() ?? "";
  const links = bodyContainer ? collectLinks(bodyContainer) : [];

  return buildResult(subject, senderName, senderEmail, bodyText, links);
}
