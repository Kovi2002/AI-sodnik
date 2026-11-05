"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, caseKeyStorageKey, storage } from "@/lib/client";
import { LIMITS, charCount } from "@/lib/validation";
import { SeriousNotice } from "./SeriousNotice";

type Fields = { nameA: string; nameB: string; topic: string; statement: string };
type CreateResult = { serious: true } | { serious: false; id: string; key: string };

const EMPTY: Fields = { nameA: "", nameB: "", topic: "", statement: "" };
const DRAFT_KEY = "kjk:draft";

export function NewCase() {
  const router = useRouter();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [serious, setSerious] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  // Restore an unsent draft, e.g. after a failed attempt and a reload.
  useEffect(() => {
    const raw = storage.get(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as Partial<Fields>;
      setFields({ ...EMPTY, ...draft });
    } catch {
      storage.remove(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function update(name: keyof Fields, value: string) {
    const next = { ...fields, [name]: value };
    setFields(next);
    storage.set(DRAFT_KEY, JSON.stringify(next));
    if (error?.field === name) setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<CreateResult>("/api/cases", { method: "POST", body: JSON.stringify(fields) });
      storage.remove(DRAFT_KEY);
      if (result.serious) {
        setFields(EMPTY);
        setBusy(false);
        setSerious(true);
        window.scrollTo(0, 0);
        return;
      }
      storage.set(caseKeyStorageKey(result.id), result.key);
      router.push(`/z/${result.id}#k=${result.key}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Nekaj je šlo narobe. Poskusi znova.", 0));
      setBusy(false);
    }
  }

  if (serious) {
    return (
      <div className="stack-lg">
        <SeriousNotice variant="new" />
        <button type="button" className="btn btn-secondary" onClick={() => setSerious(false)}>
          Nazaj na začetek
        </button>
      </div>
    );
  }

  const statementLength = charCount(fields.statement.trim());
  const invalid = (name: keyof Fields) => (error?.field === name ? true : undefined);

  return (
    <div className="stack-lg">
      <section className="stack">
        <h1 className="display">Kdo je kriv?</h1>
        <p className="lede">
          Vsak napiše svojo plat zgodbe. Sodnik prebere obe in razsodi. Smrtno resno, čeprav gre za posodo.
        </p>
        <ol className="steps">
          <li>Opišeš prepir in dobiš povezavo.</li>
          <li>Druga oseba odgovori. Tvoje izjave pred razsodbo ne vidi.</li>
          <li>Sodnik razdeli krivdo in izreče kazen.</li>
        </ol>
      </section>

      <hr className="divider" />

      <form className="form" onSubmit={submit} noValidate aria-busy={busy}>
        <div className="row-2">
          <div className="field">
            <label className="label" htmlFor="nameA">
              Tvoje ime
            </label>
            <input
              id="nameA"
              className="input"
              autoComplete="given-name"
              maxLength={LIMITS.name}
              required
              value={fields.nameA}
              aria-invalid={invalid("nameA")}
              onChange={(e) => update("nameA", e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="nameB">
              Ime druge osebe
            </label>
            <input
              id="nameB"
              className="input"
              autoComplete="off"
              maxLength={LIMITS.name}
              required
              value={fields.nameB}
              aria-invalid={invalid("nameB")}
              onChange={(e) => update("nameB", e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="topic">
            Zadeva
          </label>
          <input
            id="topic"
            className="input"
            autoComplete="off"
            maxLength={LIMITS.topic}
            placeholder="npr. Kdo bi moral pomiti posodo od sobote"
            required
            value={fields.topic}
            aria-invalid={invalid("topic")}
            aria-describedby="topic-hint"
            onChange={(e) => update("topic", e.target.value)}
          />
          <p id="topic-hint" className="hint">
            <span>To vidi tudi druga oseba.</span>
            <span>
              {charCount(fields.topic)}/{LIMITS.topic}
            </span>
          </p>
        </div>

        <div className="field">
          <label className="label" htmlFor="statement">
            Tvoja plat zgodbe
          </label>
          <textarea
            id="statement"
            className="textarea"
            maxLength={LIMITS.statement + 50}
            required
            value={fields.statement}
            aria-invalid={invalid("statement")}
            aria-describedby="statement-hint"
            onChange={(e) => update("statement", e.target.value)}
          />
          <p id="statement-hint" className="hint">
            <span>Druga oseba jo vidi šele z razsodbo.</span>
            <span className={statementLength < LIMITS.statementMin || statementLength > LIMITS.statement ? "counter-low" : undefined}>
              {statementLength}/{LIMITS.statement}
            </span>
          </p>
        </div>

        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="alert">
            {error.message}
          </div>
        )}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "Sodnik pregleduje vlogo …" : "Vloži zadevo"}
        </button>
      </form>
    </div>
  );
}
