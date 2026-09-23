import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const docs = await getStore().listDocs();
  const filtered = status ? docs.filter((d) => d.status === status) : docs;
  return NextResponse.json(
    filtered.map((d) => ({
      id: d.id,
      created_at: d.created_at,
      filename: d.filename,
      status: d.status,
      document_type: d.extraction?.document_type ?? null,
      vendor_name: d.extraction?.vendor_name ?? null,
      document_number: d.extraction?.document_number ?? null,
      job_number: d.extraction?.job_number ?? null,
      total: d.extraction?.total ?? null,
      approver_role: d.routing?.approver_role ?? null,
    })),
  );
}
