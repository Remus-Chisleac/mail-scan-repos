import type { EncryptedData } from "./types";

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return bufferToBase64(salt.buffer);
}

async function importKeyMaterial(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);
}

export async function deriveKey(
  password: string,
  saltB64: string,
): Promise<CryptoKey> {
  const keyMaterial = await importKeyMaterial(password);
  const salt = base64ToBuffer(saltB64);

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function hashPassword(
  password: string,
  saltB64: string,
): Promise<string> {
  const keyMaterial = await importKeyMaterial(password);
  const salt = base64ToBuffer(saltB64);

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS + 1,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return bufferToBase64(bits);
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<EncryptedData> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );

  return {
    iv: bufferToBase64(iv.buffer),
    ciphertext: bufferToBase64(cipherBuffer),
  };
}

export async function decrypt(
  data: EncryptedData,
  key: CryptoKey,
): Promise<string> {
  const iv = new Uint8Array(base64ToBuffer(data.iv));
  const ciphertext = base64ToBuffer(data.ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(plainBuffer);
}
