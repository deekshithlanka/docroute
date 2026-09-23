import Link from "next/link";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/store";
import { findJob } from "@/lib/jobs";
import { Decision } from "@/components/Decision";
import { DOC_TYPE_LABEL, STATUS_LABEL, num, secs, shortDate, usd, usdMicro, pct } from "@/lib/format";
import type { Extraction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await getStore().getDoc(id);
  if (!doc) notFound();

  const x = doc.extraction;
  const failing = new Set(doc.checks.filter((c) => c.status !== "pass" && c.field).map((c) => c.field as keyof Extraction));
  const M = ({ f, children }: { f: keyof Extraction; children: React.ReactNode }) =>
    failing.has(f) ? <mark>{children}</mark> : <>{children}</>;
  const lineBad = (q: number | null, p: number | null, a: number | null) =>
    q !== null && p !== null && a !== null && Math.abs(q * p - a) > 0.01;
  const job = findJob(x?.job_number);
  const rank = { error: 0, warning: 1, pass: 2 } as const;
  const checks = [...doc.checks].sort((a, b) => rank[a.status] - rank[b.status]);
  const spent = doc.attempts.reduce((a, t) => a + t.cost_usd, 0);
  const open = doc.status === "ready_for_review" || doc.status === "needs_attention";

  return (
    <>
      <div className="doc-head">
        <div>
          <Link href="/" className="crumb small">Back to inbox</Link>
          <h1>{x?.vendor_name ?? doc.filename}</h1>
          <p className="muted">
            {x ? `${DOC_TYPE_LABEL[x.document_type]} ${x.document_number ?? ""}` : doc.filename}
            {x?.total != null && <>, <span className="num">{usd(x.total)}</span></>}
          </p>
        </div>
        <span className="status" data-s={doc.status}>{STATUS_LABEL[doc.status]}</span>
      </div>

      <div className="doc-grid">
        <div className="pdf">
          <iframe src={`/api/documents/${doc.id}/pdf`} title={`Original document: ${doc.filename}`} />
          <div className="cap small muted">
            <span>{doc.filename}</span>
            <a href={`/api/documents/${doc.id}/pdf`} target="_blank" rel="noreferrer">Open PDF</a>
          </div>
        </div>

        <div>
          {doc.routing && (
            <div className="panel route">
              <p className="route-line">Goes to the <strong>{doc.routing.approver_role}</strong></p>
              <p className="small muted">
                {doc.routing.reason}
                {job && ` for ${job.name} (PM ${job.project_manager})`}
              </p>
            </div>
          )}

          {doc.checks.length > 0 && (
            <div className="panel">
              <h2>Checks</h2>
              <ul className="checks">
                {checks.map((c) => (
                  <li key={c.id}>
                    <span className="tick" data-s={c.status} aria-label={c.status}>
                      {c.status === "pass" ? "✓" : "!"}
                    </span>
                    <span>{c.label}</span>
                    <span className="detail">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {open && doc.routing && (
            <Decision id={doc.id} flagged={doc.status === "needs_attention"} approver={doc.routing.approver_role} />
          )}

          {!open && doc.decided_at && (
            <div className="panel">
              <h2>{doc.status === "approved" ? "Approved" : "Rejected"}</h2>
              <p className="decided">
                {shortDate(doc.decided_at)}{doc.erp_id && <>, posted to ERP as <strong className="num">{doc.erp_id}</strong></>}
              </p>
              {doc.decision_note && <p className="small muted" style={{ marginTop: 6 }}>Note: {doc.decision_note}</p>}
              {doc.integrations.length > 0 && (
                <ul className="log" style={{ marginTop: 10 }}>
                  {doc.integrations.map((ev, i) => (
                    <li key={i}>
                      <span className="status" data-s={ev.ok ? "approved" : "failed"}>
                        {ev.target === "erp" ? "ERP" : ev.target === "notify" ? "Team chat" : "n8n"}
                      </span>{" "}
                      <span className="muted">{ev.detail}{ev.attempts > 1 ? ` after ${ev.attempts} tries` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {x ? (
            <div className="panel">
              <h2>What was read</h2>
              {x.summary && <p className="summary">{x.summary}</p>}
              <dl className="fields">
                <dt>Vendor</dt><dd>{x.vendor_name ?? "—"}</dd>
                <dt>Document #</dt><dd><M f="document_number">{x.document_number ?? "—"}</M></dd>
                <dt>Date</dt><dd className="num">{x.document_date ?? "—"}</dd>
                {x.due_date && <><dt>Due</dt><dd className="num"><M f="due_date">{x.due_date}</M></dd></>}
                <dt>Job</dt><dd><M f="job_number">{x.job_number ?? "missing"}</M>{x.job_name && <span className="muted">, {x.job_name}</span>}</dd>
                {x.po_number && <><dt>PO</dt><dd className="num">{x.po_number}</dd></>}
                {x.spec_section && <><dt>Spec section</dt><dd>{x.spec_section}</dd></>}
              </dl>

              {x.line_items.length > 0 && (
                <div className="table-wrap lines">
                  <table>
                    <thead>
                      <tr><th>Item</th><th className="r">Qty</th><th>Unit</th><th className="r">Unit price</th><th className="r">Amount</th></tr>
                    </thead>
                    <tbody>
                      {x.line_items.map((li, i) => {
                        const bad = lineBad(li.quantity, li.unit_price, li.amount);
                        return (
                          <tr key={i}>
                            <td>{li.description}</td>
                            <td className="r num">{num(li.quantity)}</td>
                            <td>{li.unit ?? ""}</td>
                            <td className="r num">{li.unit_price != null ? usd(li.unit_price) : "—"}</td>
                            <td className="r num">{bad ? <mark>{usd(li.amount)}</mark> : li.amount != null ? usd(li.amount) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {(x.subtotal !== null || x.total !== null) && (
                <div className="totals num">
                  {x.subtotal !== null && <><span className="muted">Subtotal</span><span><M f="subtotal">{usd(x.subtotal)}</M></span></>}
                  {x.tax !== null && <><span className="muted">Tax</span><span>{usd(x.tax)}</span></>}
                  {x.total !== null && <><span className="grand">Total</span><span className="grand"><M f="total">{usd(x.total)}</M></span></>}
                </div>
              )}
            </div>
          ) : (
            <div className="panel">
              <h2>Couldn't read this document</h2>
              <p className="muted">Both models failed. Check the file opens correctly, then upload it again. Details are under Model runs.</p>
            </div>
          )}

          <div className="panel">
            <h2>Model runs</h2>
            {doc.attempts.length === 0 ? (
              <p className="small muted">
                This sample was loaded from its answer key, so no model was called and nothing was spent.
                {process.env.GEMINI_API_KEY ? " Use Run live on the inbox to process it for real." : ""}
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Model</th><th className="r">Tokens in / out</th><th className="r">Cost</th><th className="r">Time</th><th className="r">Confidence</th></tr>
                    </thead>
                    <tbody>
                      {doc.attempts.map((a, i) => (
                        <tr key={i}>
                          <td>{a.model}{a.error && <div className="small" style={{ color: "var(--red)" }}>{a.error}</div>}</td>
                          <td className="r num">{num(a.input_tokens)} / {num(a.output_tokens)}</td>
                          <td className="r num">{usdMicro(a.cost_usd)}</td>
                          <td className="r num">{secs(a.latency_ms)}</td>
                          <td className="r num">{pct(a.confidence)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="small muted" style={{ marginTop: 8 }}>
                  {doc.escalated ? "The first model wasn't confident enough, so the document was re-read by the stronger model. " : ""}
                  Total for this document: <span className="num">{usdMicro(spent)}</span>.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
