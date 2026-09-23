import { EXTRACTION_PROMPT } from "./prompt";
import { EXTRACTION_SCHEMA } from "./schema";
import { costUsd } from "./pricing";
import type { Extraction, ModelAttempt } from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export class GeminiError extends Error {
  constructor(message: string, public status?: number, public retryable = false) {
    super(message);
  }
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Calls Gemini's REST API directly (no SDK) with the PDF inline and a
 * response schema, retrying on 429/5xx with exponential backoff.
 */
export async function extractWithGemini(
  model: string,
  pdfBase64: string,
  opts: { apiKey?: string; maxRetries?: number; timeoutMs?: number } = {},
): Promise<{ extraction: Extraction | null; attempt: ModelAttempt }> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiError("GEMINI_API_KEY is not set");
  const maxRetries = opts.maxRetries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 45_000;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
          { text: EXTRACTION_PROMPT },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_SCHEMA,
      maxOutputTokens: 4096,
    },
  };

  const started = Date.now();
  let lastError: GeminiError | null = null;

  for (let i = 0; i <= maxRetries; i++) {
    if (i > 0) await sleep(500 * 2 ** (i - 1) + Math.random() * 250);
    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        const text = await res.text();
        const retryable = res.status === 429 || res.status >= 500;
        lastError = new GeminiError(`Gemini ${res.status}: ${text.slice(0, 300)}`, res.status, retryable);
        if (retryable) continue;
        throw lastError;
      }

      const data = (await res.json()) as GeminiResponse;
      const usage = data.usageMetadata ?? {};
      const inputTokens = usage.promptTokenCount ?? 0;
      const outputTokens = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
      const attempt: ModelAttempt = {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd(model, inputTokens, outputTokens),
        latency_ms: Date.now() - started,
        confidence: null,
        error: null,
      };

      if (data.promptFeedback?.blockReason) {
        attempt.error = `Blocked: ${data.promptFeedback.blockReason}`;
        return { extraction: null, attempt };
      }

      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      try {
        const extraction = normalize(JSON.parse(text));
        attempt.confidence = extraction.confidence;
        return { extraction, attempt };
      } catch {
        attempt.error = `Unparseable model output (finish: ${data.candidates?.[0]?.finishReason ?? "unknown"})`;
        return { extraction: null, attempt };
      }
    } catch (err) {
      if (err instanceof GeminiError && !err.retryable) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof GeminiError ? err : new GeminiError(msg, undefined, true);
    }
  }

  return {
    extraction: null,
    attempt: {
      model,
      input_tokens: 0,
      output_tokens: 0,
      cost_usd: 0,
      latency_ms: Date.now() - started,
      confidence: null,
      error: lastError?.message ?? "Unknown error",
    },
  };
}

/** Defensive cleanup: models occasionally return "$1,200.00" or "" despite the schema. */
export function normalize(raw: Record<string, unknown>): Extraction {
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    const n = Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const toStr = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  };
  const items = Array.isArray(raw.line_items) ? raw.line_items : [];
  const conf = toNum(raw.confidence);
  const type = String(raw.document_type ?? "other");

  return {
    document_type: (["invoice", "change_order", "submittal", "other"].includes(type) ? type : "other") as Extraction["document_type"],
    vendor_name: toStr(raw.vendor_name),
    document_number: toStr(raw.document_number),
    document_date: toStr(raw.document_date),
    due_date: toStr(raw.due_date),
    job_number: toStr(raw.job_number),
    job_name: toStr(raw.job_name),
    po_number: toStr(raw.po_number),
    spec_section: toStr(raw.spec_section),
    summary: toStr(raw.summary) ?? "",
    line_items: items.map((li: Record<string, unknown>) => ({
      description: toStr(li.description) ?? "",
      quantity: toNum(li.quantity),
      unit: toStr(li.unit),
      unit_price: toNum(li.unit_price),
      amount: toNum(li.amount),
    })),
    subtotal: toNum(raw.subtotal),
    tax: toNum(raw.tax),
    total: toNum(raw.total),
    confidence: conf === null ? 0 : Math.min(1, Math.max(0, conf)),
    notes: toStr(raw.notes),
  };
}
