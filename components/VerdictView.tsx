"use client";

import { useEffect, useState } from "react";
import type { CaseView } from "@/lib/cases";
import { api, ApiError, shareLink } from "@/lib/client";
import { LIMITS } from "@/lib/validation";
import { DeleteCase } from "./DeleteCase";

const REVEAL_DELAY_MS = 250;
const REVEAL_MS = 1400;

/** Eased 0..1 progress of the one reveal animation; jumps to 1 for reduced motion. */
function useRevealProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setProgress(1);
      return;
    }
    let frame = 0;
    const start = performance.now() + REVEAL_DELAY_MS;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / REVEAL_MS));
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  return progress;
}

function BlameMeter({ nameA, nameB, blameA, blameB }: { nameA: string; nameB: string; blameA: number; blameB: number }) {
  const p = useRevealProgress();
  const done = p >= 1;
  const aGuilty = blameA > blameB;
  const bGuilty = blameB > blameA;
  const shownA = Math.round(blameA * p);
  const shownB = Math.round(blameB * p);

  return (
    <div className="meter">
      <p className="sr-only">
        Delež krivde: {nameA} {blameA} odstotkov, {nameB} {blameB} odstotkov.
      </p>
      <div className="meter-parties" aria-hidden="true">
        <div className="meter-party">
          <span className="meter-name">{nameA}</span>
          <span className={`meter-value${done && aGuilty ? " is-guilty" : ""}`}>
            {shownA}
            <span className="pct">%</span>
          </span>
        </div>
        <div className="meter-party">
          <span className="meter-name">{nameB}</span>
          <span className={`meter-value${done && bGuilty ? " is-guilty" : ""}`}>
            {shownB}
            <span className="pct">%</span>
          </span>
        </div>
      </div>
      <div className="meter-bar" aria-hidden="true">
        <div className={`meter-fill left${done && aGuilty ? " is-guilty" : ""}`} style={{ width: `calc(${blameA * p}% - 2px)` }} />
        <div className={`meter-fill right${done && bGuilty ? " is-guilty" : ""}`} style={{ width: `calc(${blameB * p}% - 2px)` }} />
      </div>
      <p className="meter-caption" aria-hidden="true">
        Delež krivde
      </p>
    </div>
  );
}

function ImageButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function make() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/cases/${id}/image`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], "razsodba.png", { type: "image/png" });
      // Phones get the share sheet (straight to Instagram etc.); desktops get a plain download.
      const touch = window.matchMedia("(pointer: coarse)").matches;
      if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Razsodba" });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "razsodba.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMessage("Slika je shranjena med prenose.");
    } catch {
      setMessage("Slike ni bilo mogoče ustvariti. Poskusi znova čez trenutek.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={make} disabled={busy}>
        {busy ? "Pripravljam sliko …" : "Slika za objavo"}
      </button>
      {message && (
        <p className="small" role="status">
          {message}
        </p>
      )}
    </>
  );
}

function ReportForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <p className="small" role="status">
        Hvala. Prijava je shranjena.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-link" onClick={() => setOpen(true)}>
        Prijavi razsodbo
      </button>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/cases/${id}/report`, { method: "POST", body: JSON.stringify({ reason }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Prijava ni uspela. Poskusi znova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="note form" onSubmit={submit} noValidate>
      <div className="field">
        <label className="label" htmlFor="report-reason">
          Kaj je narobe z razsodbo?
        </label>
        <textarea
          id="report-reason"
          className="textarea"
          style={{ minHeight: 110 }}
          maxLength={LIMITS.reason}
          value={reason}
          autoFocus
          onChange={(e) => setReason(e.target.value)}
        />
        <p className="hint">
          <span>Npr. žaljivo, neprimerno ali napačno razumljeno.</span>
        </p>
      </div>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="actions actions-row">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Pošiljam …" : "Pošlji prijavo"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>
          Prekliči
        </button>
      </div>
    </form>
  );
}

export function VerdictView({
  view,
  caseKey,
  onDeleted,
}: {
  view: CaseView;
  caseKey: string | null;
  onDeleted: () => void;
}) {
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const verdict = view.verdict!;
  const nameA = view.nameA ?? "";
  const nameB = view.nameB ?? "";

  async function share() {
    const result = await shareLink({
      title: "Kdo je kriv?",
      text: `Razsodba v zadevi »${view.topic}«`,
      url: `${window.location.origin}/z/${view.id}`,
    });
    setShareMessage(
      result === "copied"
        ? "Povezava je kopirana. Kdor jo odpre, vidi razsodbo in obe izjavi."
        : result === "failed"
          ? "Kopiranje ni uspelo. Kopiraj naslov strani ročno."
          : null,
    );
  }

  return (
    <article className="verdict" aria-labelledby="verdict-title">
      <div className="verdict-head">
        <p className="kicker kicker-accent">Razsodba</p>
        <h2 id="verdict-title" className="title">
          {verdict.title}
        </h2>
      </div>

      <BlameMeter nameA={nameA} nameB={nameB} blameA={verdict.blameA} blameB={verdict.blameB} />

      <section className="stack" aria-label="Obrazložitev">
        <p className="kicker">Obrazložitev</p>
        <p className="reasoning">{verdict.reasoning}</p>
      </section>

      <section className="sentence" aria-label="Kazen">
        <p className="kicker kicker-accent">Kazen</p>
        <p>{verdict.punishment}</p>
      </section>

      <div className="actions actions-row">
        <ImageButton id={view.id} />
        <button type="button" className="btn btn-secondary" onClick={share}>
          Deli razsodbo
        </button>
      </div>
      {shareMessage && (
        <p className="small" role="status">
          {shareMessage}
        </p>
      )}

      <section aria-label="Izjavi strank">
        <p className="kicker" style={{ marginBottom: 8 }}>
          Spis
        </p>
        <details className="disclosure">
          <summary>Izjava: {nameA}</summary>
          <p className="statement">{view.statementA}</p>
        </details>
        <details className="disclosure">
          <summary>Izjava: {nameB}</summary>
          <p className="statement">{view.statementB}</p>
        </details>
      </section>

      <div className="stack" style={{ gap: 4, justifyItems: "start" }}>
        <ReportForm id={view.id} />
        <DeleteCase id={view.id} caseKey={caseKey} onDeleted={onDeleted} />
      </div>
    </article>
  );
}
