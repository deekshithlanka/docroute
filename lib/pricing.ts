/**
 * USD per 1M tokens, paid tier, standard processing.
 * Source: https://ai.google.dev/gemini-api/docs/pricing.md.txt, checked 2026-09-23.
 * Thinking tokens bill at the output rate.
 * gemini-3.6-flash rises to $1.50 in / $7.50 out on 2027-01-01 — update this then.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
