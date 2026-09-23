import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

/**
 * Stand-in for an ERP's AP-import API. Behaves like a real one in the ways
 * that matter to an integration: it authenticates, validates, and is idempotent
 * on the Idempotency-Key header so a retried webhook doesn't double-post.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.ERP_WEBHOOK_SECRET || "change-me";
  if (req.headers.get("x-webhook-secret") !== secret) {
    return NextResponse.json({ error: "Bad or missing X-Webhook-Secret" }, { status: 401 });
  }
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload || !payload.vendor_name || !payload.job_number) {
    return NextResponse.json({ error: "vendor_name and job_number are required" }, { status: 422 });
  }

  const store = getStore();
  const key = req.headers.get("idempotency-key");
  if (key) {
    const prior = (await store.listErpPostings(200)).find((p) => (p.payload as { document_id?: string }).document_id === key);
    if (prior) return NextResponse.json({ erp_id: prior.erp_id, duplicate: true });
  }

  const n = await store.bump("erp-seq");
  const erp_id = `AP-${String(10000 + n)}`;
  await store.addErpPosting({ erp_id, received_at: new Date().toISOString(), payload });
  return NextResponse.json({ erp_id }, { status: 201 });
}

export async function GET() {
  return NextResponse.json(await getStore().listErpPostings(50));
}
