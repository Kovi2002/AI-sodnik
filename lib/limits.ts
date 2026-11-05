import { query } from "./db";

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const ipDailyLimit = () => envInt("IP_DAILY_LIMIT", 15);
export const aiDailyLimit = () => envInt("AI_DAILY_LIMIT", 200);

/** Calendar day in Slovenia, so limits reset at local midnight. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Ljubljana" }).format(new Date());
}

/**
 * Atomically increments a daily counter unless it has reached the limit.
 * Returns false when the limit is already used up.
 */
async function consume(scope: string, limit: number): Promise<boolean> {
  if (limit <= 0) return false;
  const day = today();
  const { rows } = await query<{ count: number }>(
    `INSERT INTO usage_counters (key, day, count) VALUES ($1, $2::date, 1)
     ON CONFLICT (key) DO UPDATE SET count = usage_counters.count + 1
       WHERE usage_counters.count < $3
     RETURNING count`,
    [`${scope}:${day}`, day, limit],
  );
  return rows.length > 0;
}

export const consumeIpQuota = (ipHash: string) => consume(`ip:${ipHash}`, ipDailyLimit());
export const consumeAiQuota = () => consume("ai", aiDailyLimit());
