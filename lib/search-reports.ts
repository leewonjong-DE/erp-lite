import { prisma } from "@/lib/prisma";
import { calcMarginPct } from "@/lib/format";
import type { ParsedSearchFilters } from "@/lib/ai-search";

export type CustomerReport = {
  customerId: number;
  customerName: string;
  tier: string;
  customerType: string;
  city: string;
  joinDate: string;
  tenureLabel: string;
  tenureDays: number;
  orderCount: number;
  completedOrderCount: number;
  totalRevenue: number;
  completedRevenue: number;
  avgOrderValue: number;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  topChannel: string | null;
  highlights: string[];
};

export type ProductReport = {
  productId: number;
  productName: string;
  brand: string;
  category: string;
  status: string;
  stockQty: number;
  unitPriceKrw: number;
  marginPct: number;
  soldQty: number;
  soldRevenue: number;
  orderLineCount: number;
  highlights: string[];
};

export type OrderReportSummary = {
  orderCount: number;
  totalAmount: number;
  avgAmount: number;
  statusBreakdown: Array<{ status: string; count: number; amount: number }>;
  highlights: string[];
};

export type HomonymInfo = {
  name: string;
  totalCount: number;
  shownCount: number;
  candidates: Array<{ customerId: number; city: string; tier: string; joinDate: string }>;
};

export type SearchReports = {
  overview: string;
  customers: CustomerReport[];
  products: ProductReport[];
  orders: OrderReportSummary | null;
};

function formatKrwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}

function formatTenure(joinDate: Date): { days: number; label: string } {
  const days = Math.max(
    0,
    Math.floor((Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years > 0) return { days, label: `${years}년 ${months}개월` };
  if (months > 0) return { days, label: `${months}개월` };
  return { days, label: `${days}일` };
}

function daysBetween(from: Date, to = new Date()): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

async function buildCustomerReport(customerId: number): Promise<CustomerReport | null> {
  const customer = await prisma.customer.findUnique({
    where: { customerId },
    include: { city: true, tier: true, customerType: true },
  });
  if (!customer) return null;

  const [allAgg, completedAgg, channelGroups] = await Promise.all([
    prisma.salesOrder.aggregate({
      where: { customerId },
      _count: true,
      _sum: { totalAmountKrw: true },
      _avg: { totalAmountKrw: true },
      _min: { orderDate: true },
      _max: { orderDate: true },
    }),
    prisma.salesOrder.aggregate({
      where: { customerId, statusCode: "배송완료" },
      _count: true,
      _sum: { totalAmountKrw: true },
    }),
    prisma.salesOrder.groupBy({
      by: ["channelCode"],
      where: { customerId, statusCode: "배송완료" },
      _sum: { totalAmountKrw: true },
      orderBy: { _sum: { totalAmountKrw: "desc" } },
      take: 1,
    }),
  ]);

  const tenure = formatTenure(customer.joinDate);
  const orderCount = allAgg._count;
  const completedOrderCount = completedAgg._count;
  const totalRevenue = allAgg._sum.totalAmountKrw ?? 0;
  const completedRevenue = completedAgg._sum.totalAmountKrw ?? 0;
  const avgOrderValue = Math.round(allAgg._avg.totalAmountKrw ?? 0);
  const lastOrderDate = allAgg._max.orderDate;
  const daysSinceLastOrder = lastOrderDate ? daysBetween(lastOrderDate) : null;

  let topChannel: string | null = null;
  if (channelGroups[0]) {
    const ch = await prisma.salesChannel.findUnique({
      where: { code: channelGroups[0].channelCode },
      select: { name: true },
    });
    topChannel = ch?.name ?? channelGroups[0].channelCode;
  }

  const highlights: string[] = [
    `${customer.tier.name} · ${customer.customerType.name} · ${customer.city.name}`,
    `가입 ${customer.joinDate.toISOString().slice(0, 10)} (${tenure.label} 경과)`,
    `총 ${orderCount}건 주문, 배송완료 ${completedOrderCount}건`,
    `누적 거래액 ${formatKrwShort(completedRevenue)} (전체 ${formatKrwShort(totalRevenue)})`,
  ];
  if (avgOrderValue > 0) highlights.push(`평균 주문액 ${formatKrwShort(avgOrderValue)}`);
  if (topChannel) highlights.push(`주요 채널 ${topChannel}`);
  if (lastOrderDate) {
    highlights.push(
      `최근 주문 ${lastOrderDate.toISOString().slice(0, 10)}` +
        (daysSinceLastOrder !== null ? ` (${daysSinceLastOrder}일 전)` : ""),
    );
  } else {
    highlights.push("아직 주문 이력 없음");
  }

  return {
    customerId: customer.customerId,
    customerName: customer.customerName,
    tier: customer.tier.name,
    customerType: customer.customerType.name,
    city: customer.city.name,
    joinDate: customer.joinDate.toISOString().slice(0, 10),
    tenureLabel: tenure.label,
    tenureDays: tenure.days,
    orderCount,
    completedOrderCount,
    totalRevenue,
    completedRevenue,
    avgOrderValue,
    firstOrderDate: allAgg._min.orderDate?.toISOString().slice(0, 10) ?? null,
    lastOrderDate: lastOrderDate?.toISOString().slice(0, 10) ?? null,
    daysSinceLastOrder,
    topChannel,
    highlights,
  };
}

async function buildProductReport(productId: number): Promise<ProductReport | null> {
  const product = await prisma.product.findUnique({
    where: { productId },
    include: { brand: true, category: true, productStatus: true },
  });
  if (!product) return null;

  const sales = await prisma.salesOrderItem.aggregate({
    where: { productId },
    _sum: { qty: true, amountKrw: true },
    _count: true,
  });

  const soldQty = sales._sum.qty ?? 0;
  const soldRevenue = sales._sum.amountKrw ?? 0;
  const marginPct = calcMarginPct(product.unitCostKrw, product.unitPriceKrw);

  const highlights: string[] = [
    `${product.brand.name} · ${product.category.name} · ${product.productStatus.name}`,
    `판매가 ${formatKrwShort(product.unitPriceKrw)}, 마진율 ${marginPct}%`,
    `현재 재고 ${product.stockQty.toLocaleString()}개`,
    `누적 판매 ${soldQty.toLocaleString()}개 · ${formatKrwShort(soldRevenue)} (${sales._count}건)`,
  ];
  if (product.stockQty < 50) {
    highlights.push("재고 50개 미만 — 발주 검토 필요");
  }

  return {
    productId: product.productId,
    productName: product.productName,
    brand: product.brand.name,
    category: product.category.name,
    status: product.productStatus.name,
    stockQty: product.stockQty,
    unitPriceKrw: product.unitPriceKrw,
    marginPct,
    soldQty,
    soldRevenue,
    orderLineCount: sales._count,
    highlights,
  };
}

async function buildOrderReportSummary(
  orderIds: number[],
  totalMatched: number,
): Promise<OrderReportSummary | null> {
  if (orderIds.length === 0) return null;

  const orders = await prisma.salesOrder.findMany({
    where: { orderNo: { in: orderIds } },
    include: { orderStatus: true },
  });

  const statusMap = new Map<string, { count: number; amount: number }>();
  let totalAmount = 0;
  for (const order of orders) {
    const status = order.orderStatus.name;
    const prev = statusMap.get(status) ?? { count: 0, amount: 0 };
    statusMap.set(status, {
      count: prev.count + 1,
      amount: prev.amount + order.totalAmountKrw,
    });
    totalAmount += order.totalAmountKrw;
  }

  const statusBreakdown = [...statusMap.entries()].map(([status, v]) => ({
    status,
    count: v.count,
    amount: v.amount,
  }));

  const highlights = [
    `검색된 주문 ${totalMatched.toLocaleString()}건 중 상위 ${orders.length}건 분석`,
    `표본 합계 ${formatKrwShort(totalAmount)}, 건당 평균 ${formatKrwShort(Math.round(totalAmount / orders.length))}`,
    ...statusBreakdown.map((s) => `${s.status} ${s.count}건 (${formatKrwShort(s.amount)})`),
  ];

  return {
    orderCount: totalMatched,
    totalAmount,
    avgAmount: Math.round(totalAmount / orders.length),
    statusBreakdown,
    highlights,
  };
}

function buildOverview(
  filters: ParsedSearchFilters,
  customerReports: CustomerReport[],
  productReports: ProductReport[],
  orderReport: OrderReportSummary | null,
  totalHits: number,
  homonyms: HomonymInfo | null,
): string {
  if (totalHits === 0) {
    return "일치하는 데이터가 없어 요약 보고서를 생성하지 못했습니다.";
  }

  const parts: string[] = [];

  if (homonyms && customerReports.length > 1) {
    parts.push(
      `"${homonyms.name}" 동명이인 ${homonyms.totalCount}명이 검색되었습니다. ` +
        `아래는 각 고객별 거래 요약이며, 특정 고객을 선택하면 해당 고객만 조회할 수 있습니다.`,
    );
  } else if (customerReports.length === 1) {
    const c = customerReports[0];
    parts.push(
      `${c.customerName} 고객은 ${c.joinDate} 가입(${c.tenureLabel})으로 ` +
        `배송완료 ${c.completedOrderCount}건·${formatKrwShort(c.completedRevenue)} 거래했습니다.`,
    );
    if (c.lastOrderDate) {
      parts.push(
        `최근 주문은 ${c.lastOrderDate}` +
          (c.daysSinceLastOrder !== null ? `(${c.daysSinceLastOrder}일 전)` : "") +
          `이며 평균 주문액은 ${formatKrwShort(c.avgOrderValue)}입니다.`,
      );
    }
  } else if (customerReports.length > 1 && !homonyms) {
    const revenue = customerReports.reduce((s, c) => s + c.completedRevenue, 0);
    parts.push(
      `고객 ${customerReports.length}명 요약: 배송완료 기준 총 ${formatKrwShort(revenue)} 거래.`,
    );
  }

  if (productReports.length === 1) {
    const p = productReports[0];
    parts.push(
      `${p.productName}은(는) 재고 ${p.stockQty}개, 누적 판매 ${p.soldQty.toLocaleString()}개(${formatKrwShort(p.soldRevenue)})입니다.`,
    );
  } else if (productReports.length > 1) {
    const sold = productReports.reduce((s, p) => s + p.soldRevenue, 0);
    parts.push(`상품 ${productReports.length}개 요약: 누적 판매액 ${formatKrwShort(sold)}.`);
  }

  if (orderReport && orderReport.orderCount > 0 && customerReports.length === 0 && productReports.length === 0) {
    parts.push(
      `주문 ${orderReport.orderCount.toLocaleString()}건이 검색되었으며, 표본 평균 주문액은 ${formatKrwShort(orderReport.avgAmount)}입니다.`,
    );
  }

  if (parts.length === 0) {
    return filters.summary || `총 ${totalHits.toLocaleString()}건이 검색되었습니다.`;
  }

  return parts.join(" ");
}

export async function buildSearchReports(
  filters: ParsedSearchFilters,
  customerIds: number[],
  productIds: number[],
  orderNos: number[],
  orderTotal: number,
  totalHits: number,
  homonyms: HomonymInfo | null = null,
): Promise<SearchReports> {
  const [customers, products, orders] = await Promise.all([
    Promise.all(customerIds.map(buildCustomerReport)),
    Promise.all(productIds.map(buildProductReport)),
    buildOrderReportSummary(orderNos, orderTotal),
  ]);

  const customerReports = customers.filter((r): r is CustomerReport => r !== null);
  const productReports = products.filter((r): r is ProductReport => r !== null);

  return {
    overview: buildOverview(filters, customerReports, productReports, orders, totalHits, homonyms),
    customers: customerReports,
    products: productReports,
    orders,
  };
}
