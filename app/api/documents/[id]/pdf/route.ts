import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { getSample } from "@/lib/samples";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = getSample(id);
  if (sample) return NextResponse.redirect(new URL(`/samples/${sample.filename}`, req.url));

  const b64 = await getStore().getPdf(id);
  if (!b64) return NextResponse.json({ error: "PDF not stored (in-memory mode loses uploads on restart)." }, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(b64, "base64")), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "private, max-age=3600" },
  });
}
