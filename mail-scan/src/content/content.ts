import { MSG } from "@shared/constants";
import { extractCurrentEmail } from "./extractors";

console.log("[Mail Scan Content] Content script loaded on", window.location.href);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === MSG.PING) {
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === MSG.EXTRACT_EMAIL) {
    console.log("[Mail Scan Content] Extracting email from DOM...");
    extractCurrentEmail().then((result) => {
      if (result.success) {
        console.log("[Mail Scan Content] Extraction success:", {
          subject: result.data?.subject?.slice(0, 50),
          sender: result.data?.senderEmail,
          bodyLength: result.data?.bodyText?.length,
          linkCount: result.data?.links?.length,
        });
      } else {
        console.warn("[Mail Scan Content] Extraction failed:", result.error);
      }
      sendResponse(result);
    });
    return true;
  }

  return false;
});
