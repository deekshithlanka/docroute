export type DocumentType = "invoice" | "change_order" | "submittal" | "other";

export interface LineItem {
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number | null;
}

/** What the model returns. Mirrors EXTRACTION_SCHEMA in lib/schema.ts. */
export interface Extraction {
  document_type: DocumentType;
  vendor_name: string | null;
  document_number: string | null;
  document_date: string | null; // YYYY-MM-DD
  due_date: string | null; // YYYY-MM-DD
  job_number: string | null;
  job_name: string | null;
  po_number: string | null;
  spec_section: string | null; // submittals
  summary: string;
  line_items: LineItem[];
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  confidence: number; // 0..1, model self-assessed
  notes: string | null;
}

export type CheckStatus = "pass" | "warning" | "error";

export interface ValidationCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  field?: keyof Extraction;
}

export interface ModelAttempt {
  model: string;
  input_tokens: number;
  output_tokens: number; // includes thinking tokens, which bill as output
  cost_usd: number;
  latency_ms: number;
  confidence: number | null;
  error: string | null;
}

export interface Routing {
  approver_role: string;
  reason: string;
}

export type DocStatus =
  | "ready_for_review"
  | "needs_attention"
  | "approved"
  | "rejected"
  | "failed";

export interface IntegrationEvent {
  at: string;
  target: "erp" | "notify" | "n8n";
  ok: boolean;
  attempts: number;
  detail: string;
}

export interface DocRecord {
  id: string;
  created_at: string;
  filename: string;
  source: "sample" | "upload";
  sample_id: string | null;
  status: DocStatus;
  extraction: Extraction | null;
  checks: ValidationCheck[];
  attempts: ModelAttempt[];
  escalated: boolean;
  routing: Routing | null;
  decision_note: string | null;
  decided_at: string | null;
  integrations: IntegrationEvent[];
  erp_id: string | null;
}

export interface ErpPosting {
  erp_id: string;
  received_at: string;
  payload: unknown;
}
