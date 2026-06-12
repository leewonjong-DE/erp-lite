import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productInclude, serializeProduct } from "@/lib/serialize";

export async function GET() {
  const [
    customerCount,
    productCount,
    orderCount,
    lowStockCount,
    revenueAgg,
    channelRevenue,
    categoryRevenue,
    categoryMargin,
    monthlyRevenue,
    lowStockProducts,
    statusCounts,
    paymentMix,
    tierRevenue,
    topCustomers,
    topProducts,
    stockAlerts,
    vipInactive,
    staleOrders,
    monthStats,
    operationalStats,
    marginStats,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.salesOrder.count(),
    prisma.product.count({ where: { stockQty: { lt: 50 } } }),
    prisma.salesOrder.aggregate({
      where: { statusCode: { notIn: ["취소", "반품"] } },
      _sum: { totalAmountKrw: true },
    }),
    prisma.salesOrder.groupBy({
      by: ["channelCode"],
      where: { statusCode: "배송완료" },
      _sum: { totalAmountKrw: true },
      orderBy: { _sum: { totalAmountKrw: "desc" } },
    }),
    prisma.$queryRaw<Array<{ category: string; revenue: bigint }>>`
      SELECT c.name AS category, SUM(i.amount_krw)::bigint AS revenue
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN product_categories c ON c.code = p.category_code
      JOIN sales_orders o ON o.order_no = i.order_no
      WHERE o.status_code = '배송완료'
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 8
    `,
    prisma.$queryRaw<Array<{ category: string; revenue: bigint; cost: bigint }>>`
      SELECT c.name AS category,
             SUM(i.amount_krw)::bigint AS revenue,
             SUM(i.qty * p.unit_cost_krw)::bigint AS cost
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN product_categories c ON c.code = p.category_code
      JOIN sales_orders o ON o.order_no = i.order_no
      WHERE o.status_code = '배송완료'
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 8
    `,
    prisma.$queryRaw<Array<{ month: string; revenue: bigint; orders: bigint }>>`
      SELECT TO_CHAR(order_date, 'YYYY-MM') AS month,
             SUM(total_amount_krw)::bigint AS revenue,
             COUNT(*)::bigint AS orders
      FROM sales_orders
      WHERE status_code NOT IN ('취소', '반품')
      GROUP BY month
      ORDER BY month
    `,
    prisma.product.findMany({
      where: { stockQty: { lt: 50 } },
      orderBy: { stockQty: "asc" },
      take: 10,
      include: productInclude,
    }),
    prisma.salesOrder.groupBy({
      by: ["statusCode"],
      _count: { _all: true },
      _sum: { totalAmountKrw: true },
    }),
    prisma.salesOrder.groupBy({
      by: ["paymentMethodCode"],
      where: { statusCode: "배송완료" },
      _sum: { totalAmountKrw: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<Array<{ tier: string; revenue: bigint; customers: bigint }>>`
      SELECT t.name AS tier,
             SUM(o.total_amount_krw)::bigint AS revenue,
             COUNT(DISTINCT c.customer_id)::bigint AS customers
      FROM sales_orders o
      JOIN customers c ON c.customer_id = o.customer_id
      JOIN customer_tiers t ON t.code = c.tier_code
      WHERE o.status_code = '배송완료'
      GROUP BY t.name, t.sort_order
      ORDER BY t.sort_order
    `,
    prisma.$queryRaw<
      Array<{ customer_id: number; customer_name: string; tier: string; revenue: bigint; orders: bigint }>
    >`
      SELECT c.customer_id, c.customer_name, t.name AS tier,
             SUM(o.total_amount_krw)::bigint AS revenue,
             COUNT(*)::bigint AS orders
      FROM sales_orders o
      JOIN customers c ON c.customer_id = o.customer_id
      JOIN customer_tiers t ON t.code = c.tier_code
      WHERE o.status_code = '배송완료'
      GROUP BY c.customer_id, c.customer_name, t.name
      ORDER BY revenue DESC
      LIMIT 10
    `,
    prisma.$queryRaw<
      Array<{ product_id: number; product_name: string; category: string; qty: bigint; revenue: bigint }>
    >`
      SELECT p.product_id, p.product_name, c.name AS category,
             SUM(i.qty)::bigint AS qty,
             SUM(i.amount_krw)::bigint AS revenue
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN product_categories c ON c.code = p.category_code
      JOIN sales_orders o ON o.order_no = i.order_no
      WHERE o.status_code = '배송완료'
      GROUP BY p.product_id, p.product_name, c.name
      ORDER BY revenue DESC
      LIMIT 10
    `,
    prisma.$queryRaw<
      Array<{
        product_id: number;
        product_name: string;
        category: string;
        stock_qty: number;
        sold_90d: bigint;
        days_to_stockout: number | null;
      }>
    >`
      WITH ref AS (SELECT MAX(order_date) AS d FROM sales_orders),
      velocity AS (
        SELECT i.product_id, SUM(i.qty)::bigint AS sold_90d
        FROM sales_order_items i
        JOIN sales_orders o ON o.order_no = i.order_no
        CROSS JOIN ref
        WHERE o.order_date >= ref.d - INTERVAL '90 days'
          AND o.status_code NOT IN ('취소', '반품')
        GROUP BY i.product_id
      )
      SELECT p.product_id, p.product_name, c.name AS category, p.stock_qty,
             COALESCE(v.sold_90d, 0) AS sold_90d,
             CASE WHEN COALESCE(v.sold_90d, 0) > 0
                  THEN ROUND(p.stock_qty / (v.sold_90d::numeric / 90))::int
                  ELSE NULL END AS days_to_stockout
      FROM products p
      JOIN product_categories c ON c.code = p.category_code
      LEFT JOIN velocity v ON v.product_id = p.product_id
      WHERE p.stock_qty < 50 OR (v.sold_90d > 0 AND p.stock_qty / (v.sold_90d::numeric / 90) < 30)
      ORDER BY days_to_stockout NULLS LAST, p.stock_qty
      LIMIT 10
    `,
    prisma.$queryRaw<
      Array<{ customer_id: number; customer_name: string; last_order: Date | null; days_since: number }>
    >`
      WITH ref AS (SELECT MAX(order_date) AS d FROM sales_orders)
      SELECT c.customer_id, c.customer_name, MAX(o.order_date) AS last_order,
             CASE WHEN MAX(o.order_date) IS NULL THEN 9999
                  ELSE (ref.d - MAX(o.order_date))::int END AS days_since
      FROM customers c
      CROSS JOIN ref
      LEFT JOIN sales_orders o ON o.customer_id = c.customer_id
        AND o.status_code NOT IN ('취소', '반품')
      WHERE c.tier_code = 'VIP'
      GROUP BY c.customer_id, c.customer_name, ref.d
      HAVING MAX(o.order_date) IS NULL OR MAX(o.order_date) < ref.d - INTERVAL '180 days'
      ORDER BY days_since DESC
      LIMIT 8
    `,
    prisma.$queryRaw<
      Array<{ order_no: number; customer_name: string; order_date: Date; days_pending: number; amount: bigint }>
    >`
      WITH ref AS (SELECT MAX(order_date) AS d FROM sales_orders)
      SELECT o.order_no, c.customer_name, o.order_date,
             (ref.d - o.order_date)::int AS days_pending,
             o.total_amount_krw::bigint AS amount
      FROM sales_orders o
      JOIN customers c ON c.customer_id = o.customer_id
      CROSS JOIN ref
      WHERE o.status_code = '주문접수'
        AND o.order_date < ref.d - INTERVAL '7 days'
      ORDER BY o.order_date
      LIMIT 8
    `,
    prisma.$queryRaw<Array<{ this_month: bigint; prev_month: bigint; reference_month: string }>>`
      WITH ref AS (SELECT MAX(order_date) AS d FROM sales_orders),
      bounds AS (
        SELECT DATE_TRUNC('month', d) AS this_m,
               DATE_TRUNC('month', d) - INTERVAL '1 month' AS prev_m,
               TO_CHAR(DATE_TRUNC('month', d), 'YYYY-MM') AS reference_month
        FROM ref
      )
      SELECT
        COALESCE((SELECT SUM(total_amount_krw) FROM sales_orders o, bounds b
          WHERE DATE_TRUNC('month', o.order_date) = b.this_m
            AND o.status_code NOT IN ('취소', '반품')), 0)::bigint AS this_month,
        COALESCE((SELECT SUM(total_amount_krw) FROM sales_orders o, bounds b
          WHERE DATE_TRUNC('month', o.order_date) = b.prev_m
            AND o.status_code NOT IN ('취소', '반품')), 0)::bigint AS prev_month,
        (SELECT reference_month FROM bounds) AS reference_month
    `,
    prisma.$queryRaw<
      Array<{ pending_count: bigint; pending_amount: bigint; active_customers: bigint; cancel_return_count: bigint }>
    >`
      WITH ref AS (SELECT MAX(order_date) AS d FROM sales_orders)
      SELECT
        (SELECT COUNT(*) FROM sales_orders
         WHERE status_code IN ('주문접수', '결제완료', '배송중'))::bigint AS pending_count,
        (SELECT COALESCE(SUM(total_amount_krw), 0) FROM sales_orders
         WHERE status_code IN ('주문접수', '결제완료', '배송중'))::bigint AS pending_amount,
        (SELECT COUNT(DISTINCT customer_id) FROM sales_orders o, ref
         WHERE o.order_date >= ref.d - INTERVAL '90 days'
           AND o.status_code NOT IN ('취소', '반품'))::bigint AS active_customers,
        (SELECT COUNT(*) FROM sales_orders
         WHERE status_code IN ('취소', '반품'))::bigint AS cancel_return_count
    `,
    prisma.$queryRaw<Array<{ revenue: bigint; cost: bigint; completed_orders: bigint }>>`
      SELECT
        COALESCE(SUM(i.amount_krw), 0)::bigint AS revenue,
        COALESCE(SUM(i.qty * p.unit_cost_krw), 0)::bigint AS cost,
        COUNT(DISTINCT o.order_no)::bigint AS completed_orders
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN sales_orders o ON o.order_no = i.order_no
      WHERE o.status_code = '배송완료'
    `,
  ]);

  const channels = await prisma.salesChannel.findMany();
  const channelName = new Map(channels.map((c) => [c.code, c.name]));
  const statuses = await prisma.orderStatus.findMany({ orderBy: { sortOrder: "asc" } });
  const statusName = new Map(statuses.map((s) => [s.code, s.name]));
  const payments = await prisma.paymentMethod.findMany();
  const paymentName = new Map(payments.map((p) => [p.code, p.name]));

  const month = monthStats[0] ?? {
    this_month: BigInt(0),
    prev_month: BigInt(0),
    reference_month: "",
  };
  const thisMonth = Number(month.this_month);
  const prevMonth = Number(month.prev_month);
  const monthChangePct =
    prevMonth > 0 ? Math.round(((thisMonth - prevMonth) / prevMonth) * 1000) / 10 : null;

  const ops = operationalStats[0] ?? {
    pending_count: BigInt(0),
    pending_amount: BigInt(0),
    active_customers: BigInt(0),
    cancel_return_count: BigInt(0),
  };
  const margin = marginStats[0] ?? {
    revenue: BigInt(0),
    cost: BigInt(0),
    completed_orders: BigInt(0),
  };
  const marginRevenue = Number(margin.revenue);
  const marginCost = Number(margin.cost);
  const grossMarginPct =
    marginRevenue > 0 ? Math.round(((marginRevenue - marginCost) / marginRevenue) * 1000) / 10 : 0;
  const completedOrders = Number(margin.completed_orders);
  const avgOrderValue = completedOrders > 0 ? Math.round(marginRevenue / completedOrders) : 0;
  const cancelReturnRate =
    orderCount > 0 ? Math.round((Number(ops.cancel_return_count) / orderCount) * 1000) / 10 : 0;

  const alerts: Array<{ level: "warning" | "info"; title: string; message: string }> = [];
  if (Number(ops.pending_count) > 0) {
    alerts.push({
      level: "info",
      title: "처리 대기 주문",
      message: `${ops.pending_count}건 · ${formatAmount(Number(ops.pending_amount))} — 출고·배송 처리 필요`,
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

  return NextResponse.json({
    kpis: {
      referenceMonth: month.reference_month,
      monthRevenue: thisMonth,
      monthChangePct,
      totalRevenue: Number(revenueAgg._sum.totalAmountKrw ?? 0),
      pendingOrderCount: Number(ops.pending_count),
      pendingOrderAmount: Number(ops.pending_amount),
      avgOrderValue,
      grossMarginPct,
      cancelReturnRate,
      activeCustomers90d: Number(ops.active_customers),
      customerCount,
      productCount,
      orderCount,
      lowStockCount,
      completedOrders,
    },
    alerts,
    statusCounts: statusCounts
      .map((row) => ({
        status: statusName.get(row.statusCode) ?? row.statusCode,
        count: row._count._all,
        amount: Number(row._sum.totalAmountKrw ?? 0),
        sortOrder: statuses.find((s) => s.code === row.statusCode)?.sortOrder ?? 99,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    channelRevenue: channelRevenue.map((row) => ({
      channel: channelName.get(row.channelCode) ?? row.channelCode,
      revenue: Number(row._sum.totalAmountKrw ?? 0),
    })),
    categoryRevenue: categoryRevenue.map((row) => ({
      category: row.category,
      revenue: Number(row.revenue),
    })),
    categoryMargin: categoryMargin.map((row) => {
      const rev = Number(row.revenue);
      const cost = Number(row.cost);
      return {
        category: row.category,
        revenue: rev,
        marginPct: rev > 0 ? Math.round(((rev - cost) / rev) * 1000) / 10 : 0,
      };
    }),
    monthlyRevenue: monthlyRevenue.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
    })),
    paymentMix: paymentMix.map((row) => ({
      method: paymentName.get(row.paymentMethodCode) ?? row.paymentMethodCode,
      revenue: Number(row._sum.totalAmountKrw ?? 0),
      count: row._count._all,
    })),
    tierRevenue: tierRevenue.map((row) => ({
      tier: row.tier,
      revenue: Number(row.revenue),
      customers: Number(row.customers),
    })),
    topCustomers: topCustomers.map((row) => ({
      customerId: row.customer_id,
      name: row.customer_name,
      tier: row.tier,
      revenue: Number(row.revenue),
      orders: Number(row.orders),
    })),
    topProducts: topProducts.map((row) => ({
      productId: row.product_id,
      name: row.product_name,
      category: row.category,
      qty: Number(row.qty),
      revenue: Number(row.revenue),
    })),
    stockAlerts: stockAlerts.map((row) => ({
      productId: row.product_id,
      name: row.product_name,
      category: row.category,
      stockQty: row.stock_qty,
      sold90d: Number(row.sold_90d),
      daysToStockout: row.days_to_stockout,
    })),
    vipInactive: vipInactive.map((row) => ({
      customerId: row.customer_id,
      name: row.customer_name,
      lastOrder: row.last_order,
      daysSince: row.days_since,
    })),
    staleOrders: staleOrders.map((row) => ({
      orderNo: row.order_no,
      customerName: row.customer_name,
      orderDate: row.order_date,
      daysPending: row.days_pending,
      amount: Number(row.amount),
    })),
    lowStockProducts: lowStockProducts.map(serializeProduct),
  });
}

function formatAmount(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}
