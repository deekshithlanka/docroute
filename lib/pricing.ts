/**
 * USD per 1M tokens, paid tier, standard processing.
 * Verify against https://ai.google.dev/gemini-api/docs/pricing before quoting numbers.
 * Thinking tokens bill at the output rate.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9.0 },
};

export function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  if (!p) return 0;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}
