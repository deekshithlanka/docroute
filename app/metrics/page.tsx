import Link from "next/link";
import { getStore } from "@/lib/store";
import { computeMetrics } from "@/lib/metrics";
import { PRICING } from "@/lib/pricing";
import { PRIMARY_MODEL, FALLBACK_MODEL } from "@/lib/pipeline";
import { num, pct, secs, shortDate, usd, usdMicro } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const store = getStore();
  const [docs, postings] = await Promise.all([store.listDocs(), store.listErpPostings(20)]);
  const m = computeMetrics(docs);

  return (
    <>
      <h1>Cost and quality</h1>
      <p className="muted" style={{ maxWidth: "68ch", marginTop: 6 }}>
        Every document is read by {PRIMARY_MODEL()} first. It only goes to {FALLBACK_MODEL()} when the first read comes back
        unsure or incomplete. These numbers cover live runs only; pre-loaded samples cost nothing and aren't counted.
      </p>

      {m.live_documents === 0 ? (
        <p className="panel" style={{ marginTop: 20 }}>
          No live runs yet. <Link href="/">Upload a PDF or run a sample live</Link> and the numbers will show up here.
        </p>
      ) : (
        <dl className="stats">
          <div className="stat"><dt>Documents read</dt><dd>{num(m.live_documents)}</dd></div>
          <div className="stat"><dt>Total spend</dt><dd>{usdMicro(m.total_cost_usd)}</dd></div>
          <div className="stat"><dt>Per document</dt><dd>{usdMicro(m.avg_cost_per_doc_usd)}</dd></div>
          <div className="stat"><dt>Sent to stronger model</dt><dd>{pct(m.escalation_rate)}</dd></div>
          <div className="stat"><dt>Passed every check</dt><dd>{pct(m.straight_through_rate)}</dd></div>
          <div className="stat"><dt>Typical time (p50 / p95)</dt><dd>{secs(m.p50_latency_ms)} / {secs(m.p95_latency_ms)}</dd></div>
        </dl>
      )}

      {m.by_model.length > 0 && (
        <section className="section">
          <h2>By model</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Model</th><th className="r">Calls</th><th className="r">Errors</th><th className="r">Tokens in</th><th className="r">Tokens out</th><th className="r">Cost</th><th className="r">p50 time</th><th className="r">Price per 1M in / out</th></tr>
              </thead>
              <tbody>
                {m.by_model.map((r) => (
                  <tr key={r.model}>
                    <td>{r.model}</td>
                    <td className="r num">{num(r.calls)}</td>
                    <td className="r num">{num(r.errors)}</td>
                    <td className="r num">{num(r.input_tokens)}</td>
                    <td className="r num">{num(r.output_tokens)}</td>
                    <td className="r num">{usdMicro(r.cost_usd)}</td>
                    <td className="r num">{secs(r.p50_latency_ms)}</td>
                    <td className="r num">{PRICING[r.model] ? `${usd(PRICING[r.model].input)} / ${usd(PRICING[r.model].output)}` : "not set"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section">
        <h2>Posted to ERP</h2>
        <p className="small muted">What the ERP received when documents were approved. This demo posts to a mock endpoint that checks a shared secret and ignores repeats of the same document.</p>
        <div className="table-wrap">
          {postings.length === 0 ? (
            <p className="empty muted">Nothing posted yet. Approve a document to see its ERP payload here.</p>
          ) : (
            <table>
              <thead><tr><th>ERP id</th><th>Received</th><th>Payload</th></tr></thead>
              <tbody>
                {postings.map((p) => {
                  const pl = p.payload as { vendor_name?: string; vendor_document_number?: string; total?: number };
                  return (
                    <tr key={p.erp_id}>
                      <td className="num">{p.erp_id}</td>
                      <td className="small muted">{shortDate(p.received_at)}</td>
                      <td>
                        <details>
                          <summary>{pl.vendor_name} {pl.vendor_document_number}{pl.total != null ? `, ${usd(pl.total)}` : ""}</summary>
                          <pre className="payload">{JSON.stringify(p.payload, null, 2)}</pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="section">
        <h2>Accuracy</h2>
        <p className="small muted">
          Field-level accuracy is measured offline against the hand-checked answer keys with <code>npm run eval</code>, which
          runs both models on every sample and reports accuracy next to cost. See the README for the latest results.
        </p>
      </section>
    </>
  );
}
