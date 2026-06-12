import { prisma } from "@/lib/prisma";
import { calcMarginPct, formatKrw } from "@/lib/format";
import {
  customerInclude,
  orderListInclude,
  productInclude,
  serializeCustomer,
  serializeOrderListItem,
  serializeProduct,
} from "@/lib/serialize";
import type { ParsedSearchFilters } from "@/lib/ai-search";

export type ProductRankMetric = "marginPct" | "unitPriceKrw" | "stockQty" | "unitCostKrw";
export type CustomerRankMetric = "revenue" | "orderCount";
export type ProductSalesMetric = "soldQty" | "soldRevenue";
export type OrderStatKind = "pendingCount" | "avgAmount" | "monthRevenue" | "totalCount";

export type AnalyticsSpec =
  | {
      kind: "product_rank";
      metric: ProductRankMetric;
      order: "asc" | "desc";
      limit: number;
      brand?: string;
      category?: string;
      summary: string;
      metricLabel: string;
    }
  | {
      kind: "product_sales_rank";
      metric: ProductSalesMetric;
      order: "desc";
      limit: number;
      brand?: string;
      category?: string;
      summary: string;
      metricLabel: string;
    }
  | {
      kind: "customer_rank";
      metric: CustomerRankMetric;
      order: "desc";
      limit: number;
      tier?: string;
      city?: string;
      summary: string;
      metricLabel: string;
    }
  | {
      kind: "order_stat";
      stat: OrderStatKind;
      summary: string;
      metricLabel: string;
    };

export type RankedProduct = ReturnType<typeof serializeProduct> & {
  marginPct: number;
  rank: number;
  soldQty?: number;
  soldRevenue?: number;
};

export type RankedCustomer = ReturnType<typeof serializeCustomer> & {
  rank: number;
  revenue: number;
  orderCount: number;
};

export type IntentAnalyticsResult = {
  mode: "analytics" | "guided";
  summary: string;
  directAnswer: string;
  suggestions?: string[];
  analytics?: AnalyticsSpec;
  customers: { data: RankedCustomer[]; total: number };
  products: { data: RankedProduct[]; total: number };
  orders: { data: ReturnType<typeof serializeOrderListItem>[]; total: number };
  filters: ParsedSearchFilters;
};

const METRIC_LABELS: Record<ProductRankMetric, string> = {
  marginPct: "마진율",
  unitPriceKrw: "판매가",
  stockQty: "재고",
  unitCostKrw: "원가",
};

const RANK_SIGNAL =
  /(가장|최고|최저|최대|최소|top|상위|\d+\s*위|1위|많|적|높|낮|비싼|싼|베스트|뭐|무엇|알려|줘|은\s*\?|이\s*\?)/i;

function isProductRankQuery(q: string): boolean {
  return (
    /(마진|마진율|판매가|가격|재고|원가|상품)/i.test(q) &&
    RANK_SIGNAL.test(q) &&
    !/(고객|거래처|매출.*고객|주문.*고객)/i.test(q) &&
    !/(많이\s*팔|판매\s*량|베스트\s*셀러|매출\s*top)/i.test(q)
  );
}

function isProductSalesQuery(q: string): boolean {
  return (
    /(많이\s*팔|판매\s*량|베스트\s*셀러|잘\s*팔|인기\s*상품|매출\s*top|매출\s*높|판매\s*액\s*top)/i.test(q) &&
    /(상품|제품|sku|top|가장|높|많)/i.test(q)
  );
}

function isCustomerRankQuery(q: string): boolean {
  return (
    /(고객|거래처|회사|buyer)/i.test(q) &&
    RANK_SIGNAL.test(q) &&
    /(매출|거래|주문|많|높|top|가장)/i.test(q)
  );
}

function isOrderStatQuery(q: string): boolean {
  if (/미처리|처리\s*대기|주문접수\s*몇|접수\s*주문/i.test(q) && /(몇|건|수|얼마)/i.test(q)) {
    return true;
  }
  if (/평균\s*주문/i.test(q)) return true;
  if (/이번\s*달\s*매출|당월\s*매출|이번달\s*매출/i.test(q)) return true;
  if (/전체\s*주문\s*몇|총\s*주문\s*몇/i.test(q)) return true;
  return false;
}

export function parseAnalyticsQuery(
  query: string,
  masters: { brands: string[]; categories: string[]; tiers?: string[]; cities?: string[] },
): AnalyticsSpec | null {
  const q = query.trim();

  if (isOrderStatQuery(q)) {
    if (/평균\s*주문/i.test(q)) {
      return { kind: "order_stat", stat: "avgAmount", summary: "평균 주문 금액", metricLabel: "평균 주문액" };
    }
    if (/이번\s*달|당월/i.test(q)) {
      return { kind: "order_stat", stat: "monthRevenue", summary: "이번 달 매출", metricLabel: "당월 매출" };
    }
    if (/미처리|처리\s*대기|주문접수/i.test(q)) {
      return { kind: "order_stat", stat: "pendingCount", summary: "미처리(주문접수) 건수", metricLabel: "미처리 주문" };
    }
    return { kind: "order_stat", stat: "totalCount", summary: "전체 주문 건수", metricLabel: "전체 주문" };
  }

  if (isCustomerRankQuery(q)) {
    const metric: CustomerRankMetric = /주문\s*(많|건)|주문\s*top/i.test(q) ? "orderCount" : "revenue";
    const limitMatch = q.match(/(?:top|상위)\s*(\d+)/i);
    const limit = Math.min(10, Math.max(1, limitMatch ? Number(limitMatch[1]) : 5));
    const tier = masters.tiers?.find((t) => q.includes(t));
    const city = masters.cities?.find((c) => q.includes(c));
    const metricLabel = metric === "revenue" ? "매출" : "주문 건수";
    const scope = [city, tier].filter(Boolean).join(" ");
    return {
      kind: "customer_rank",
      metric,
      order: "desc",
      limit,
      tier,
      city,
      summary: scope ? `${scope} 고객 ${metricLabel} 순` : `${metricLabel} 상위 고객`,
      metricLabel,
    };
  }

  if (isProductSalesQuery(q)) {
    const metric: ProductSalesMetric = /매출|판매\s*액|금액/i.test(q) ? "soldRevenue" : "soldQty";
    const limitMatch = q.match(/(?:top|상위)\s*(\d+)/i);
    const limit = Math.min(10, Math.max(1, limitMatch ? Number(limitMatch[1]) : 5));
    const brand = masters.brands.find((b) => q.includes(b));
    const category = masters.categories.find((c) => q.includes(c));
    const metricLabel = metric === "soldRevenue" ? "누적 판매액" : "누적 판매량";
    const scope = [brand, category].filter(Boolean).join(" ");
    return {
      kind: "product_sales_rank",
      metric,
      order: "desc",
      limit,
      brand,
      category,
      summary: scope ? `${scope} ${metricLabel} 순` : `${metricLabel} 상위 상품`,
      metricLabel,
    };
  }

  if (!isProductRankQuery(q)) return null;

  let metric: ProductRankMetric = "marginPct";
  if (/마진|마진율/.test(q)) metric = "marginPct";
  else if (/판매가|가격|비싼|싼/.test(q)) metric = "unitPriceKrw";
  else if (/재고|품절|stock/i.test(q)) metric = "stockQty";
  else if (/원가/.test(q)) metric = "unitCostKrw";

  let order: "asc" | "desc" = "desc";
  const wantsHigh = /(높|많|비싼|최고|가장\s*높|max|최대)/i.test(q);
  const wantsLow = /(낮|적|싼|최저|부족|적음|최소)/i.test(q);
  if (metric === "stockQty") order = wantsLow && !wantsHigh ? "asc" : "desc";
  else if (wantsLow && !wantsHigh) order = "asc";

  const limitMatch = q.match(/(?:top|상위)\s*(\d+)/i);
  const limit = Math.min(10, Math.max(1, limitMatch ? Number(limitMatch[1]) : 5));
  const brand = masters.brands.find((b) => q.includes(b));
  const category = masters.categories.find((c) => q.includes(c));
  const metricLabel = METRIC_LABELS[metric];
  const orderLabel = order === "desc" ? "높은" : "낮은";
  const scope = [brand, category].filter(Boolean).join(" ");
  const summary = scope
    ? `${scope} 상품 중 ${metricLabel} ${orderLabel} 순`
    : `${metricLabel} ${orderLabel} 상품 순위`;

  return { kind: "product_rank", metric, order, limit, brand, category, summary, metricLabel };
}

function metricValue(
  product: { unitCostKrw: number; unitPriceKrw: number; stockQty: number },
  metric: ProductRankMetric,
): number {
  if (metric === "marginPct") return calcMarginPct(product.unitCostKrw, product.unitPriceKrw);
  return product[metric];
}

function formatMetricValue(
  metric: ProductRankMetric | ProductSalesMetric | CustomerRankMetric,
  value: number,
): string {
  if (metric === "marginPct") return `${value}%`;
  if (metric === "stockQty" || metric === "soldQty" || metric === "orderCount") {
    return `${value.toLocaleString()}${metric === "orderCount" ? "건" : "개"}`;
  }
  return formatKrw(value);
}

async function executeProductRank(spec: Extract<AnalyticsSpec, { kind: "product_rank" }>) {
  const where = {
    ...(spec.brand ? { brandCode: spec.brand } : {}),
    ...(spec.category ? { categoryCode: spec.category } : {}),
  };
  const rows = await prisma.product.findMany({ where, include: productInclude });
  const ranked = rows
    .map((row) => {
      const serialized = serializeProduct(row);
      const marginPct = calcMarginPct(row.unitCostKrw, row.unitPriceKrw);
      return { ...serialized, marginPct, sortValue: metricValue(row, spec.metric) };
    })
    .sort((a, b) => (spec.order === "desc" ? b.sortValue - a.sortValue : a.sortValue - b.sortValue))
    .map((item, index) => {
      const { sortValue: _, ...rest } = item;
      return { ...rest, rank: index + 1 };
    });

  const top = ranked.slice(0, spec.limit);
  const value = top[0]
    ? formatMetricValue(
        spec.metric,
        spec.metric === "marginPct" ? top[0].marginPct : (top[0][spec.metric] as number),
      )
    : "";
  const extra =
    top[0] && spec.metric === "marginPct"
      ? ` (판매가 ${formatKrw(top[0].unitPriceKrw)}, 원가 ${formatKrw(top[0].unitCostKrw)})`
      : top[0] && spec.metric === "unitPriceKrw"
        ? ` (마진율 ${top[0].marginPct}%)`
        : top[0] && spec.metric === "stockQty"
          ? ` (${top[0].brand} · ${top[0].category})`
          : "";

  const directAnswer =
    top.length > 0
      ? `${spec.metricLabel}${spec.order === "desc" ? "이(가) 가장 높은" : "이(가) 가장 낮은"} ` +
        `상품은 「${top[0].productName}」${extra} — ${value}입니다. ` +
        `(전체 ${rows.length.toLocaleString()}개 SKU 중 상위 ${spec.limit}개 표시)`
      : "조건에 맞는 상품이 없습니다.";

  return { products: top, total: rows.length, directAnswer };
}

async function executeProductSalesRank(spec: Extract<AnalyticsSpec, { kind: "product_sales_rank" }>) {
  const productWhere = {
    ...(spec.brand ? { brandCode: spec.brand } : {}),
    ...(spec.category ? { categoryCode: spec.category } : {}),
  };

  const items = await prisma.salesOrderItem.findMany({
    where: {
      product: productWhere,
      order: { statusCode: "배송완료" },
    },
    include: { product: { include: productInclude } },
  });

  const agg = new Map<number, { product: (typeof items)[0]["product"]; soldQty: number; soldRevenue: number }>();
  for (const item of items) {
    const cur = agg.get(item.productId) ?? { product: item.product, soldQty: 0, soldRevenue: 0 };
    cur.soldQty += item.qty;
    cur.soldRevenue += item.amountKrw;
    agg.set(item.productId, cur);
  }

  const ranked = [...agg.values()]
    .map(({ product, soldQty, soldRevenue }) => {
      const serialized = serializeProduct(product);
      const marginPct = calcMarginPct(product.unitCostKrw, product.unitPriceKrw);
      const sortValue = spec.metric === "soldRevenue" ? soldRevenue : soldQty;
      return { ...serialized, marginPct, soldQty, soldRevenue, sortValue };
    })
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((item, index) => {
      const { sortValue: _, ...rest } = item;
      return { ...rest, rank: index + 1 };
    });

  const top = ranked.slice(0, spec.limit);
  const directAnswer =
    top.length > 0
      ? `${spec.metricLabel} 1위 상품은 「${top[0].productName}」 — ` +
        `${formatMetricValue(spec.metric, spec.metric === "soldRevenue" ? top[0].soldRevenue! : top[0].soldQty!)} ` +
        `(배송완료 기준, ${ranked.length.toLocaleString()}개 SKU 중 상위 ${spec.limit}개)`
      : "배송완료 주문 기준 판매 데이터가 없습니다.";

  return { products: top, total: ranked.length, directAnswer };
}

async function executeCustomerRank(spec: Extract<AnalyticsSpec, { kind: "customer_rank" }>) {
  const customerWhere = {
    ...(spec.tier ? { tierCode: spec.tier } : {}),
    ...(spec.city ? { city: { name: { contains: spec.city, mode: "insensitive" as const } } } : {}),
  };

  const orders = await prisma.salesOrder.findMany({
    where: {
      statusCode: "배송완료",
      customer: customerWhere,
    },
    include: { customer: { include: customerInclude } },
  });

  const agg = new Map<number, { customer: (typeof orders)[0]["customer"]; revenue: number; orderCount: number }>();
  for (const order of orders) {
    const cur = agg.get(order.customerId) ?? { customer: order.customer, revenue: 0, orderCount: 0 };
    cur.revenue += order.totalAmountKrw;
    cur.orderCount += 1;
    agg.set(order.customerId, cur);
  }

  const ranked = [...agg.values()]
    .map(({ customer, revenue, orderCount }) => ({
      ...serializeCustomer(customer),
      revenue,
      orderCount,
      sortValue: spec.metric === "revenue" ? revenue : orderCount,
    }))
    .sort((a, b) => b.sortValue - a.sortValue)
    .map((item, index) => {
      const { sortValue: _, ...rest } = item;
      return { ...rest, rank: index + 1 };
    });

  const top = ranked.slice(0, spec.limit);
  const directAnswer =
    top.length > 0
      ? `${spec.metricLabel} 1위 고객은 「${top[0].customerName}」 — ` +
        `${formatMetricValue(spec.metric, spec.metric === "revenue" ? top[0].revenue : top[0].orderCount)} ` +
        `(배송완료 기준, ${ranked.length.toLocaleString()}명 중 상위 ${spec.limit}명)`
      : "조건에 맞는 고객 거래 데이터가 없습니다.";

  return { customers: top, total: ranked.length, directAnswer };
}

async function executeOrderStat(spec: Extract<AnalyticsSpec, { kind: "order_stat" }>) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (spec.stat === "pendingCount") {
    const count = await prisma.salesOrder.count({ where: { statusCode: "주문접수" } });
    const rows = await prisma.salesOrder.findMany({
      where: { statusCode: "주문접수" },
      take: 5,
      orderBy: { orderDate: "desc" },
      include: orderListInclude,
    });
    return {
      orders: rows.map(serializeOrderListItem),
      total: count,
      directAnswer: `현재 미처리(주문접수) 주문은 ${count.toLocaleString()}건입니다. 아래 최근 접수 주문을 참고하세요.`,
    };
  }

  if (spec.stat === "avgAmount") {
    const agg = await prisma.salesOrder.aggregate({
      _avg: { totalAmountKrw: true },
      _count: { orderNo: true },
      where: { statusCode: "배송완료" },
    });
    const avg = Math.round(agg._avg.totalAmountKrw ?? 0);
    const count = agg._count.orderNo;
    return {
      orders: [],
      total: count,
      directAnswer: `배송완료 주문 ${count.toLocaleString()}건 기준 평균 주문 금액은 ${formatKrw(avg)}입니다.`,
    };
  }

  if (spec.stat === "monthRevenue") {
    const agg = await prisma.salesOrder.aggregate({
      _sum: { totalAmountKrw: true },
      _count: { orderNo: true },
      where: { statusCode: "배송완료", orderDate: { gte: monthStart } },
    });
    const sum = agg._sum.totalAmountKrw ?? 0;
    const count = agg._count.orderNo;
    const label = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
    return {
      orders: [],
      total: count,
      directAnswer: `${label} 배송완료 매출은 ${formatKrw(sum)} (${count.toLocaleString()}건)입니다.`,
    };
  }

  const count = await prisma.salesOrder.count();
  return {
    orders: [],
    total: count,
    directAnswer: `전체 주문은 ${count.toLocaleString()}건입니다.`,
  };
}

function buildFiltersFromSpec(spec: AnalyticsSpec): ParsedSearchFilters {
  if (spec.kind === "product_rank" || spec.kind === "product_sales_rank") {
    return {
      entities: ["products"],
      summary: spec.summary,
      products: {
        ...(spec.brand ? { brand: spec.brand } : {}),
        ...(spec.category ? { category: spec.category } : {}),
      },
    };
  }
  if (spec.kind === "customer_rank") {
    return {
      entities: ["customers"],
      summary: spec.summary,
      customers: {
        ...(spec.tier ? { tier: spec.tier } : {}),
        ...(spec.city ? { city: spec.city } : {}),
      },
    };
  }
  return {
    entities: ["orders"],
    summary: spec.summary,
    orders: spec.stat === "pendingCount" ? { status: "주문접수" } : {},
  };
}

export async function runIntentAnalytics(query: string, spec: AnalyticsSpec): Promise<IntentAnalyticsResult> {
  const filters = buildFiltersFromSpec(spec);

  if (spec.kind === "product_rank") {
    const { products, total, directAnswer } = await executeProductRank(spec);
    return {
      mode: "analytics",
      summary: spec.summary,
      directAnswer,
      analytics: spec,
      customers: { data: [], total: 0 },
      products: { data: products, total },
      orders: { data: [], total: 0 },
      filters,
    };
  }

  if (spec.kind === "product_sales_rank") {
    const { products, total, directAnswer } = await executeProductSalesRank(spec);
    return {
      mode: "analytics",
      summary: spec.summary,
      directAnswer,
      analytics: spec,
      customers: { data: [], total: 0 },
      products: { data: products, total },
      orders: { data: [], total: 0 },
      filters,
    };
  }

  if (spec.kind === "customer_rank") {
    const { customers, total, directAnswer } = await executeCustomerRank(spec);
    return {
      mode: "analytics",
      summary: spec.summary,
      directAnswer,
      analytics: spec,
      customers: { data: customers, total },
      products: { data: [], total: 0 },
      orders: { data: [], total: 0 },
      filters,
    };
  }

  const { orders, total, directAnswer } = await executeOrderStat(spec);
  return {
    mode: "analytics",
    summary: spec.summary,
    directAnswer,
    analytics: spec,
    customers: { data: [], total: 0 },
    products: { data: [], total: 0 },
    orders: { data: orders, total },
    filters,
  };
}
