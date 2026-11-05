"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client";

export function DeleteCase({
  id,
  caseKey,
  label = "Izbriši primer",
  onDeleted,
}: {
  id: string;
  caseKey: string | null;
  label?: string;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe choice once the confirmation is on screen.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!caseKey) return null;

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/cases/${id}`, { method: "DELETE", headers: { "x-case-key": caseKey! } });
      onDeleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Brisanje ni uspelo. Poskusi znova.");
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        className="btn btn-link"
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="confirm" role="group" aria-labelledby={`delete-${id}`}>
      <p id={`delete-${id}`}>
        <strong>Res izbrišem zadevo?</strong> Obe izjavi, imeni in razsodba bodo takoj izbrisani za obe strani.
        Tega ni mogoče razveljaviti.
      </p>
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <div className="actions actions-row">
        <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>
          {busy ? "Brišem …" : "Da, izbriši"}
        </button>
        <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>
          Prekliči
        </button>
      </div>
    </div>
  );
}
