import { initMessageRouter } from "./message-router";

console.log("[Mail Scan] Service worker starting...");

initMessageRouter();
console.log("[Mail Scan] Message router initialized");

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[Mail Scan] Extension installed");
  } else if (details.reason === "update") {
    console.log("[Mail Scan] Extension updated to", chrome.runtime.getManifest().version);
  }
});
