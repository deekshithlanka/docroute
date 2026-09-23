/**
 * Field-level accuracy vs. cost, per model, on the hand-checked samples.
 *
 *   GEMINI_API_KEY=... npm run eval
 *   GEMINI_API_KEY=... npm run eval -- --models gemini-3-flash-preview,gemini-3.6-flash --runs 3
 *
 * Writes eval-results.json. Paste the printed table into the README.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLES } from "../lib/samples";
import { extractWithGemini } from "../lib/gemini";
import type { Extraction } from "../lib/types";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const MODELS = arg("models", "gemini-3-flash-preview,gemini-3.6-flash").split(",");
const RUNS = Number(arg("runs", "1"));

const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9.]/g, "");
const sameNum = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 0.005);

/** Fields scored one point each. Line items score as one field: count and every amount must match. */
const FIELDS: { name: string; score: (got: Extraction, want: Extraction) => boolean }[] = [
  { name: "document_type", score: (g, w) => g.document_type === w.document_type },
  { name: "vendor_name", score: (g, w) => norm(g.vendor_name) === norm(w.vendor_name) },
  { name: "document_number", score: (g, w) => norm(g.document_number) === norm(w.document_number) },
  { name: "document_date", score: (g, w) => g.document_date === w.document_date },
  { name: "due_date", score: (g, w) => g.due_date === w.due_date },
  { name: "job_number", score: (g, w) => norm(g.job_number) === norm(w.job_number) },
  { name: "po_number", score: (g, w) => norm(g.po_number) === norm(w.po_number) },
  { name: "spec_section", score: (g, w) => norm(g.spec_section) === norm(w.spec_section) },
  {
    name: "line_items",
    score: (g, w) =>
      g.line_items.length === w.line_items.length &&
      w.line_items.every((wl, i) => sameNum(g.line_items[i].quantity, wl.quantity) && sameNum(g.line_items[i].amount, wl.amount)),
  },
  { name: "subtotal", score: (g, w) => sameNum(g.subtotal, w.subtotal) },
  { name: "tax", score: (g, w) => sameNum(g.tax, w.tax) },
  { name: "total", score: (g, w) => sameNum(g.total, w.total) },
];

async function main() {
  if (!process.env.GEMINI_API_KEY) throw new Error("Set GEMINI_API_KEY");
  const results: Record<string, unknown>[] = [];

  for (const model of MODELS) {
    let correct = 0, possible = 0, docsPerfect = 0, docs = 0, cost = 0, errors = 0;
    const latencies: number[] = [];
    const misses: string[] = [];

    for (let run = 0; run < RUNS; run++) {
      for (const s of SAMPLES) {
        const pdf = readFileSync(join(process.cwd(), "public", "samples", s.filename)).toString("base64");
        const { extraction, attempt } = await extractWithGemini(model, pdf);
        docs++;
        cost += attempt.cost_usd;
        latencies.push(attempt.latency_ms);
        if (!extraction) {
          errors++;
          possible += FIELDS.length;
          misses.push(`${s.id}: ${attempt.error}`);
          continue;
        }
        let perfect = true;
        for (const f of FIELDS) {
          possible++;
          if (f.score(extraction, s.golden)) correct++;
          else {
            perfect = false;
            misses.push(`${s.id}.${f.name}`);
          }
        }
        if (perfect) docsPerfect++;
        process.stdout.write(".");
      }
    }
    latencies.sort((a, b) => a - b);
    results.push({
      model,
      documents: docs,
      field_accuracy: correct / possible,
      documents_fully_correct: docsPerfect / docs,
      errors,
      total_cost_usd: cost,
      cost_per_document_usd: cost / docs,
      p50_latency_ms: latencies[Math.floor(latencies.length / 2)],
      misses,
    });
  }

  console.log("\n\n| Model | Field accuracy | Docs fully correct | Cost / doc | p50 latency |");
  console.log("|---|---|---|---|---|");
  for (const r of results as { model: string; field_accuracy: number; documents_fully_correct: number; cost_per_document_usd: number; p50_latency_ms: number }[]) {
    console.log(`| ${r.model} | ${(r.field_accuracy * 100).toFixed(1)}% | ${(r.documents_fully_correct * 100).toFixed(0)}% | $${r.cost_per_document_usd.toFixed(5)} | ${(r.p50_latency_ms / 1000).toFixed(1)} s |`);
  }
  for (const r of results as { model: string; misses: string[] }[]) {
    if (r.misses.length) console.log(`\n${r.model} misses: ${r.misses.join(", ")}`);
  }
  writeFileSync("eval-results.json", JSON.stringify({ ran_at: new Date().toISOString(), runs: RUNS, results }, null, 2));
  console.log("\nSaved eval-results.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
