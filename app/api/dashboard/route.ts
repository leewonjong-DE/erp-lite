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
      by: ["channelCode"],
      _sum: { totalAmountKrw: true },
      orderBy: { _sum: { totalAmountKrw: "desc" } },
    }),
    prisma.$queryRaw<Array<{ category: string; revenue: bigint }>>`
      SELECT c.name AS category, SUM(i.amount_krw)::bigint AS revenue
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN product_categories c ON c.code = p.category_code
      GROUP BY c.name
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
      include: productInclude,
    }),
    prisma.salesOrder.groupBy({
      by: ["statusCode"],
      _count: { _all: true },
    }),
  ]);

  const channels = await prisma.salesChannel.findMany();
  const channelName = new Map(channels.map((c) => [c.code, c.name]));
  const statuses = await prisma.orderStatus.findMany();
  const statusName = new Map(statuses.map((s) => [s.code, s.name]));

  return NextResponse.json({
    kpis: {
      customerCount,
      productCount,
      orderCount,
      lowStockCount,
      totalRevenue: Number(revenueAgg._sum.totalAmountKrw ?? 0),
    },
    channelRevenue: channelRevenue.map((row) => ({
      channel: channelName.get(row.channelCode) ?? row.channelCode,
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
    lowStockProducts: lowStockProducts.map(serializeProduct),
    statusCounts: statusCounts.map((row) => ({
      status: statusName.get(row.statusCode) ?? row.statusCode,
      count: row._count._all,
    })),
  });
}
