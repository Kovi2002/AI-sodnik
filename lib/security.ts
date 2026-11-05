import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ConfigError } from "./errors";

/** 128 random bits, URL-safe. */
export function newCaseId(): string {
  return randomBytes(16).toString("base64url");
}

/** 192 random bits, URL-safe. */
export function newKey(): string {
  return randomBytes(24).toString("base64url");
}

export function isValidCaseId(id: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(id);
}

export function hashKey(key: string): string {
  return createHash("sha256").update(`case-key:${key}`).digest("hex");
}

export function keyMatches(key: string | null, storedHash: string | null): boolean {
  if (!key || !storedHash || key.length > 64) return false;
  const a = Buffer.from(hashKey(key), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Railway sets X-Real-IP; the raw address is never stored, only a salted hash. */
export function hashedClientIp(req: Request): string {
  const salt = process.env.IP_SALT;
  if (!salt) throw new ConfigError("IP_SALT is not set");
  const ip = req.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Neutralises angle brackets so user text cannot open or close prompt tags. */
export function neutralize(text: string): string {
  return text.replace(/</g, "‹").replace(/>/g, "›");
}
