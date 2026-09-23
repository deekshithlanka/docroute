import type { DocRecord, IntegrationEvent } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST JSON with retries on network errors and 5xx/429. */
async function postWithRetry(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  maxAttempts = 3,
): Promise<{ ok: boolean; attempts: number; status?: number; text: string }> {
  let last = { ok: false, attempts: 0, status: undefined as number | undefined, text: "" };
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await res.text();
      last = { ok: res.ok, attempts: i, status: res.status, text };
      if (res.ok || (res.status < 500 && res.status !== 429)) return last;
    } catch (e) {
      last = { ok: false, attempts: i, status: undefined, text: e instanceof Error ? e.message : String(e) };
    }
    if (i < maxAttempts) await sleep(400 * 2 ** (i - 1));
  }
  return last;
}

/** The payload an ERP's AP-import endpoint would receive. */
export function erpPayload(doc: DocRecord) {
  const x = doc.extraction!;
  return {
    source_system: "docroute",
    document_id: doc.id,
    document_type: x.document_type,
    vendor_name: x.vendor_name,
    vendor_document_number: x.document_number,
    document_date: x.document_date,
    due_date: x.due_date,
    job_number: x.job_number,
    po_number: x.po_number,
    lines: x.line_items.map((li, i) => ({ line: i + 1, ...li })),
    subtotal: x.subtotal,
    tax: x.tax,
    total: x.total,
    approved_by_role: doc.routing?.approver_role,
    approved_at: doc.decided_at,
  };
}

function chatMessage(doc: DocRecord, url: string) {
  const x = doc.extraction!;
  const amount = x.total !== null ? ` for $${x.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "";
  const line = `Approved: ${x.vendor_name} ${x.document_number}${amount}, job ${x.job_number}. Posted to ERP as ${doc.erp_id ?? "n/a"}.`;
  // Discord expects {content}; Slack expects {text}
  return url.includes("discord.com") ? { content: line } : { text: line };
}

export async function runApprovalIntegrations(doc: DocRecord, origin: string): Promise<DocRecord> {
  const events: IntegrationEvent[] = [];
  const now = () => new Date().toISOString();

  // 1. ERP
  const erpUrl = process.env.ERP_WEBHOOK_URL || `${origin}/api/mock-erp`;
  const erp = await postWithRetry(erpUrl, erpPayload(doc), {
    "X-Webhook-Secret": process.env.ERP_WEBHOOK_SECRET || "change-me",
    "Idempotency-Key": doc.id,
  });
  let erpId: string | null = null;
  if (erp.ok) {
    try {
      erpId = (JSON.parse(erp.text) as { erp_id?: string }).erp_id ?? null;
    } catch {
      /* ERP returned non-JSON; keep null */
    }
  }
  events.push({
    at: now(),
    target: "erp",
    ok: erp.ok,
    attempts: erp.attempts,
    detail: erp.ok ? `Posted as ${erpId ?? "(no id returned)"}` : `Failed (${erp.status ?? "network"}): ${erp.text.slice(0, 160)}`,
  });
  const updated: DocRecord = { ...doc, erp_id: erpId };

  // 2. Chat notification
  const notifyUrl = process.env.NOTIFY_WEBHOOK_URL;
  if (notifyUrl) {
    const r = await postWithRetry(notifyUrl, chatMessage(updated, notifyUrl));
    events.push({ at: now(), target: "notify", ok: r.ok, attempts: r.attempts, detail: r.ok ? "Message sent" : `Failed (${r.status ?? "network"})` });
  }

  // 3. n8n
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (n8nUrl) {
    const r = await postWithRetry(n8nUrl, { event: "document.approved", document: erpPayload(updated), erp_id: erpId });
    events.push({ at: now(), target: "n8n", ok: r.ok, attempts: r.attempts, detail: r.ok ? "Workflow triggered" : `Failed (${r.status ?? "network"})` });
  }

  return { ...updated, integrations: [...doc.integrations, ...events] };
}
