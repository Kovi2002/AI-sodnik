export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export class ConfigError extends Error {}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: NO_STORE });
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return json({ error: { code: err.code, message: err.message, field: err.field } }, err.status);
  }
  if (err instanceof ConfigError) {
    console.error("config error:", err.message);
    return json(
      { error: { code: "config", message: "Strežnik ni pravilno nastavljen. Sporoči skrbniku aplikacije." } },
      500,
    );
  }
  // Only the error type and message are logged, never request bodies or statements.
  console.error("unexpected error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  return json(
    { error: { code: "server", message: "Na strežniku je šlo nekaj narobe. Poskusi znova čez trenutek." } },
    500,
  );
}

const MAX_BODY_BYTES = 16 * 1024;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    throw new AppError(413, "too_large", "Vnos je predolg.");
  }
  try {
    const data: unknown = JSON.parse(text || "{}");
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new AppError(400, "bad_json", "Zahteva ni veljavna. Osveži stran in poskusi znova.");
}
