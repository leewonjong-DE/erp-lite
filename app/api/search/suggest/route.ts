import { NextRequest, NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/search-suggest";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(15, Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? 10)));

  if (q.length < 1) {
    return NextResponse.json({ data: [] });
  }

  const data = await getSearchSuggestions(q, limit);
  return NextResponse.json({ data });
}
