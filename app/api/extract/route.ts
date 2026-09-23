import { NextResponse } from "next/server";
import { getStore, newId } from "@/lib/store";
import { runPipeline } from "@/lib/pipeline";
import { getSample } from "@/lib/samples";
import { checkLiveQuota, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request body cap is ~4.5 MB

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Live extraction is off: GEMINI_API_KEY isn't set on this deployment." }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Send the PDF as multipart form data in a field named file." }, { status: 400 });

  const store = getStore();
  const sampleId = form.get("sampleId");
  const file = form.get("file");

  let bytes: ArrayBuffer;
  let filename: string;
  let id: string;
  let source: "sample" | "upload";

  if (typeof sampleId === "string" && sampleId) {
    const sample = getSample(sampleId);
    if (!sample) return NextResponse.json({ error: `No sample called ${sampleId}.` }, { status: 404 });
    // Public files aren't bundled into serverless functions, so fetch the static asset.
    const res = await fetch(new URL(`/samples/${sample.filename}`, req.url));
    if (!res.ok) return NextResponse.json({ error: "Couldn't load the sample PDF." }, { status: 500 });
    bytes = await res.arrayBuffer();
    filename = sample.filename;
    id = sample.id; // re-running a sample replaces its seeded result
    source = "sample";
  } else if (file instanceof File) {
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "That PDF is over 4 MB. Split it or compress it and try again." }, { status: 413 });
    bytes = await file.arrayBuffer();
    const head = new TextDecoder().decode(bytes.slice(0, 5));
    if (head !== "%PDF-") return NextResponse.json({ error: "That file isn't a PDF." }, { status: 415 });
    filename = file.name || "upload.pdf";
    id = newId();
    source = "upload";
  } else {
    return NextResponse.json({ error: "Attach a PDF or choose a sample." }, { status: 400 });
  }

  const quota = await checkLiveQuota(store, clientIp(req.headers));
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `This demo allows ${quota.limit} live extractions per visitor per day. The sample results are still available to browse.` },
      { status: 429 },
    );
  }

  const pdfBase64 = Buffer.from(bytes).toString("base64");
  const doc = await runPipeline({ id, filename, source, sampleId: source === "sample" ? id : null, pdfBase64, store });
  await store.saveDoc(doc, source === "upload" ? pdfBase64 : undefined);

  return NextResponse.json(doc, { status: doc.status === "failed" ? 502 : 200 });
}
