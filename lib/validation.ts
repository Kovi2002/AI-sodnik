import { AppError } from "./errors";

export const LIMITS = {
  name: 30,
  topicMin: 3,
  topic: 90,
  statementMin: 20,
  statement: 1500,
  reason: 500,
} as const;

/** Counts characters the way people do (č is one character, emoji too). */
export const charCount = (s: string) => [...s].length;

// Format characters (zero-width, bidi overrides) are dropped; other control characters become spaces.
const FORMAT_CHARS = /\p{Cf}/gu;
const CONTROL_CHARS = /[\p{Cc}\p{Zl}\p{Zp}]/gu;
const CONTROL_CHARS_EXCEPT_NEWLINE = /(?!\n)[\p{Cc}\p{Zl}\p{Zp}]/gu;

function cleanLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(FORMAT_CHARS, "")
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(FORMAT_CHARS, "")
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function name(value: unknown, field: string, message: string): string {
  const v = cleanLine(value);
  if (charCount(v) < 1 || charCount(v) > LIMITS.name) throw new AppError(400, "invalid", message, field);
  return v;
}

export function statement(value: unknown, field = "statement"): string {
  const v = cleanText(value);
  const n = charCount(v);
  if (n < LIMITS.statementMin || n > LIMITS.statement) {
    throw new AppError(
      400,
      "invalid",
      n < LIMITS.statementMin
        ? `Izjava je prekratka: ima ${n} znakov, potrebnih je vsaj ${LIMITS.statementMin}.`
        : `Izjava je predolga: ima ${n} znakov, dovoljenih je največ ${LIMITS.statement}.`,
      field,
    );
  }
  return v;
}

export function parseNewCase(body: Record<string, unknown>) {
  const nameA = name(body.nameA, "nameA", `Vpiši svoje ime (do ${LIMITS.name} znakov).`);
  const nameB = name(body.nameB, "nameB", `Vpiši ime druge osebe (do ${LIMITS.name} znakov).`);
  const topic = cleanLine(body.topic);
  if (charCount(topic) < LIMITS.topicMin || charCount(topic) > LIMITS.topic) {
    throw new AppError(
      400,
      "invalid",
      `Zadeva naj ima od ${LIMITS.topicMin} do ${LIMITS.topic} znakov.`,
      "topic",
    );
  }
  return { nameA, nameB, topic, statement: statement(body.statement) };
}

export function reportReason(value: unknown): string {
  const v = cleanText(value);
  if (charCount(v) < 3 || charCount(v) > LIMITS.reason) {
    throw new AppError(400, "invalid", `Na kratko opiši razlog (od 3 do ${LIMITS.reason} znakov).`, "reason");
  }
  return v;
}
