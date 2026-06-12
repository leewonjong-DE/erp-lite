import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/get-dashboard-data";

export async function GET() {
  const data = await getDashboardData();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}
