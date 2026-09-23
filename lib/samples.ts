import type { DocRecord, Extraction } from "./types";
import { validate, hasErrors } from "./validate";
import { routeFor } from "./routing";

/**
 * Four invented documents (all companies and people are fictional).
 * `golden` is the hand-checked correct extraction, used to:
 *   1. seed the demo so visitors see results without spending API credits
 *   2. score live model runs in scripts/eval.ts
 * The PDFs in public/samples/ are generated from these same values by
 * scripts/make_samples.py, so the two cannot drift apart.
 */
export interface Sample {
  id: string;
  filename: string;
  title: string;
  what_it_shows: string;
  golden: Extraction;
}

export const SAMPLES: Sample[] = [
  {
    id: "sample-1",
    filename: "valley-electrical-INV-58213.pdf",
    title: "Supplier invoice, clean",
    what_it_shows: "All checks pass; $8.5k routes to the Operations Manager.",
    golden: {
      document_type: "invoice",
      vendor_name: "Valley Electrical Supply Co.",
      document_number: "INV-58213",
      document_date: "2026-08-28",
      due_date: "2026-09-27",
      job_number: "24-1187",
      job_name: "Westpark Medical Office Bldg",
      po_number: "24-1187-014",
      spec_section: null,
      summary: "Material invoice for conduit, wire, boxes, breakers and strut for Westpark Medical Office Building.",
      line_items: [
        { description: '3/4" EMT conduit, 10 ft', quantity: 400, unit: "STK", unit_price: 8.45, amount: 3380.0 },
        { description: "12 AWG THHN copper, 500 ft reel", quantity: 12, unit: "RL", unit_price: 96.5, amount: 1158.0 },
        { description: '4" square box, 2-1/8" deep', quantity: 250, unit: "EA", unit_price: 3.18, amount: 795.0 },
        { description: "20A 1-pole breaker", quantity: 60, unit: "EA", unit_price: 21.75, amount: 1305.0 },
        { description: "Strut channel 1-5/8\", 10 ft", quantity: 40, unit: "EA", unit_price: 28.9, amount: 1156.0 },
      ],
      subtotal: 7794.0,
      tax: 681.98,
      total: 8475.98,
      confidence: 0.95,
      notes: null,
    },
  },
  {
    id: "sample-2",
    filename: "summit-conduit-10447.pdf",
    title: "Supplier invoice, math error",
    what_it_shows: "A transposed line amount (436.20 vs 463.20) is caught before payment.",
    golden: {
      document_type: "invoice",
      vendor_name: "Summit Conduit & Wire",
      document_number: "10447",
      document_date: "2026-09-02",
      due_date: "2026-10-02",
      job_number: "24-1215",
      job_name: "Lakeview Elementary Modernization",
      po_number: "24-1215-006",
      spec_section: null,
      summary: "Material invoice for PVC conduit, elbows, pull string and wire lube for Lakeview Elementary.",
      line_items: [
        { description: '2" PVC Sch 40 conduit, 10 ft', quantity: 120, unit: "STK", unit_price: 14.2, amount: 1704.0 },
        { description: '2" PVC 90 deg elbow', quantity: 48, unit: "EA", unit_price: 9.65, amount: 436.2 },
        { description: "Pull string, 2500 ft", quantity: 4, unit: "EA", unit_price: 42.0, amount: 168.0 },
        { description: "Wire pulling lubricant, 1 qt", quantity: 6, unit: "EA", unit_price: 18.5, amount: 111.0 },
      ],
      subtotal: 2446.2,
      tax: 214.04,
      total: 2660.24,
      confidence: 0.93,
      notes: null,
    },
  },
  {
    id: "sample-3",
    filename: "pacific-lv-COR-007.pdf",
    title: "Subcontractor change order",
    what_it_shows: "Labor, material and markup lines; over $25k so it routes to the CFO.",
    golden: {
      document_type: "change_order",
      vendor_name: "Pacific Fire & Low Voltage Inc.",
      document_number: "COR-007",
      document_date: "2026-09-10",
      due_date: null,
      job_number: "24-1203",
      job_name: "Harbor Point Data Center Ph. 2",
      po_number: null,
      spec_section: null,
      summary: "Change order request for added Cat6A cabling and racks in data hall B.",
      line_items: [
        { description: "Labor: journeyman technician", quantity: 160, unit: "HR", unit_price: 118.0, amount: 18880.0 },
        { description: "Material: Cat6A plenum cable, 1000 ft box", quantity: 18, unit: "BX", unit_price: 412.0, amount: 7416.0 },
        { description: "Material: 2-post equipment rack", quantity: 6, unit: "EA", unit_price: 685.0, amount: 4110.0 },
        { description: "Markup on material, 10%", quantity: 1, unit: "LS", unit_price: 1152.6, amount: 1152.6 },
      ],
      subtotal: 31558.6,
      tax: null,
      total: 31558.6,
      confidence: 0.92,
      notes: null,
    },
  },
  {
    id: "sample-4",
    filename: "brightline-submittal-265100-003.pdf",
    title: "Lighting fixture submittal",
    what_it_shows: "No dollar amounts; routes to the Project Engineer by spec section.",
    golden: {
      document_type: "submittal",
      vendor_name: "Brightline Lighting Distributors",
      document_number: "26 51 00-003",
      document_date: "2026-09-15",
      due_date: null,
      job_number: "25-0042",
      job_name: "Riverbend Water Treatment Upgrade",
      po_number: null,
      spec_section: "26 51 00",
      summary: "Product data submittal for LED high bay, vapor-tight linear and emergency fixtures.",
      line_items: [
        { description: "Type A: LED high bay, 24,000 lm, 4000K (Lumenfield HB-24L-40K)", quantity: 36, unit: "EA", unit_price: null, amount: null },
        { description: "Type B: 4 ft vapor-tight linear LED, 5,000 lm (Lumenfield VT4-50L-40K)", quantity: 58, unit: "EA", unit_price: null, amount: null },
        { description: "Type EM: emergency battery pack, 10 W (Lumenfield EMB-10W)", quantity: 20, unit: "EA", unit_price: null, amount: null },
      ],
      subtotal: null,
      tax: null,
      total: null,
      confidence: 0.94,
      notes: null,
    },
  },
];

export const getSample = (id: string) => SAMPLES.find((s) => s.id === id);

/** Seed records. They carry no model attempts: nothing was spent to produce them. */
export function buildSampleRecords(): DocRecord[] {
  const base = Date.parse("2026-09-15T15:00:00Z");
  const records: DocRecord[] = [];
  SAMPLES.forEach((s, i) => {
    const extraction = s.golden;
    const checks = validate(extraction, {
      existing: records.map((r) => ({ id: r.id, vendor_name: r.extraction?.vendor_name ?? null, document_number: r.extraction?.document_number ?? null })),
      selfId: s.id,
    });
    records.push({
      id: s.id,
      created_at: new Date(base - i * 3_600_000).toISOString(),
      filename: s.filename,
      source: "sample",
      sample_id: s.id,
      status: hasErrors(checks) ? "needs_attention" : "ready_for_review",
      extraction,
      checks,
      attempts: [],
      escalated: false,
      routing: routeFor(extraction),
      decision_note: null,
      decided_at: null,
      integrations: [],
      erp_id: null,
    });
  });
  return records;
}
