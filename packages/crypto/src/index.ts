import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export function encryptSecret(plaintext: string, keyMaterial = requiredEnv("ENCRYPTION_KEY")) {
  const key = normalizeKey(keyMaterial);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string, keyMaterial = requiredEnv("ENCRYPTION_KEY")) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) {
    throw new Error("Unsupported encrypted secret format");
  }

  const decipher = createDecipheriv(ALGORITHM, normalizeKey(keyMaterial), Buffer.from(iv, "base64url"), {
    authTagLength: AUTH_TAG_BYTES
  });
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(digest).toString("hex");
}

export function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeKey(keyMaterial: string) {
  const maybeBase64 = Buffer.from(keyMaterial, "base64");
  if (maybeBase64.length === 32) return maybeBase64;
  if (Buffer.byteLength(keyMaterial) === 32) return Buffer.from(keyMaterial);
  return scryptSync(keyMaterial, "korepush-secret-key", 32);
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
