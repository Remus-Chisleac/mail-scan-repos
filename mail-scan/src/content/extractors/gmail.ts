import {
  buildResult,
  collectLinks,
  type ExtractResult,
  parseEmailAddress,
} from "./shared";

function getReadingPane(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="main"]');
}

function getActiveMessageRoot(): HTMLElement | null {
  const readingPane = getReadingPane();
  if (!readingPane) return null;

  const expandedMessages = readingPane.querySelectorAll<HTMLElement>(
    '[role="listitem"][aria-expanded="true"]',
  );
  if (expandedMessages.length > 0) {
    return expandedMessages[expandedMessages.length - 1];
  }

  const selectedMessage = readingPane.querySelector<HTMLElement>(
    '[role="listitem"][aria-selected="true"]',
  );
  if (selectedMessage) return selectedMessage;

  const messageBodies = readingPane.querySelectorAll<HTMLElement>(".a3s.aiL");
  if (messageBodies.length === 1) {
    return (
      messageBodies[0].closest<HTMLElement>('[role="listitem"]') ??
      messageBodies[0].closest<HTMLElement>(".gs") ??
      messageBodies[0]
    );
  }

  if (messageBodies.length > 1) {
    const lastBody = messageBodies[messageBodies.length - 1];
    return (
      lastBody.closest<HTMLElement>('[role="listitem"]') ??
      lastBody.closest<HTMLElement>(".gs") ??
      lastBody
    );
  }

  const legacyBody = readingPane.querySelector<HTMLElement>(".ii.gt");
  if (legacyBody) {
    return legacyBody.closest<HTMLElement>(".gs") ?? legacyBody;
  }

  return null;
}

function getSubject(): string {
  const selectors = [
    "h2.hP",
    "h2[data-thread-perm-id]",
    '[role="main"] h2.hP',
    '[role="main"] .ha h2',
  ];

  for (const selector of selectors) {
    const el = document.querySelector<HTMLElement>(selector);
    if (el?.innerText.trim()) return el.innerText.trim();
  }

  return "";
}

function getSender(messageRoot: HTMLElement | null): {
  name: string;
  email: string;
} {
  const scopes = messageRoot
    ? [messageRoot, getReadingPane()].filter(Boolean) as HTMLElement[]
    : [getReadingPane()].filter(Boolean) as HTMLElement[];

  for (const scope of scopes) {
    const senderEl = scope.querySelector<HTMLElement>(".gD[email]");
    if (senderEl) {
      return {
        name:
          senderEl.getAttribute("name")?.trim() ||
          senderEl.innerText.trim() ||
          "",
        email: senderEl.getAttribute("email")?.trim() || "",
      };
    }

    const fromSpan = scope.querySelector<HTMLElement>(".go .g2, .go");
    if (fromSpan?.innerText.trim()) {
      return parseEmailAddress(fromSpan.innerText);
    }
  }

  const headerEmail = document.querySelector<HTMLElement>("[email]");
  if (headerEmail) {
    return {
      name:
        headerEmail.getAttribute("name")?.trim() ||
        headerEmail.innerText.trim() ||
        "",
      email: headerEmail.getAttribute("email")?.trim() || "",
    };
  }

  return { name: "", email: "" };
}

function getBodyContainer(messageRoot: HTMLElement | null): HTMLElement | null {
  if (messageRoot) {
    const body =
      messageRoot.querySelector<HTMLElement>(".a3s.aiL") ??
      messageRoot.querySelector<HTMLElement>(".ii.gt");
    if (body) return body;
  }

  const readingPane = getReadingPane();
  if (!readingPane) return null;

  const bodies = readingPane.querySelectorAll<HTMLElement>(".a3s.aiL");
  if (bodies.length > 0) return bodies[bodies.length - 1];

  return readingPane.querySelector<HTMLElement>(".ii.gt");
}

function isEmailViewOpen(): boolean {
  if (getBodyContainer(getActiveMessageRoot())) return true;
  return getSubject().length > 0;
}

export function extractGmailEmail(): ExtractResult {
  if (!isEmailViewOpen()) {
    return {
      success: false,
      error:
        "No email is open. Click a message in Gmail, then scan again.",
    };
  }

  const messageRoot = getActiveMessageRoot();
  const subject = getSubject();
  const { name: senderName, email: senderEmail } = getSender(messageRoot);
  const bodyContainer = getBodyContainer(messageRoot);
  const bodyText = bodyContainer?.innerText.trim() ?? "";
  const links = bodyContainer ? collectLinks(bodyContainer) : [];

  return buildResult(subject, senderName, senderEmail, bodyText, links);
}
