import { extractWithGemini } from "./gemini";
import { validate, hasErrors } from "./validate";
import { routeFor } from "./routing";
import type { DocRecord, Extraction, ModelAttempt, ValidationCheck } from "./types";
import type { Store } from "./store";

export const PRIMARY_MODEL = () => process.env.GEMINI_PRIMARY_MODEL || "gemini-3-flash-preview";
export const FALLBACK_MODEL = () => process.env.GEMINI_FALLBACK_MODEL || "gemini-3.6-flash";
const ESCALATE_BELOW = () => Number(process.env.ESCALATION_CONFIDENCE ?? 0.8);

/**
 * Cheap model first. Escalate to the stronger model only when the cheap one
 * failed, reported low confidence, or produced data that fails validation.
 * Arithmetic errors printed on the document itself also fail validation, so
 * we only escalate on *extraction-shaped* failures (missing fields, low confidence),
 * not on math checks — re-reading a wrong invoice doesn't make it right.
 */
const ESCALATION_CHECKS = new Set(["required", "confidence"]);

export async function runPipeline(args: {
  id: string;
  filename: string;
  source: DocRecord["source"];
  sampleId: string | null;
  pdfBase64: string;
  store: Store;
}): Promise<DocRecord> {
  const { id, filename, source, sampleId, pdfBase64, store } = args;
  const existing = (await store.listDocs()).map((d) => ({
    id: d.id,
    vendor_name: d.extraction?.vendor_name ?? null,
    document_number: d.extraction?.document_number ?? null,
  }));

  const attempts: ModelAttempt[] = [];
  let extraction: Extraction | null = null;
  let checks: ValidationCheck[] = [];
  let escalated = false;

  const first = await extractWithGemini(PRIMARY_MODEL(), pdfBase64);
  attempts.push(first.attempt);
  extraction = first.extraction;
  if (extraction) checks = validate(extraction, { existing, selfId: id });

  const needsEscalation =
    !extraction ||
    extraction.confidence < ESCALATE_BELOW() ||
    checks.some((c) => ESCALATION_CHECKS.has(c.id) && c.status === "error");

  const fallback = FALLBACK_MODEL();
  if (needsEscalation && fallback && fallback !== PRIMARY_MODEL()) {
    const second = await extractWithGemini(fallback, pdfBase64);
    attempts.push(second.attempt);
    if (second.extraction) {
      escalated = true;
      extraction = second.extraction;
      checks = validate(extraction, { existing, selfId: id });
    }
  }

  return {
    id,
    created_at: new Date().toISOString(),
    filename,
    source,
    sample_id: sampleId,
    status: !extraction ? "failed" : hasErrors(checks) ? "needs_attention" : "ready_for_review",
    extraction,
    checks,
    attempts,
    escalated,
    routing: extraction ? routeFor(extraction) : null,
    decision_note: null,
    decided_at: null,
    integrations: [],
    erp_id: null,
  };
}
