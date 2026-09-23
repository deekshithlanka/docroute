"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SampleInfo { id: string; title: string; what_it_shows: string }

export function Intake({ samples, live }: { samples: SampleInfo[]; live: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(body: FormData, label: string) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch("/api/extract", { method: "POST", body });
      const data = await res.json();
      if (!res.ok && !data.id) throw new Error(data.error ?? `Request failed (${res.status})`);
      router.push(`/documents/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  }

  function upload(file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setError("Only PDF files can be read. Scan or export the document as PDF first.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("That PDF is over 4 MB. Split it or compress it and try again.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    send(fd, `Reading ${file.name}`);
  }

  function runSample(id: string) {
    const fd = new FormData();
    fd.append("sampleId", id);
    send(fd, "Reading sample");
  }

  return (
    <section className="intake">
      <h1>Document intake</h1>
      <p className="muted">
        Drop in a supplier invoice, change order or submittal. It gets read, checked against the job list, and sent to the right approver.
      </p>

      <label
        className="drop"
        data-over={over}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (live && !busy) upload(e.dataTransfer.files[0]); }}
      >
        <strong>{live ? "Drop a PDF here, or click to choose one" : "Uploads are off on this deployment"}</strong>
        <span className="small muted">
          {live ? "Up to 4 MB. Use invented or public documents only." : "Browse the samples below instead."}
        </span>
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          disabled={!live || Boolean(busy)}
          onChange={(e) => { upload(e.target.files?.[0]); if (input.current) input.current.value = ""; }}
        />
      </label>

      {busy && (
        <div className="busy small" role="status">
          <span>{busy}. This takes 5 to 20 seconds.</span>
          <span className="bar" aria-hidden />
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="samples">
        <h2>Sample documents</h2>
        <p className="small muted">Pre-loaded so you can see results without waiting.{live ? " Run one live to see real token counts and cost." : ""}</p>
        {samples.map((s) => (
          <div className="sample" key={s.id}>
            <div className="row">
              <Link href={`/documents/${s.id}`} className="row-link">{s.title}</Link>
            </div>
            <p className="small muted">{s.what_it_shows}</p>
            <div className="actions small">
              <Link href={`/documents/${s.id}`}>View result</Link>
              {live && (
                <button className="btn-link" disabled={Boolean(busy)} onClick={() => runSample(s.id)}>
                  Run live
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
