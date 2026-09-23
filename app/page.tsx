import Link from "next/link";
import { getStore } from "@/lib/store";
import { SAMPLES } from "@/lib/samples";
import { Intake } from "@/components/Intake";
import { DOC_TYPE_LABEL, STATUS_LABEL, shortDate, usd } from "@/lib/format";

export const dynamic = "force-dynamic";

const ORDER = ["needs_attention", "ready_for_review", "failed", "approved", "rejected"];

export default async function Inbox() {
  const docs = await getStore().listDocs();
  docs.sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || b.created_at.localeCompare(a.created_at));
  const open = docs.filter((d) => d.status === "needs_attention" || d.status === "ready_for_review").length;

  return (
    <div className="inbox">
      <Intake
        live={Boolean(process.env.GEMINI_API_KEY)}
        samples={SAMPLES.map(({ id, title, what_it_shows }) => ({ id, title, what_it_shows }))}
      />

      <section className="queue">
        <h2>Approval queue <span className="muted small">{open} waiting</span></h2>
        <div className="table-wrap">
          {docs.length === 0 ? (
            <p className="empty muted">Nothing in the queue. Upload a PDF to start.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Vendor and document</th>
                  <th>Job</th>
                  <th className="r">Amount</th>
                  <th>Goes to</th>
                  <th>Status</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const x = d.extraction;
                  return (
                    <tr key={d.id} className="link-row">
                      <td>
                        <Link className="row-link" href={`/documents/${d.id}`}>
                          {x?.vendor_name ?? d.filename}
                        </Link>
                        <div className="small muted">
                          {x ? `${DOC_TYPE_LABEL[x.document_type]} ${x.document_number ?? ""}` : "Not extracted"}
                        </div>
                      </td>
                      <td className="num">{x?.job_number ?? "—"}</td>
                      <td className="r num">{x?.total != null ? usd(x.total) : "—"}</td>
                      <td>{d.routing?.approver_role ?? "—"}</td>
                      <td><span className="status" data-s={d.status}>{STATUS_LABEL[d.status]}</span></td>
                      <td className="small muted nowrap">{shortDate(d.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
