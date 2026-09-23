import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { runApprovalIntegrations } from "@/lib/integrations";
import type { DocRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { decision?: string; note?: string };
  const note = body.note?.trim() || null;
  if (body.decision !== "approve" && body.decision !== "reject") {
    return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 });
  }

  const store = getStore();
  const doc = await store.getDoc(id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status !== "ready_for_review" && doc.status !== "needs_attention") {
    return NextResponse.json({ error: `This document is already ${doc.status.replace(/_/g, " ")}.` }, { status: 409 });
  }
  if (!doc.extraction) return NextResponse.json({ error: "Nothing was extracted, so there's nothing to approve." }, { status: 409 });
  if (body.decision === "approve" && doc.status === "needs_attention" && !note) {
    return NextResponse.json({ error: "This document failed a check. Add a note explaining why it's OK to approve." }, { status: 422 });
  }
  if (body.decision === "reject" && !note) {
    return NextResponse.json({ error: "Add a note so the vendor or PM knows why it was rejected." }, { status: 422 });
  }

  let updated: DocRecord = {
    ...doc,
    status: body.decision === "approve" ? "approved" : "rejected",
    decision_note: note,
    decided_at: new Date().toISOString(),
  };
  if (body.decision === "approve") {
    updated = await runApprovalIntegrations(updated, new URL(req.url).origin);
  }
  await store.saveDoc(updated);
  return NextResponse.json(updated);
}
