import { findJob } from "./jobs";
import type { Extraction, ValidationCheck } from "./types";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Allow a cent of rounding per line, or 0.5% on large sums. */
const close = (a: number, b: number, lines = 1) =>
  Math.abs(a - b) <= Math.max(0.01 * lines, Math.abs(b) * 0.005);

export interface ValidationContext {
  /** Other documents already in the system, for duplicate detection. */
  existing: { id: string; vendor_name: string | null; document_number: string | null }[];
  selfId?: string;
}

export function validate(x: Extraction, ctx: ValidationContext): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const financial = x.document_type === "invoice" || x.document_type === "change_order";

  // 1. Required fields
  const required: (keyof Extraction)[] =
    x.document_type === "submittal"
      ? ["vendor_name", "document_number", "job_number", "spec_section"]
      : ["vendor_name", "document_number", "document_date", "job_number", "total"];
  const missing = required.filter((f) => x[f] === null || x[f] === "");
  checks.push({
    id: "required",
    label: "Required fields present",
    status: missing.length ? "error" : "pass",
    detail: missing.length ? `Missing: ${missing.join(", ")}` : `All ${required.length} required fields found`,
  });

  // 2. Job exists and is open
  const job = findJob(x.job_number);
  if (!x.job_number) {
    checks.push({ id: "job", label: "Job number matches ERP", status: "error", detail: "No job number on document", field: "job_number" });
  } else if (!job) {
    checks.push({ id: "job", label: "Job number matches ERP", status: "error", detail: `Job ${x.job_number} not found in ERP`, field: "job_number" });
  } else if (job.status === "closed") {
    checks.push({ id: "job", label: "Job number matches ERP", status: "error", detail: `Job ${job.job_number} (${job.name}) is closed`, field: "job_number" });
  } else {
    checks.push({ id: "job", label: "Job number matches ERP", status: "pass", detail: `${job.job_number}, ${job.name}, PM ${job.project_manager}` });
  }

  if (financial) {
    // 3. Each line: qty × unit price = amount
    const bad = x.line_items.filter(
      (li) => li.quantity !== null && li.unit_price !== null && li.amount !== null &&
        !close(li.quantity * li.unit_price, li.amount),
    );
    checks.push({
      id: "line_math",
      label: "Line items multiply correctly",
      status: bad.length ? "error" : "pass",
      detail: bad.length
        ? bad.map((li) => `"${li.description}": ${li.quantity} × ${money(li.unit_price!)} ≠ ${money(li.amount!)}`).join("; ")
        : `${x.line_items.length} lines checked`,
      field: "line_items",
    });

    // 4. Lines sum to subtotal
    const amounts = x.line_items.map((li) => li.amount).filter((a): a is number => a !== null);
    const sum = amounts.reduce((a, b) => a + b, 0);
    const subtotal = x.subtotal ?? (x.tax === null ? x.total : null);
    if (subtotal === null || amounts.length === 0) {
      checks.push({ id: "subtotal", label: "Lines add up to subtotal", status: "warning", detail: "Not enough data to check", field: "subtotal" });
    } else {
      checks.push({
        id: "subtotal",
        label: "Lines add up to subtotal",
        status: close(sum, subtotal, amounts.length) ? "pass" : "error",
        detail: close(sum, subtotal, amounts.length)
          ? `${money(sum)} matches`
          : `Lines total ${money(sum)}, document says ${money(subtotal)} (off by ${money(subtotal - sum)})`,
        field: "subtotal",
      });
    }

    // 5. Subtotal + tax = total
    if (x.subtotal !== null && x.total !== null) {
      const expected = x.subtotal + (x.tax ?? 0);
      checks.push({
        id: "total",
        label: "Subtotal + tax = total",
        status: close(expected, x.total) ? "pass" : "error",
        detail: close(expected, x.total) ? `${money(x.total)}` : `Expected ${money(expected)}, document says ${money(x.total)}`,
        field: "total",
      });
    }
  }

  // 6. Duplicate
  if (x.vendor_name && x.document_number) {
    const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const dup = ctx.existing.find(
      (d) => d.id !== ctx.selfId && norm(d.vendor_name) === norm(x.vendor_name) && norm(d.document_number) === norm(x.document_number),
    );
    checks.push({
      id: "duplicate",
      label: "Not a duplicate",
      status: dup ? "error" : "pass",
      detail: dup ? `Same vendor and number as document ${dup.id}` : "No earlier match",
      field: "document_number",
    });
  }

  // 7. Dates
  if (x.document_date && x.due_date) {
    const ok = x.due_date >= x.document_date;
    checks.push({
      id: "dates",
      label: "Due date after document date",
      status: ok ? "pass" : "warning",
      detail: ok ? `Due ${x.due_date}` : `Due ${x.due_date} is before ${x.document_date}`,
      field: "due_date",
    });
  }

  // 8. Model confidence
  checks.push({
    id: "confidence",
    label: "Model confident in extraction",
    status: x.confidence >= 0.8 ? "pass" : x.confidence >= 0.6 ? "warning" : "error",
    detail: `${Math.round(x.confidence * 100)}%${x.notes ? `. ${x.notes}` : ""}`,
  });

  return checks;
}

export const hasErrors = (checks: ValidationCheck[]) => checks.some((c) => c.status === "error");
