import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { fetchDashboardRow } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

const getCachedDashboard = unstable_cache(
  async () => {
    const [row, channels, statuses, payments] = await Promise.all([
      fetchDashboardRow(),
      prisma.salesChannel.findMany(),
      prisma.orderStatus.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.paymentMethod.findMany(),
    ]);

    const channelName = new Map(channels.map((c) => [c.code, c.name]));
    const statusName = new Map(statuses.map((s) => [s.code, s.name]));
    const paymentName = new Map(payments.map((p) => [p.code, p.name]));

    const thisMonth = Number(row.this_month);
    const prevMonth = Number(row.prev_month);
    const monthChangePct =
      prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 1000) / 10 : null;

    const marginRevenue = Number(row.margin_revenue);
    const marginCost = Number(row.margin_cost);
    const grossMarginPct =
      marginRevenue > 0 ? Math.round(((marginRevenue - marginCost) / marginRevenue) * 1000) / 10 : 0;
    const completedOrders = Number(row.completed_orders);
    const avgOrderValue = completedOrders > 0 ? Math.round(marginRevenue / completedOrders) : 0;
    const cancelReturnRate =
      row.order_count > 0
        ? Math.round((Number(row.cancel_return_count) / row.order_count) * 1000) / 10
        : 0;

    const stockAlerts = row.stock_alerts ?? [];
    const vipInactive = row.vip_inactive ?? [];
    const staleOrders = row.stale_orders ?? [];

    const alerts: Array<{ level: "warning" | "info"; title: string; message: string }> = [];
    if (Number(row.pending_count) > 0) {
      alerts.push({
        level: "info",
        title: "처리 대기 주문",
        message: `${row.pending_count}건 · ${formatAmount(Number(row.pending_amount))} — 출고·배송 처리 필요`,
      });
    }
    if (staleOrders.length > 0) {
      alerts.push({
        level: "warning",
        title: "장기 미처리 주문",
        message: `7일 이상 '주문접수' ${staleOrders.length}건 — 영업팀 확인 필요`,
      });
    }
    if (stockAlerts.length > 0) {
      alerts.push({
        level: "warning",
        title: "재고 긴급",
        message: `${stockAlerts.length}개 SKU — 30일 내 품절 예상 또는 재고 50 미만`,
      });
    }
    if (vipInactive.length > 0) {
      alerts.push({
        level: "info",
        title: "VIP 이탈 위험",
        message: `180일+ 미주문 VIP ${vipInactive.length}명 — 관리 필요`,
      });
    }

    return {
      kpis: {
        referenceMonth: row.reference_month,
        monthRevenue: thisMonth,
        monthChangePct,
        totalRevenue: Number(row.total_revenue),
        pendingOrderCount: Number(row.pending_count),
        pendingOrderAmount: Number(row.pending_amount),
        avgOrderValue,
        grossMarginPct,
        cancelReturnRate,
        activeCustomers90d: Number(row.active_customers),
        customerCount: row.customer_count,
        productCount: row.product_count,
        orderCount: row.order_count,
        lowStockCount: row.low_stock_count,
        completedOrders,
      },
      alerts,
      statusCounts: (row.status_counts ?? []).map((item) => ({
        status: statusName.get(item.status) ?? item.status,
        count: item.count,
        amount: item.amount,
      })),
      channelRevenue: (row.channel_revenue ?? []).map((item) => ({
        channel: channelName.get(item.channel) ?? item.channel,
        revenue: item.revenue,
      })),
      categoryMargin: row.category_margin ?? [],
      monthlyRevenue: row.monthly_revenue ?? [],
      paymentMix: (row.payment_mix ?? []).map((item) => ({
        method: paymentName.get(item.method) ?? item.method,
        revenue: item.revenue,
        count: item.count,
      })),
      tierRevenue: row.tier_revenue ?? [],
      topCustomers: row.top_customers ?? [],
      topProducts: row.top_products ?? [],
      stockAlerts,
      vipInactive,
      staleOrders,
    };
  },
  ["dashboard-v2"],
  { revalidate: 60 },
);

export async function GET() {
  const data = await getCachedDashboard();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
    },
  });
}

function formatAmount(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}
