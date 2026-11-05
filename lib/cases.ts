import { judgeCase, screenNewCase, type Verdict } from "./ai";
import { query } from "./db";
import { AppError } from "./errors";
import { consumeAiQuota, consumeIpQuota, ipDailyLimit } from "./limits";
import { hashKey, isValidCaseId, keyMatches, newCaseId, newKey } from "./security";

/**
 * awaiting: only the first statement is in
 * ready:    both statements are in, no verdict yet (or the last attempt failed)
 * judging:  a request has claimed the case and is waiting for the model
 * done:     verdict issued
 * serious:  a serious topic was found; names and statements are wiped
 */
type Status = "awaiting" | "ready" | "judging" | "done" | "serious";
export type Role = "owner" | "responder" | "guest";

type CaseRow = {
  id: string;
  owner_key_hash: string;
  responder_key_hash: string | null;
  status: Status;
  name_a: string | null;
  name_b: string | null;
  topic: string | null;
  statement_a: string | null;
  statement_b: string | null;
  verdict: Verdict | null;
  verdict_error: "failed" | "limit" | null;
  expires_at: Date;
  stale: boolean;
};

export type CaseView = {
  id: string;
  status: Status;
  role: Role;
  nameA: string | null;
  nameB: string | null;
  topic: string | null;
  /** The viewer's own statement while the other one is still hidden. */
  ownStatement: string | null;
  statementA: string | null;
  statementB: string | null;
  verdict: Verdict | null;
  error: "failed" | "limit" | null;
  expiresAt: string;
};

const notFound = () =>
  new AppError(404, "not_found", "Te zadeve ni. Morda je bila izbrisana ali je potekla, saj se zadeve po 7 dneh izbrišejo.");

const ipLimitError = () =>
  new AppError(
    429,
    "ip_limit",
    `Z tega omrežja je bilo danes oddanih že ${ipDailyLimit()} vlog, kolikor je dnevna omejitev. Poskusi spet jutri.`,
  );

const aiLimitError = () =>
  new AppError(
    503,
    "ai_limit",
    "Sodnik je za danes porabil vse razpoložljive obravnave. Vnos ostane izpolnjen, poskusi jutri.",
  );

const aiFailedError = () =>
  new AppError(
    502,
    "ai_failed",
    "Sodnik se trenutno ne odziva. Vnos ostane izpolnjen, poskusi znova čez minuto.",
  );

async function loadCase(id: string): Promise<CaseRow> {
  if (!isValidCaseId(id)) throw notFound();
  const { rows } = await query<CaseRow>(
    `SELECT *, (status = 'judging' AND judging_started_at < now() - interval '2 minutes') AS stale
       FROM cases WHERE id = $1 AND expires_at > now()`,
    [id],
  );
  if (!rows[0]) throw notFound();
  return rows[0];
}

function roleFor(row: CaseRow, key: string | null): Role {
  if (keyMatches(key, row.owner_key_hash)) return "owner";
  if (keyMatches(key, row.responder_key_hash)) return "responder";
  return "guest";
}

function toView(row: CaseRow, role: Role): CaseView {
  const base: CaseView = {
    id: row.id,
    status: row.status,
    role,
    nameA: null,
    nameB: null,
    topic: null,
    ownStatement: null,
    statementA: null,
    statementB: null,
    verdict: null,
    error: null,
    expiresAt: row.expires_at.toISOString(),
  };
  if (row.status === "serious") return base;

  const view: CaseView = { ...base, nameA: row.name_a, nameB: row.name_b, topic: row.topic };
  if (row.status === "done") {
    return { ...view, verdict: row.verdict, statementA: row.statement_a, statementB: row.statement_b };
  }
  // Before the verdict each side sees only its own statement, never the other one.
  if (role === "owner") view.ownStatement = row.statement_a;
  if (role === "responder") view.ownStatement = row.statement_b;
  if (row.status === "judging" && row.stale) return { ...view, status: "ready", error: "failed" };
  if (row.status === "ready") view.error = row.verdict_error;
  return view;
}

async function purgeExpired() {
  await query(
    `DELETE FROM cases WHERE expires_at <= now();
     DELETE FROM usage_counters WHERE day < (now() AT TIME ZONE 'Europe/Ljubljana')::date - 2;
     DELETE FROM reports WHERE created_at < now() - interval '30 days';`,
  );
}

export async function createCase(
  input: { nameA: string; nameB: string; topic: string; statement: string },
  ipHash: string,
): Promise<{ serious: true } | { serious: false; id: string; key: string }> {
  await purgeExpired();
  if (!(await consumeIpQuota(ipHash))) throw ipLimitError();
  if (!(await consumeAiQuota())) throw aiLimitError();

  const screen = await screenNewCase(input);
  if (screen.kind === "serious") return { serious: true };
  if (screen.kind === "error") throw aiFailedError();

  const id = newCaseId();
  const key = newKey();
  await query(
    `INSERT INTO cases (id, owner_key_hash, status, name_a, name_b, topic, statement_a, expires_at)
     VALUES ($1, $2, 'awaiting', $3, $4, $5, $6, now() + interval '7 days')`,
    [id, hashKey(key), input.nameA, input.nameB, input.topic, input.statement],
  );
  return { serious: false, id, key };
}

export async function getCaseView(id: string, key: string | null): Promise<CaseView> {
  const row = await loadCase(id);
  return toView(row, roleFor(row, key));
}

/** Releases a claimed case so the verdict can be retried. */
async function releaseClaim(id: string, token: string, reason: "failed" | "limit") {
  await query(
    `UPDATE cases SET status = 'ready', verdict_error = $3, claim_token = NULL, judging_started_at = NULL
      WHERE id = $1 AND claim_token = $2 AND status = 'judging'`,
    [id, token, reason],
  );
}

/**
 * Atomically claims the case and asks the model for a verdict. Concurrent callers
 * cannot both win the claim; a claim older than two minutes counts as abandoned.
 */
async function judge(id: string): Promise<void> {
  const token = newKey();
  const { rows } = await query<CaseRow>(
    `UPDATE cases
        SET status = 'judging', judging_started_at = now(), claim_token = $2, verdict_error = NULL
      WHERE id = $1 AND expires_at > now()
        AND (status = 'ready'
             OR (status = 'judging' AND judging_started_at < now() - interval '2 minutes'))
      RETURNING name_a, name_b, topic, statement_a, statement_b`,
    [id, token],
  );
  const row = rows[0];
  if (!row) return;

  let settled = false;
  try {
    if (!(await consumeAiQuota())) {
      await releaseClaim(id, token, "limit");
      settled = true;
      return;
    }
    const result = await judgeCase({
      nameA: row.name_a ?? "",
      nameB: row.name_b ?? "",
      topic: row.topic ?? "",
      statementA: row.statement_a ?? "",
      statementB: row.statement_b ?? "",
    });
    if (result.kind === "serious") {
      // A statement may reveal abuse, so nothing is kept and neither side sees anything.
      await query(
        `UPDATE cases SET status = 'serious', name_a = NULL, name_b = NULL, topic = NULL,
                statement_a = NULL, statement_b = NULL, verdict = NULL, verdict_error = NULL,
                claim_token = NULL, judging_started_at = NULL
          WHERE id = $1`,
        [id],
      );
      settled = true;
    } else if (result.kind === "ok") {
      await query(
        `UPDATE cases SET status = 'done', verdict = $3, claim_token = NULL, judging_started_at = NULL
          WHERE id = $1 AND claim_token = $2 AND status = 'judging'`,
        [id, token, JSON.stringify(result.value)],
      );
      settled = true;
    }
  } finally {
    if (!settled) await releaseClaim(id, token, "failed");
  }
}

export async function submitResponse(id: string, statement: string, ipHash: string) {
  const row = await loadCase(id);
  if (row.status !== "awaiting") {
    throw new AppError(409, "already_answered", "Na to zadevo je nekdo že odgovoril. Osveži stran.");
  }
  if (!(await consumeIpQuota(ipHash))) throw ipLimitError();

  const key = newKey();
  const updated = await query(
    `UPDATE cases SET statement_b = $2, responder_key_hash = $3, status = 'ready'
      WHERE id = $1 AND status = 'awaiting' AND expires_at > now()`,
    [id, statement, hashKey(key)],
  );
  if (!updated.rowCount) {
    throw new AppError(409, "already_answered", "Na to zadevo je nekdo že odgovoril. Osveži stran.");
  }
  await judge(id);
  return { key, view: await getCaseView(id, key) };
}

export async function retryVerdict(id: string, key: string | null, ipHash: string): Promise<CaseView> {
  const row = await loadCase(id);
  const role = roleFor(row, key);
  if (role === "guest") {
    throw new AppError(403, "forbidden", "Ponovni poskus lahko sproži le ena od strank v zadevi.");
  }
  if (toView(row, role).status !== "ready") return toView(row, role);
  if (!(await consumeIpQuota(ipHash))) throw ipLimitError();
  await judge(id);
  return getCaseView(id, key);
}

export async function deleteCase(id: string, key: string | null): Promise<void> {
  const row = await loadCase(id);
  if (roleFor(row, key) === "guest") {
    throw new AppError(403, "forbidden", "Zadevo lahko izbrišeta le stranki, ki sta jo vložili.");
  }
  await query(`DELETE FROM cases WHERE id = $1`, [id]);
}

export async function reportCase(id: string, reason: string): Promise<void> {
  const row = await loadCase(id);
  if (row.status !== "done") throw new AppError(409, "no_verdict", "Prijaviš lahko le izrečeno razsodbo.");
  // At most a few reports per case, so the table cannot be flooded through one link.
  await query(
    `INSERT INTO reports (case_id, reason, verdict)
     SELECT id, $2, verdict FROM cases
      WHERE id = $1 AND (SELECT count(*) FROM reports WHERE case_id = $1) < 5`,
    [id, reason],
  );
}

export async function getVerdictForImage(id: string) {
  const row = await loadCase(id);
  if (row.status !== "done" || !row.verdict) throw notFound();
  return { id: row.id, nameA: row.name_a ?? "", nameB: row.name_b ?? "", topic: row.topic ?? "", verdict: row.verdict };
}
