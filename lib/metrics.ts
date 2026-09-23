import type { DocRecord } from "./types";

const pct = (arr: number[], p: number) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

export function computeMetrics(docs: DocRecord[]) {
  const live = docs.filter((d) => d.attempts.length > 0);
  const attempts = live.flatMap((d) => d.attempts);
  const totalCost = attempts.reduce((a, t) => a + t.cost_usd, 0);
  const docLatency = live.map((d) => d.attempts.reduce((a, t) => a + t.latency_ms, 0));

  const byModel = new Map<string, { calls: number; errors: number; input: number; output: number; cost: number; latency: number[] }>();
  for (const a of attempts) {
    const m = byModel.get(a.model) ?? { calls: 0, errors: 0, input: 0, output: 0, cost: 0, latency: [] };
    m.calls++;
    if (a.error) m.errors++;
    m.input += a.input_tokens;
    m.output += a.output_tokens;
    m.cost += a.cost_usd;
    m.latency.push(a.latency_ms);
    byModel.set(a.model, m);
  }

  return {
    live_documents: live.length,
    total_documents: docs.length,
    total_cost_usd: totalCost,
    avg_cost_per_doc_usd: live.length ? totalCost / live.length : null,
    escalation_rate: live.length ? live.filter((d) => d.escalated).length / live.length : null,
    straight_through_rate: live.length ? live.filter((d) => d.status === "ready_for_review" || (d.status === "approved" && !d.checks.some((c) => c.status === "error"))).length / live.length : null,
    failure_rate: live.length ? live.filter((d) => d.status === "failed").length / live.length : null,
    p50_latency_ms: pct(docLatency, 50),
    p95_latency_ms: pct(docLatency, 95),
    by_status: docs.reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.status]: (acc[d.status] ?? 0) + 1 }), {}),
    by_model: [...byModel.entries()].map(([model, m]) => ({
      model,
      calls: m.calls,
      errors: m.errors,
      input_tokens: m.input,
      output_tokens: m.output,
      cost_usd: m.cost,
      p50_latency_ms: pct(m.latency, 50),
    })),
  };
}
export type Metrics = ReturnType<typeof computeMetrics>;
