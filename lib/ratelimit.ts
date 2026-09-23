import type { Store } from "./store";

/** Per-IP daily cap on live Gemini calls, so a public demo can't drain the API budget. */
export async function checkLiveQuota(store: Store, ip: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const limit = Number(process.env.LIVE_EXTRACTIONS_PER_DAY ?? 5);
  const day = new Date().toISOString().slice(0, 10);
  const used = await store.bump(`live:${day}:${ip}`);
  return { allowed: used <= limit, used, limit };
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() || headers.get("x-real-ip") || "local";
}
