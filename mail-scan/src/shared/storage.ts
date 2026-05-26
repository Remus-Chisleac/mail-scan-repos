import {
  generateSalt,
  hashPassword,
  deriveKey,
  encrypt,
  decrypt,
} from "./crypto";
import type { EncryptedData, UserSettings, VaultMeta } from "./types";
import { STORAGE_KEYS, DEFAULT_SETTINGS } from "./constants";

let derivedKey: CryptoKey | null = null;

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

export async function isVaultInitialized(): Promise<boolean> {
  const meta = await chromeGet<VaultMeta>(STORAGE_KEYS.VAULT_META);
  return meta !== undefined && !!meta.salt && !!meta.passwordHash;
}

export async function initializeVault(masterPassword: string): Promise<void> {
  const salt = generateSalt();
  const passwordHash = await hashPassword(masterPassword, salt);

  const meta: VaultMeta = { salt, passwordHash };
  await chromeSet(STORAGE_KEYS.VAULT_META, meta);

  derivedKey = await deriveKey(masterPassword, salt);
}

export async function unlockVault(
  masterPassword: string,
): Promise<{ success: boolean }> {
  const meta = await chromeGet<VaultMeta>(STORAGE_KEYS.VAULT_META);
  if (!meta) {
    return { success: false };
  }

  const hash = await hashPassword(masterPassword, meta.salt);
  if (hash !== meta.passwordHash) {
    return { success: false };
  }

  derivedKey = await deriveKey(masterPassword, meta.salt);
  return { success: true };
}

export function lockVault(): void {
  derivedKey = null;
}

export function isVaultUnlocked(): boolean {
  return derivedKey !== null;
}

export async function saveSecret(key: string, value: string): Promise<void> {
  if (!derivedKey) throw new Error("Vault is locked");
  const encrypted = await encrypt(value, derivedKey);
  await chromeSet(STORAGE_KEYS.SECRET_PREFIX + key, encrypted);
}

export async function getSecret(key: string): Promise<string | null> {
  if (!derivedKey) throw new Error("Vault is locked");
  const encrypted = await chromeGet<EncryptedData>(
    STORAGE_KEYS.SECRET_PREFIX + key,
  );
  if (!encrypted) return null;
  return decrypt(encrypted, derivedKey);
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await chromeSet(STORAGE_KEYS.SETTINGS, settings);
}

export async function getSettings(): Promise<UserSettings> {
  const settings = await chromeGet<UserSettings>(STORAGE_KEYS.SETTINGS);
  return settings ?? { ...DEFAULT_SETTINGS };
}
