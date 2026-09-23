/**
 * Gemini structured-output schema (OpenAPI subset). Gemini is constrained to
 * return JSON matching this, so we never parse free text.
 */
const num = { type: "NUMBER", nullable: true };
const str = { type: "STRING", nullable: true };

export const EXTRACTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    document_type: {
      type: "STRING",
      enum: ["invoice", "change_order", "submittal", "other"],
    },
    vendor_name: str,
    document_number: { ...str, description: "Invoice #, change order #, or submittal #" },
    document_date: { ...str, description: "YYYY-MM-DD" },
    due_date: { ...str, description: "YYYY-MM-DD; null if not stated" },
    job_number: { ...str, description: "Contractor job/project number, e.g. 24-1187" },
    job_name: str,
    po_number: str,
    spec_section: { ...str, description: "CSI spec section for submittals, e.g. 26 51 00" },
    summary: { type: "STRING", description: "One sentence describing the document" },
    line_items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          quantity: num,
          unit: str,
          unit_price: num,
          amount: num,
        },
        required: ["description"],
        propertyOrdering: ["description", "quantity", "unit", "unit_price", "amount"],
      },
    },
    subtotal: num,
    tax: num,
    total: num,
    confidence: {
      type: "NUMBER",
      description: "0 to 1. Your confidence that every extracted field is correct.",
    },
    notes: { ...str, description: "Anything unclear, illegible, or suspicious" },
  },
  required: ["document_type", "summary", "line_items", "confidence"],
  propertyOrdering: [
    "document_type", "vendor_name", "document_number", "document_date", "due_date",
    "job_number", "job_name", "po_number", "spec_section", "summary",
    "line_items", "subtotal", "tax", "total", "confidence", "notes",
  ],
} as const;
