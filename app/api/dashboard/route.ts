import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    customerCount,
    productCount,
    orderCount,
    lowStockCount,
    revenueAgg,
    channelRevenue,
    categoryRevenue,
    monthlyRevenue,
    lowStockProducts,
    statusCounts,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.salesOrder.count(),
    prisma.product.count({ where: { stockQty: { lt: 50 } } }),
    prisma.salesOrder.aggregate({ _sum: { totalAmountKrw: true } }),
    prisma.salesOrder.groupBy({
      by: ["channel"],
      _sum: { totalAmountKrw: true },
      orderBy: { _sum: { totalAmountKrw: "desc" } },
    }),
    prisma.$queryRaw<Array<{ category: string; revenue: bigint }>>`
      SELECT p.category, SUM(i.amount_krw)::bigint AS revenue
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      GROUP BY p.category
      ORDER BY revenue DESC
      LIMIT 8
    `,
    prisma.$queryRaw<Array<{ month: string; revenue: bigint }>>`
      SELECT TO_CHAR(order_date, 'YYYY-MM') AS month, SUM(total_amount_krw)::bigint AS revenue
      FROM sales_orders
      GROUP BY month
      ORDER BY month
    `,
    prisma.product.findMany({
      where: { stockQty: { lt: 50 } },
      orderBy: { stockQty: "asc" },
      take: 10,
    }),
    prisma.salesOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  return NextResponse.json({
    kpis: {
      customerCount,
      productCount,
      orderCount,
      lowStockCount,
      totalRevenue: Number(revenueAgg._sum.totalAmountKrw ?? 0),
    },
    channelRevenue: channelRevenue.map((row) => ({
      channel: row.channel,
      revenue: Number(row._sum.totalAmountKrw ?? 0),
    })),
    categoryRevenue: categoryRevenue.map((row) => ({
      category: row.category,
      revenue: Number(row.revenue),
    })),
    monthlyRevenue: monthlyRevenue.map((row) => ({
      month: row.month,
      revenue: Number(row.revenue),
    })),
    lowStockProducts,
    statusCounts: statusCounts.map((row) => ({
      status: row.status,
      count: row._count._all,
    })),
  });
}
