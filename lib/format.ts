export const usd = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

/** For tiny per-call API costs, e.g. $0.00042 */
export const usdMicro = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : n < 0.01 ? `$${n.toFixed(5)}` : usd(n, 4);

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${Math.round(n * 100)}%`);
export const secs = (ms: number | null | undefined) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)} s`);
export const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toLocaleString("en-US"));

export const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Invoice",
  change_order: "Change order",
  submittal: "Submittal",
  other: "Other",
};

export const STATUS_LABEL: Record<string, string> = {
  ready_for_review: "Ready for review",
  needs_attention: "Needs attention",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Couldn't read",
};

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
