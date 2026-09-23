import type { Extraction, Routing } from "./types";

/**
 * Approval matrix. Mirrors a typical contractor delegation-of-authority policy;
 * edit the thresholds to match the real one.
 */
export const THRESHOLDS = { pm: 5_000, ops: 25_000 };

export function routeFor(x: Extraction): Routing {
  if (x.document_type === "submittal") {
    return { approver_role: "Project Engineer", reason: `Submittal for spec section ${x.spec_section ?? "unknown"}` };
  }
  if (x.document_type === "other") {
    return { approver_role: "AP Clerk", reason: "Unrecognized document type — manual triage" };
  }
  const total = x.total ?? 0;
  const kind = x.document_type === "change_order" ? "Change order" : "Invoice";
  if (total < THRESHOLDS.pm) return { approver_role: "Project Manager", reason: `${kind} under $5,000` };
  if (total < THRESHOLDS.ops) return { approver_role: "Operations Manager", reason: `${kind} $5,000–$25,000` };
  return { approver_role: "CFO", reason: `${kind} over $25,000` };
}
