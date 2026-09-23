/**
 * Offline tests for the business logic (no API key or database needed).
 * Run: npm test
 */
import assert from "node:assert/strict";
import { buildSampleRecords, SAMPLES } from "../lib/samples";
import { validate } from "../lib/validate";
import { routeFor } from "../lib/routing";
import { costUsd } from "../lib/pricing";
import { normalize } from "../lib/gemini";

let passed = 0;
const test = (name: string, fn: () => void) => {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${(e as Error).message}`);
    process.exitCode = 1;
  }
};
const status = (id: string, checkId: string) =>
  buildSampleRecords().find((r) => r.id === id)!.checks.find((c) => c.id === checkId)?.status;

console.log("validation");
test("clean invoice passes every check", () => {
  const r = buildSampleRecords().find((d) => d.id === "sample-1")!;
  assert.deepEqual(r.checks.filter((c) => c.status !== "pass"), []);
  assert.equal(r.status, "ready_for_review");
});
test("transposed line amount is caught", () => {
  assert.equal(status("sample-2", "line_math"), "error");
  assert.equal(status("sample-2", "subtotal"), "error");
});
test("math-error invoice needs attention", () => {
  assert.equal(buildSampleRecords().find((d) => d.id === "sample-2")!.status, "needs_attention");
});
test("change order totals pass with no tax", () => {
  assert.equal(status("sample-3", "subtotal"), "pass");
  assert.equal(status("sample-3", "total"), "pass");
});
test("submittal skips money checks", () => {
  assert.equal(status("sample-4", "line_math"), undefined);
  assert.equal(status("sample-4", "required"), "pass");
});
test("unknown job number is an error", () => {
  const x = { ...SAMPLES[0].golden, job_number: "99-0001" };
  assert.equal(validate(x, { existing: [] }).find((c) => c.id === "job")!.status, "error");
});
test("closed job is an error", () => {
  const x = { ...SAMPLES[0].golden, job_number: "23-0910" };
  assert.match(validate(x, { existing: [] }).find((c) => c.id === "job")!.detail, /closed/);
});
test("duplicate invoice is caught, ignoring punctuation and case", () => {
  const x = SAMPLES[0].golden;
  const checks = validate(x, { existing: [{ id: "old", vendor_name: "VALLEY ELECTRICAL SUPPLY CO", document_number: "inv58213" }] });
  assert.equal(checks.find((c) => c.id === "duplicate")!.status, "error");
});
test("low confidence is flagged", () => {
  const x = { ...SAMPLES[0].golden, confidence: 0.5 };
  assert.equal(validate(x, { existing: [] }).find((c) => c.id === "confidence")!.status, "error");
});

console.log("routing");
test("$2.6k invoice -> Project Manager", () => assert.equal(routeFor(SAMPLES[1].golden).approver_role, "Project Manager"));
test("$8.5k invoice -> Operations Manager", () => assert.equal(routeFor(SAMPLES[0].golden).approver_role, "Operations Manager"));
test("$31.6k change order -> CFO", () => assert.equal(routeFor(SAMPLES[2].golden).approver_role, "CFO"));
test("submittal -> Project Engineer", () => assert.equal(routeFor(SAMPLES[3].golden).approver_role, "Project Engineer"));

console.log("cost + parsing");
test("flash cost math", () => assert.equal(costUsd("gemini-3-flash-preview", 1_000_000, 1_000_000), 3.5));
test("unknown model costs 0 rather than crashing", () => assert.equal(costUsd("mystery", 1000, 1000), 0));
test("normalize strips $ and commas, clamps confidence", () => {
  const x = normalize({ document_type: "invoice", total: "$8,475.98", confidence: 1.4, line_items: [{ description: "x", amount: "1,158.00" }], summary: "" });
  assert.equal(x.total, 8475.98);
  assert.equal(x.confidence, 1);
  assert.equal(x.line_items[0].amount, 1158);
});
test("normalize maps unknown doc type to other and blanks to null", () => {
  const x = normalize({ document_type: "receipt", vendor_name: "  ", line_items: [], confidence: 0.9, summary: "s" });
  assert.equal(x.document_type, "other");
  assert.equal(x.vendor_name, null);
});

// ----------------------------------------------------------------- pipeline
// Fakes Gemini's REST API so we can exercise escalation without spending credits.
import { runPipeline } from "../lib/pipeline";
import { getStore } from "../lib/store";

function fakeGemini(byModel: Record<string, object | number>) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    const model = String(url).match(/models\/([^:]+):/)![1];
    calls.push(model);
    const r = byModel[model];
    if (typeof r === "number") return new Response("boom", { status: r });
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(r) }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 400, thoughtsTokenCount: 100 },
    }), { status: 200 });
  }) as typeof fetch;
  return calls;
}

(async () => {
  process.env.GEMINI_API_KEY = "test";
  delete process.env.DATABASE_URL;
  const store = getStore();
  const base = { filename: "t.pdf", source: "upload" as const, sampleId: null, pdfBase64: "AAAA", store };
  console.log("pipeline (fake Gemini)");

  let calls = fakeGemini({ "gemini-3-flash-preview": { ...SAMPLES[0].golden, document_number: "NEW-1" } });
  let doc = await runPipeline({ ...base, id: "t1" });
  test("confident primary result is not escalated", () => {
    assert.deepEqual(calls, ["gemini-3-flash-preview"]);
    assert.equal(doc.escalated, false);
    assert.equal(doc.status, "ready_for_review");
    assert.equal(doc.attempts[0].output_tokens, 500);
    assert.ok(Math.abs(doc.attempts[0].cost_usd - (2000 * 0.5 + 500 * 3.0) / 1e6) < 1e-12);
  });

  calls = fakeGemini({
    "gemini-3-flash-preview": { ...SAMPLES[0].golden, document_number: "NEW-2", confidence: 0.4 },
    "gemini-3.6-flash": { ...SAMPLES[0].golden, document_number: "NEW-2", confidence: 0.95 },
  });
  doc = await runPipeline({ ...base, id: "t2" });
  test("low confidence escalates to the fallback model", () => {
    assert.deepEqual(calls, ["gemini-3-flash-preview", "gemini-3.6-flash"]);
    assert.equal(doc.escalated, true);
    assert.equal(doc.extraction!.confidence, 0.95);
  });

  calls = fakeGemini({ "gemini-3-flash-preview": { ...SAMPLES[1].golden, document_number: "NEW-3" } });
  doc = await runPipeline({ ...base, id: "t3" });
  test("math errors on the document do not trigger escalation", () => {
    assert.deepEqual(calls, ["gemini-3-flash-preview"]);
    assert.equal(doc.status, "needs_attention");
  });

  calls = fakeGemini({ "gemini-3-flash-preview": 503, "gemini-3.6-flash": 503 });
  doc = await runPipeline({ ...base, id: "t4" });
  test("5xx is retried, then the fallback is tried, then marked failed", () => {
    assert.equal(calls.length, 6); // 3 tries each
    assert.equal(doc.status, "failed");
    assert.ok(doc.attempts.every((a) => a.error));
  });

  console.log(`\n${passed} passed${process.exitCode ? ", some failed" : ""}`);
})();
