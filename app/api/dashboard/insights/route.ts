import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { generateInsights } from "@/lib/ai-insights";
import { getDashboardData } from "@/lib/get-dashboard-data";

const getCachedInsights = unstable_cache(
  async () => {
    const data = await getDashboardData();
    return generateInsights(data);
  },
  ["dashboard-insights-v5"],
  { revalidate: 300 },
);

export async function GET() {
  try {
    const insights = await getCachedInsights();
    return NextResponse.json(insights, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    console.error("Insights API error:", err);
    return NextResponse.json(
      { error: "AI 인사이트를 생성하지 못했습니다." },
      { status: 500 },
    );
  }
}
