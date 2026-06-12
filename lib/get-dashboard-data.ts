import { unstable_cache } from "next/cache";
import { fetchDashboardRow } from "@/lib/dashboard";
import { buildDashboardForecasts, type DashboardForecasts } from "@/lib/forecast";
import { prisma } from "@/lib/prisma";

export type DashboardAlertId =
  | "order_pipeline"
  | "low_stock"
  | "vip_inactive"
  | "new_customer";

export type DashboardData = {
  kpis: {
    referenceMonth: string;
    monthRevenue: number;
    monthChangePct: number | null;
    totalRevenue: number;
    pendingOrderCount: number;
    pendingOrderAmount: number;
    avgOrderValue: number;
    grossMarginPct: number;
    cancelReturnRate: number;
    activeCustomers90d: number;
    customerCount: number;
    productCount: number;
    orderCount: number;
    lowStockCount: number;
    completedOrders: number;
  };
  alerts: Array<{
    id: DashboardAlertId;
    level: "warning" | "info";
    title: string;
    message: string;
  }>;
  statusCounts: Array<{ status: string; count: number; amount: number }>;
  channelRevenue: Array<{ channel: string; revenue: number }>;
  categoryMargin: Array<{ category: string; revenue: number; marginPct: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  monthlyCustomerJoins: Array<{ month: string; joins: number }>;
  forecasts: DashboardForecasts;
  paymentMix: Array<{ method: string; revenue: number; count: number }>;
  tierRevenue: Array<{ tier: string; revenue: number; customers: number }>;
  topCustomers: Array<{
    customerId: number;
    name: string;
    tier: string;
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{
    productId: number;
    name: string;
    category: string;
    qty: number;
    revenue: number;
  }>;
  stockAlerts: Array<{
    productId: number;
    name: string;
    category: string;
    stockQty: number;
    sold90d: number;
    daysToStockout: number | null;
  }>;
  vipInactive: Array<{ customerId: number; name: string; daysSince: number }>;
  staleOrders: Array<{
    orderNo: number;
    customerId: number;
    customerName: string;
    orderDate: string;
    daysPending: number;
    amount: number;
  }>;
  orderPipeline: {
    stats: Array<{
      status: string;
      total: number;
      amount: number;
      overdue: number;
      critical: number;
    }>;
    overdueOrders: Array<{
      orderNo: number;
      customerId: number;
      customerName: string;
      orderDate: string;
      status: string;
      amount: number;
      daysSinceOrder: number;
      overdueDays: number;
      severity: "overdue" | "critical";
    }>;
  };
  newCustomerMonitoring: {
    total90d: number;
    noOrder: number;
    oneOrderRisk: number;
    firstBuy: number;
    repeat: number;
    repeatRate: number;
    watchlist: Array<{
      customerId: number;
      name: string;
      tier: string;
      joinDate: string;
      daysSinceJoin: number;
      orderCount: number;
      status: string;
      idleDays: number | null;
      lastOrderDate: string | null;
    }>;
  };
};

function formatAmount(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}

async function buildDashboardData(): Promise<DashboardData> {
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

  const pipelineStats = (row.order_pipeline_stats ?? []).map((s) => ({
    status: s.status,
    total: s.total,
    amount: Number(s.amount),
    overdue: s.overdue,
    critical: s.critical,
  }));

  const pipelineOverdue = (row.order_pipeline_overdue ?? []).map((o) => ({
    orderNo: o.orderNo,
    customerId: o.customerId,
    customerName: o.customerName,
    orderDate: o.orderDate,
    status: o.status,
    amount: Number(o.amount),
    daysSinceOrder: o.daysSinceOrder,
    overdueDays: o.overdueDays,
    severity: o.severity as "overdue" | "critical",
  }));

  const staleOrders = pipelineOverdue
    .filter((o) => o.status === "주문접수" && o.severity === "critical")
    .map((o) => ({
      orderNo: o.orderNo,
      customerId: o.customerId,
      customerName: o.customerName,
      orderDate: o.orderDate,
      daysPending: o.daysSinceOrder,
      amount: o.amount,
    }));

  const totalOverdue = pipelineStats.reduce((s, p) => s + p.overdue, 0);

  const alerts: DashboardData["alerts"] = [];
  if (totalOverdue > 0) {
    const parts = pipelineStats
      .filter((p) => p.overdue > 0)
      .map((p) => `${p.status} ${p.overdue}건`);
    alerts.push({
      id: "order_pipeline",
      level: pipelineStats.some((p) => p.critical > 0) ? "warning" : "info",
      title: "처리 지연 주문",
      message: `${parts.join(" · ")} — 상태별 기준 초과`,
    });
  }
  if (stockAlerts.length > 0) {
    alerts.push({
      id: "low_stock",
      level: "warning",
      title: "재고 긴급",
      message: `${stockAlerts.length}개 SKU — 30일 내 품절 예상 또는 재고 50 미만`,
    });
  }
  if (vipInactive.length > 0) {
    alerts.push({
      id: "vip_inactive",
      level: "info",
      title: "VIP 이탈 위험",
      message: `180일+ 미주문 VIP ${vipInactive.length}명 — 관리 필요`,
    });
  }

  const newTotal = row.new_customers_90d ?? 0;
  const newNoOrder = row.new_no_order ?? 0;
  const newOneOrderRisk = row.new_one_order_risk ?? 0;
  const newRepeat = row.new_repeat ?? 0;
  const newFirstBuy = row.new_first_buy ?? 0;
  const newOrdered = newTotal - newNoOrder;
  const newRepeatRate =
    newOrdered > 0 ? Math.round((newRepeat / newOrdered) * 1000) / 10 : 0;
  const newWatchlist = row.new_customer_watchlist ?? [];

  if (newWatchlist.length > 0) {
    alerts.push({
      id: "new_customer",
      level: "warning",
      title: "신규 고객 관리 필요",
      message: `미주문·재구매 대기 ${newWatchlist.length}명 — 온보딩·이탈 방지 연락 필요`,
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
    monthlyCustomerJoins: row.monthly_customer_joins ?? [],
    forecasts: buildDashboardForecasts({
      monthlyRevenue: row.monthly_revenue ?? [],
      monthlyCustomerJoins: row.monthly_customer_joins ?? [],
      referenceMonth: row.reference_month,
      currentMonthRevenue: thisMonth,
      customerCount: row.customer_count,
    }),
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
    orderPipeline: { stats: pipelineStats, overdueOrders: pipelineOverdue },
    newCustomerMonitoring: {
      total90d: newTotal,
      noOrder: newNoOrder,
      oneOrderRisk: newOneOrderRisk,
      firstBuy: newFirstBuy,
      repeat: newRepeat,
      repeatRate: newRepeatRate,
      watchlist: newWatchlist,
    },
  };
}

export const getDashboardData = unstable_cache(
  buildDashboardData,
  ["dashboard-v8"],
  { revalidate: 60 },
);
