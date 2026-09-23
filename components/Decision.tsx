"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Decision({ id, flagged, approver }: { id: string; flagged: boolean; approver: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(decision);
    setError(null);
    const res = await fetch(`/api/documents/${id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setError(data.error ?? `Request failed (${res.status})`);
      return;
    }
    router.refresh();
  }

  const noteRequired = flagged;
  return (
    <div className="panel decide">
      <h2>Decision</h2>
      <p className="small muted" style={{ marginBottom: 12 }}>
        You're reviewing as the {approver}. Approving posts it to the ERP and notifies the team.
      </p>
      <label htmlFor="note">
        Note {noteRequired ? "(required: this document failed a check)" : "(required to reject)"}
      </label>
      <textarea
        id="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={flagged ? "e.g. Called vendor, corrected invoice is on the way" : "Optional for approval"}
      />
      <div className="buttons">
        <button className="btn-approve" disabled={Boolean(busy) || (noteRequired && !note.trim())} onClick={() => decide("approve")}>
          {busy === "approve" ? "Approving…" : flagged ? "Approve anyway" : "Approve"}
        </button>
        <button className="btn-reject" disabled={Boolean(busy) || !note.trim()} onClick={() => decide("reject")}>
          {busy === "reject" ? "Rejecting…" : "Reject"}
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
