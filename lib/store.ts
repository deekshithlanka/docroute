import type { DocRecord, ErpPosting } from "./types";
import { buildSampleRecords } from "./samples";

/**
 * Two interchangeable backends:
 *  - Postgres (Neon) when DATABASE_URL is set — use this in production.
 *  - In-memory otherwise — fine for local dev, resets on every serverless cold start.
 */
export interface Store {
  listDocs(): Promise<DocRecord[]>;
  getDoc(id: string): Promise<DocRecord | null>;
  saveDoc(doc: DocRecord, pdfBase64?: string): Promise<void>;
  getPdf(id: string): Promise<string | null>;
  addErpPosting(p: ErpPosting): Promise<void>;
  listErpPostings(limit?: number): Promise<ErpPosting[]>;
  /** Atomically increments a counter and returns the new value. */
  bump(key: string): Promise<number>;
  kind: "postgres" | "memory";
}

// ---------------------------------------------------------------- memory ---
interface Mem {
  docs: Map<string, DocRecord>;
  pdfs: Map<string, string>;
  erp: ErpPosting[];
  counters: Map<string, number>;
}
const g = globalThis as unknown as { __docrouteMem?: Mem };

function memoryStore(): Store {
  if (!g.__docrouteMem) {
    g.__docrouteMem = { docs: new Map(), pdfs: new Map(), erp: [], counters: new Map() };
    for (const d of buildSampleRecords()) g.__docrouteMem.docs.set(d.id, d);
  }
  const m = g.__docrouteMem;
  return {
    kind: "memory",
    async listDocs() {
      return [...m.docs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    async getDoc(id) {
      return m.docs.get(id) ?? null;
    },
    async saveDoc(doc, pdf) {
      m.docs.set(doc.id, structuredClone(doc));
      if (pdf) m.pdfs.set(doc.id, pdf);
    },
    async getPdf(id) {
      return m.pdfs.get(id) ?? null;
    },
    async addErpPosting(p) {
      m.erp.unshift(p);
    },
    async listErpPostings(limit = 50) {
      return m.erp.slice(0, limit);
    },
    async bump(key) {
      const n = (m.counters.get(key) ?? 0) + 1;
      m.counters.set(key, n);
      return n;
    },
  };
}

// -------------------------------------------------------------- postgres ---
let schemaReady: Promise<void> | null = null;

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>;

function postgresStore(url: string): Store {
  // Loaded lazily so the in-memory mode (and offline tests) never need the driver.
  let sqlP: Promise<Sql> | null = null;
  const conn = () =>
    (sqlP ??= import("@neondatabase/serverless").then((m) => m.neon(url) as unknown as Sql));
  const sql: Sql = async (strings, ...values) => (await conn())(strings, ...values);

  const ensure = () => {
    schemaReady ??= (async () => {
      await sql`create table if not exists documents (
        id text primary key,
        created_at timestamptz not null default now(),
        data jsonb not null,
        pdf_base64 text
      )`;
      await sql`create table if not exists erp_postings (
        erp_id text primary key,
        received_at timestamptz not null default now(),
        payload jsonb not null
      )`;
      await sql`create table if not exists counters (
        key text primary key,
        value integer not null default 0
      )`;
      for (const d of buildSampleRecords()) {
        await sql`insert into documents (id, created_at, data)
                  values (${d.id}, ${d.created_at}, ${JSON.stringify(d)}::jsonb)
                  on conflict (id) do nothing`;
      }
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
    return schemaReady;
  };

  return {
    kind: "postgres",
    async listDocs() {
      await ensure();
      const rows = await sql`select data from documents order by created_at desc limit 200`;
      return rows.map((r) => r.data as DocRecord);
    },
    async getDoc(id) {
      await ensure();
      const rows = await sql`select data from documents where id = ${id}`;
      return (rows[0]?.data as DocRecord) ?? null;
    },
    async saveDoc(doc, pdf) {
      await ensure();
      const data = JSON.stringify(doc);
      if (pdf) {
        await sql`insert into documents (id, created_at, data, pdf_base64)
                  values (${doc.id}, ${doc.created_at}, ${data}::jsonb, ${pdf})
                  on conflict (id) do update set data = excluded.data, pdf_base64 = excluded.pdf_base64`;
      } else {
        await sql`insert into documents (id, created_at, data)
                  values (${doc.id}, ${doc.created_at}, ${data}::jsonb)
                  on conflict (id) do update set data = excluded.data`;
      }
    },
    async getPdf(id) {
      await ensure();
      const rows = await sql`select pdf_base64 from documents where id = ${id}`;
      return (rows[0]?.pdf_base64 as string | null) ?? null;
    },
    async addErpPosting(p) {
      await ensure();
      await sql`insert into erp_postings (erp_id, received_at, payload)
                values (${p.erp_id}, ${p.received_at}, ${JSON.stringify(p.payload)}::jsonb)
                on conflict (erp_id) do nothing`;
    },
    async listErpPostings(limit = 50) {
      await ensure();
      const rows = await sql`select erp_id, received_at, payload from erp_postings order by received_at desc limit ${limit}`;
      return rows.map((r) => ({
        erp_id: r.erp_id as string,
        received_at: new Date(r.received_at as string).toISOString(),
        payload: r.payload,
      }));
    },
    async bump(key) {
      await ensure();
      const rows = await sql`insert into counters (key, value) values (${key}, 1)
                             on conflict (key) do update set value = counters.value + 1
                             returning value`;
      return Number(rows[0].value);
    },
  };
}

let cached: Store | null = null;
export function getStore(): Store {
  cached ??= process.env.DATABASE_URL ? postgresStore(process.env.DATABASE_URL) : memoryStore();
  return cached;
}

export const newId = () => "d_" + Math.random().toString(36).slice(2, 10);
