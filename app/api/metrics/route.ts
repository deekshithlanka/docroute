import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { computeMetrics } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(computeMetrics(await getStore().listDocs()));
}
