import { Pool, type QueryResultRow } from "pg";
import { ConfigError } from "./errors";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cases (
  id                  text PRIMARY KEY,
  owner_key_hash      text NOT NULL,
  responder_key_hash  text,
  status              text NOT NULL,
  name_a              text,
  name_b              text,
  topic               text,
  statement_a         text,
  statement_b         text,
  verdict             jsonb,
  verdict_error       text,
  claim_token         text,
  judging_started_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS cases_expires_at_idx ON cases (expires_at);

CREATE TABLE IF NOT EXISTS reports (
  id          bigserial PRIMARY KEY,
  case_id     text NOT NULL,
  reason      text NOT NULL,
  verdict     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_case_id_idx ON reports (case_id);

CREATE TABLE IF NOT EXISTS usage_counters (
  key    text PRIMARY KEY,
  day    date NOT NULL,
  count  integer NOT NULL
);
`;

const globalForDb = globalThis as unknown as {
  kjkPool?: Pool;
  kjkSchema?: Promise<void>;
};

function getPool(): Pool {
  if (!globalForDb.kjkPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new ConfigError("DATABASE_URL is not set");
    const pool = new Pool({ connectionString, max: 5 });
    pool.on("error", (err) => console.error("postgres pool error:", err.message));
    globalForDb.kjkPool = pool;
  }
  return globalForDb.kjkPool;
}

function ensureSchema(): Promise<void> {
  if (!globalForDb.kjkSchema) {
    globalForDb.kjkSchema = (async () => {
      const client = await getPool().connect();
      try {
        await client.query("BEGIN");
        // Serialises schema creation when several instances start at once.
        await client.query("SELECT pg_advisory_xact_lock(724113)");
        await client.query(SCHEMA);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    })().catch((err) => {
      globalForDb.kjkSchema = undefined;
      throw err;
    });
  }
  return globalForDb.kjkSchema;
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  await ensureSchema();
  return getPool().query<T>(text, params);
}
