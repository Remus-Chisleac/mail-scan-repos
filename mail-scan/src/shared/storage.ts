import type { UserSettings } from "./types";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants";

function chromeGet<T>(key: string): Promise<T | undefined> {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (result) => {
      resolve(result[key] as T | undefined);
    });
  });
}

function chromeSet(key: string, value: unknown): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

export async function saveSecret(key: string, value: string): Promise<void> {
  await chromeSet(STORAGE_KEYS.SECRET_PREFIX + key, value);
}

export async function getSecret(key: string): Promise<string | null> {
  const value = await chromeGet<unknown>(STORAGE_KEYS.SECRET_PREFIX + key);
  // Secrets are stored as plain strings. Anything else (e.g. a legacy
  // encrypted blob from the old master-password vault) is treated as unset so
  // the user is simply prompted to re-enter it.
  return typeof value === "string" ? value : null;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await chromeSet(STORAGE_KEYS.SETTINGS, settings);
}

export async function getSettings(): Promise<UserSettings> {
  const settings = await chromeGet<UserSettings>(STORAGE_KEYS.SETTINGS);
  return settings ?? { ...DEFAULT_SETTINGS };
}
