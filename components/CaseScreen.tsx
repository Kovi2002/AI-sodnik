"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CaseView } from "@/lib/cases";
import { api, ApiError, caseKeyStorageKey, shareLink, storage } from "@/lib/client";
import { LIMITS, charCount } from "@/lib/validation";
import { DeleteCase } from "./DeleteCase";
import { SeriousNotice } from "./SeriousNotice";
import { VerdictView } from "./VerdictView";

const POLL_MS = 4000;

function readKeyFromHash(): string | null {
  const match = window.location.hash.match(/[#&]k=([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export function CaseScreen({ id }: { id: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [view, setView] = useState<CaseView | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [deleted, setDeleted] = useState(false);
  const keyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const headers: Record<string, string> = keyRef.current ? { "x-case-key": keyRef.current } : {};
      const next = await api<CaseView>(`/api/cases/${id}`, { headers });
      setView(next);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err : new ApiError("Zadeve ni bilo mogoče naložiti.", 0));
    }
  }, [id]);

  useEffect(() => {
    const fromHash = readKeyFromHash();
    const k = fromHash ?? storage.get(caseKeyStorageKey(id));
    if (fromHash) storage.set(caseKeyStorageKey(id), fromHash);
    keyRef.current = k;
    setKey(k);
    void load();
  }, [id, load]);

  const shouldPoll =
    !!view &&
    !deleted &&
    ((view.status === "awaiting" && view.role === "owner") ||
      view.status === "judging" ||
      (view.status === "ready" && !view.error));

  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [shouldPoll, load]);

  function adoptKey(k: string) {
    keyRef.current = k;
    setKey(k);
    storage.set(caseKeyStorageKey(id), k);
    window.history.replaceState(null, "", `${window.location.pathname}#k=${k}`);
  }

  function onDeleted() {
    storage.remove(caseKeyStorageKey(id));
    window.history.replaceState(null, "", window.location.pathname);
    setDeleted(true);
  }

  if (deleted) {
    return (
      <div className="stack">
        <p className="kicker">Zadeva izbrisana</p>
        <h1 className="title">Spis je uničen.</h1>
        <p className="lede">Izjave, imena in razsodba so izbrisani.</p>
        <Link href="/" className="btn btn-secondary">
          Vloži novo zadevo
        </Link>
      </div>
    );
  }

  if (!view) {
    if (loadError) {
      return (
        <div className="stack">
          <p className="kicker">Napaka</p>
          <h1 className="title">{loadError.status === 404 ? "Zadeve ni mogoče najti." : "Zadeve ni bilo mogoče naložiti."}</h1>
          <p className="lede">{loadError.message}</p>
          {loadError.status === 404 ? (
            <Link href="/" className="btn btn-secondary">
              Vloži novo zadevo
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => void load()}>
              Poskusi znova
            </button>
          )}
        </div>
      );
    }
    return (
      <p className="status-line" role="status">
        Nalagam spis …
      </p>
    );
  }

  if (view.status === "serious") return <SeriousNotice variant="case" />;

  return (
    <div className="stack-lg">
      <header className="case-head">
        <p className="kicker">Zadeva št. {id.slice(0, 6).toUpperCase()}</p>
        <h1 className="title">{view.topic}</h1>
        <p className="parties">
          <span className="muted">Stranki:</span> {view.nameA} in {view.nameB}
        </p>
      </header>

      {view.status === "done" && view.verdict ? (
        <VerdictView view={view} caseKey={key} onDeleted={onDeleted} />
      ) : view.status === "awaiting" && view.role === "owner" ? (
        <OwnerWaiting view={view} caseKey={key} onDeleted={onDeleted} />
      ) : view.status === "awaiting" ? (
        <RespondForm view={view} onAnswered={(k, v) => (adoptKey(k), setView(v))} />
      ) : view.status === "ready" && view.error ? (
        <VerdictFailed view={view} caseKey={key} onUpdate={setView} />
      ) : (
        <Judging view={view} />
      )}

      {loadError && view && (
        <p className="small muted" role="status">
          Osveževanje ni uspelo: {loadError.message}
        </p>
      )}
    </div>
  );
}

function OwnStatement({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <details className="disclosure">
      <summary>Tvoja izjava</summary>
      <p className="statement">{text}</p>
    </details>
  );
}

function OwnerWaiting({
  view,
  caseKey,
  onDeleted,
}: {
  view: CaseView;
  caseKey: string | null;
  onDeleted: () => void;
}) {
  const [shareState, setShareState] = useState<string | null>(null);
  const [partnerUrl, setPartnerUrl] = useState("");
  const [ownUrl, setOwnUrl] = useState("");

  useEffect(() => {
    setPartnerUrl(`${window.location.origin}/z/${view.id}`);
    setOwnUrl(`${window.location.origin}/z/${view.id}#k=${caseKey ?? ""}`);
  }, [view.id, caseKey]);

  async function share() {
    const result = await shareLink({
      title: "Kdo je kriv?",
      text: `Sodišče te vabi k zadevi »${view.topic}«. Napiši svojo plat zgodbe:`,
      url: partnerUrl,
    });
    setShareState(
      result === "copied"
        ? "Povezava je kopirana. Prilepi jo v sporočilo."
        : result === "failed"
          ? "Kopiranje ni uspelo. Označi povezavo spodaj in jo kopiraj ročno."
          : null,
    );
  }

  async function copyOwn() {
    try {
      await navigator.clipboard.writeText(ownUrl);
      setShareState("Tvoja zasebna povezava je kopirana. Shrani jo zase.");
    } catch {
      setShareState("Kopiranje ni uspelo. Povezavo shrani tako, da si zaznamuješ to stran.");
    }
  }

  return (
    <div className="stack-lg">
      <section className="stack">
        <h2 className="kicker kicker-accent">Zadeva je vložena</h2>
        <p className="lede">
          Pošlji povezavo osebi, s katero se prepirata. Tvoje izjave pred razsodbo ne bo videla.
        </p>
        <button type="button" className="btn btn-primary btn-block" onClick={share} disabled={!partnerUrl}>
          Deli povezavo
        </button>
        <label className="field">
          <span className="small muted">Povezava za drugo osebo</span>
          <input className="input share-url" readOnly value={partnerUrl} onFocus={(e) => e.currentTarget.select()} />
        </label>
        {shareState && (
          <p className="small" role="status">
            {shareState}
          </p>
        )}
      </section>

      <div className="note stack">
        <p className="status-line">
          <span className="status-dot" aria-hidden="true" />
          Čakamo, da {view.nameB} odda svojo plat. Razsodba se tu prikaže sama.
        </p>
        <p className="small muted">
          Ta stran ima v naslovu tvoj zasebni ključ. Z njim se vrneš k zadevi in jo lahko izbrišeš. Ne deli je.
        </p>
        <button type="button" className="btn btn-secondary" onClick={copyOwn} disabled={!ownUrl}>
          Kopiraj mojo zasebno povezavo
        </button>
      </div>

      <OwnStatement text={view.ownStatement} />
      <DeleteCase id={view.id} caseKey={caseKey} label="Umakni zadevo" onDeleted={onDeleted} />
    </div>
  );
}

function RespondForm({
  view,
  onAnswered,
}: {
  view: CaseView;
  onAnswered: (key: string, view: CaseView) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const draftKey = `kjk:reply:${view.id}`;

  useEffect(() => {
    const saved = storage.get(draftKey);
    if (saved) setText(saved);
  }, [draftKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ key: string; view: CaseView }>(`/api/cases/${view.id}/response`, {
        method: "POST",
        body: JSON.stringify({ statement: text }),
      });
      storage.remove(draftKey);
      onAnswered(result.key, result.view);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Nekaj je šlo narobe. Poskusi znova.", 0));
      setBusy(false);
    }
  }

  const length = charCount(text.trim());

  return (
    <form className="form" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="stack">
        <h2 className="kicker kicker-accent">Na vrsti si ti</h2>
        <p className="lede">
          {view.nameA} te kliče pred sodišče. Napiši svojo plat zgodbe. Izjave druge strani ne vidiš, pokaže se
          šele z razsodbo.
        </p>
      </div>
      <div className="field">
        <label className="label" htmlFor="reply">
          Tvoja plat zgodbe{view.nameB ? ` (${view.nameB})` : ""}
        </label>
        <textarea
          id="reply"
          className="textarea"
          maxLength={LIMITS.statement + 50}
          value={text}
          aria-invalid={error?.field === "statement" ? true : undefined}
          aria-describedby="reply-hint"
          onChange={(e) => {
            setText(e.target.value);
            storage.set(draftKey, e.target.value);
          }}
        />
        <p id="reply-hint" className="hint">
          <span>Ko oddaš, sodnik takoj razsodi.</span>
          <span className={length < LIMITS.statementMin || length > LIMITS.statement ? "counter-low" : undefined}>
            {length}/{LIMITS.statement}
          </span>
        </p>
      </div>
      {error && (
        <div role="alert" className="alert">
          {error.message}
        </div>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "Sodnik bere spis …" : "Oddaj in zahtevaj razsodbo"}
      </button>
    </form>
  );
}

function Judging({ view }: { view: CaseView }) {
  return (
    <div className="stack">
      <p className="status-line" role="status">
        <span className="status-dot" aria-hidden="true" />
        Obe izjavi sta prispeli. Sodnik bere spis.
      </p>
      <p className="small muted">Razsodba se tu prikaže sama, običajno v nekaj sekundah.</p>
      <OwnStatement text={view.ownStatement} />
    </div>
  );
}

function VerdictFailed({
  view,
  caseKey,
  onUpdate,
}: {
  view: CaseView;
  caseKey: string | null;
  onUpdate: (v: CaseView) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const isParty = view.role !== "guest";

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      const next = await api<CaseView>(`/api/cases/${view.id}/verdict`, {
        method: "POST",
        headers: caseKey ? { "x-case-key": caseKey } : {},
      });
      onUpdate(next);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("Nekaj je šlo narobe. Poskusi znova.", 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h2 className="kicker kicker-accent">Razsodba ni uspela</h2>
      <p className="lede">
        {view.error === "limit"
          ? "Sodnik je za danes porabil vse obravnave. Obe izjavi sta shranjeni, razsodbo lahko zahtevaš jutri."
          : "Sodnik se ni odzval. Obe izjavi sta shranjeni, zato lahko razsodbo preprosto zahtevaš znova."}
      </p>
      {error && (
        <div role="alert" className="alert">
          {error.message}
        </div>
      )}
      {isParty ? (
        <button type="button" className="btn btn-primary btn-block" onClick={retry} disabled={busy}>
          {busy ? "Sodnik bere spis …" : "Poskusi znova"}
        </button>
      ) : (
        <p className="small muted">Ponovni poskus lahko sproži ena od strank v zadevi.</p>
      )}
      <OwnStatement text={view.ownStatement} />
    </div>
  );
}
