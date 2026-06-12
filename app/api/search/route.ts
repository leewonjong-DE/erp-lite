import { NextRequest, NextResponse } from "next/server";
import { runAiSearch } from "@/lib/ai-search";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";
    const customerId =
      typeof body.customerId === "number"
        ? body.customerId
        : typeof body.customerId === "string" && body.customerId
          ? Number(body.customerId)
          : undefined;

    if (!query && !customerId) {
      return NextResponse.json({ error: "검색어를 입력해 주세요." }, { status: 400 });
    }

    const result = await runAiSearch(query, {
      customerId: Number.isFinite(customerId) ? customerId : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
