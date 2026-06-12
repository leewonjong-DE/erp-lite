import type { DashboardData } from "@/lib/get-dashboard-data";
import { formatKrw } from "@/lib/format";

export type InsightItem = {
  text: string;
  topicId: string | null;
};

export type InsightEvidence = {
  topicId: string;
  title: string;
  reasoning: string;
  metrics: Array<{ label: string; value: string; hint?: string }>;
  details?: string[];
  source: string;
};

function formatKrwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}

export function buildEvidenceCatalog(data: DashboardData): Record<string, InsightEvidence> {
  const { kpis } = data;
  const months = data.monthlyRevenue;
  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const orderChangePct =
    prevMonth && prevMonth.orders > 0
      ? Math.round(((currentMonth.orders - prevMonth.orders) / prevMonth.orders) * 1000) / 10
      : null;

  const catalog: Record<string, InsightEvidence> = {
    monthly_revenue: {
      topicId: "monthly_revenue",
      title: "월별 매출·주문 비교",
      reasoning:
        `${kpis.referenceMonth} 매출은 ${formatKrwShort(kpis.monthRevenue)}` +
        (kpis.monthChangePct !== null
          ? `로, 전월(${prevMonth?.month ?? "-"}) ${formatKrwShort(prevMonth?.revenue ?? 0)} 대비 ${kpis.monthChangePct > 0 ? "+" : ""}${kpis.monthChangePct}%입니다.`
          : "입니다.") +
        (currentMonth && prevMonth
          ? ` 같은 기간 주문은 ${prevMonth.orders}건 → ${currentMonth.orders}건` +
            (orderChangePct !== null ? ` (${orderChangePct > 0 ? "+" : ""}${orderChangePct}%)` : "") +
            "입니다."
          : ""),
      metrics: [
        {
          label: `${kpis.referenceMonth} 매출`,
          value: formatKrw(kpis.monthRevenue),
          hint: "배송완료 주문 합계",
        },
        {
          label: "전월 매출",
          value: formatKrw(prevMonth?.revenue ?? 0),
          hint: prevMonth?.month ?? "-",
        },
        {
          label: "전월 대비",
          value:
            kpis.monthChangePct !== null
              ? `${kpis.monthChangePct > 0 ? "+" : ""}${kpis.monthChangePct}%`
              : "-",
        },
        {
          label: `${kpis.referenceMonth} 주문`,
          value: `${currentMonth?.orders.toLocaleString() ?? 0}건`,
        },
        {
          label: "전월 주문",
          value: `${prevMonth?.orders.toLocaleString() ?? 0}건`,
          hint: prevMonth?.month ?? "-",
        },
        {
          label: "주문 증감",
          value:
            orderChangePct !== null
              ? `${orderChangePct > 0 ? "+" : ""}${orderChangePct}%`
              : "-",
        },
      ],
      details: months.slice(-3).map(
        (m) => `${m.month}: 매출 ${formatKrwShort(m.revenue)}, 주문 ${m.orders.toLocaleString()}건`,
      ),
      source: "sales_orders · order_date 월별 집계 (배송완료)",
    },

    total_revenue_margin: {
      topicId: "total_revenue_margin",
      title: "누적 매출·마진",
      reasoning: `누적 매출 ${formatKrwShort(kpis.totalRevenue)}, 배송완료 ${kpis.completedOrders.toLocaleString()}건 기준 마진율 ${kpis.grossMarginPct}%입니다.`,
      metrics: [
        { label: "누적 매출", value: formatKrw(kpis.totalRevenue) },
        { label: "배송완료 주문", value: `${kpis.completedOrders.toLocaleString()}건` },
        { label: "마진율", value: `${kpis.grossMarginPct}%` },
        { label: "평균 주문액", value: formatKrw(kpis.avgOrderValue) },
      ],
      source: "sales_orders · sales_order_items 원가·판가 집계",
    },

    active_customers: {
      topicId: "active_customers",
      title: "고객 활성도",
      reasoning: `최근 90일 내 주문한 활성 고객 ${kpis.activeCustomers90d.toLocaleString()}명 / 전체 ${kpis.customerCount.toLocaleString()}명입니다.`,
      metrics: [
        { label: "활성 고객 (90일)", value: `${kpis.activeCustomers90d.toLocaleString()}명` },
        { label: "전체 고객", value: `${kpis.customerCount.toLocaleString()}명` },
        {
          label: "활성 비율",
          value: `${kpis.customerCount > 0 ? Math.round((kpis.activeCustomers90d / kpis.customerCount) * 1000) / 10 : 0}%`,
        },
      ],
      details: data.tierRevenue.map(
        (t) => `${t.tier}: ${t.customers.toLocaleString()}명 · 매출 ${formatKrwShort(t.revenue)}`,
      ),
      source: "customers · sales_orders (최근 90일 주문)",
    },

    pending_orders: {
      topicId: "pending_orders",
      title: "미처리 주문",
      reasoning: `주문접수·결제완료·배송중 상태 주문 ${kpis.pendingOrderCount.toLocaleString()}건, 합계 ${formatKrwShort(kpis.pendingOrderAmount)}이 처리 대기 중입니다.`,
      metrics: [
        { label: "미처리 건수", value: `${kpis.pendingOrderCount.toLocaleString()}건` },
        { label: "미처리 금액", value: formatKrw(kpis.pendingOrderAmount) },
      ],
      details: data.statusCounts
        .filter((s) => ["주문접수", "결제완료", "배송중"].includes(s.status))
        .map((s) => `${s.status}: ${s.count.toLocaleString()}건 · ${formatKrwShort(s.amount)}`),
      source: "sales_orders · status_code 파이프라인",
    },

    stale_orders: {
      topicId: "stale_orders",
      title: "장기 미처리 주문 (7일+)",
      reasoning: `'주문접수' 상태로 7일 이상 경과한 주문 ${data.staleOrders.length}건입니다.`,
      metrics: [
        { label: "장기 미처리", value: `${data.staleOrders.length}건` },
        {
          label: "합계 금액",
          value: formatKrw(data.staleOrders.reduce((s, o) => s + o.amount, 0)),
        },
      ],
      details: data.staleOrders.slice(0, 5).map(
        (o) =>
          `#${o.orderNo} ${o.customerName} · ${o.daysPending}일 경과 · ${formatKrwShort(o.amount)}`,
      ),
      source: "sales_orders · order_date + status_code='주문접수'",
    },

    low_stock: {
      topicId: "low_stock",
      title: "재고 긴급·부족 SKU",
      reasoning: `재고 50개 미만 SKU ${kpis.lowStockCount}개, 30일 내 품절 예상 또는 긴급 알림 ${data.stockAlerts.length}개입니다.`,
      metrics: [
        { label: "재고 50 미만", value: `${kpis.lowStockCount}개` },
        { label: "긴급 알림 SKU", value: `${data.stockAlerts.length}개` },
      ],
      details: data.stockAlerts.slice(0, 5).map(
        (p) =>
          `${p.name} · 재고 ${p.stockQty} · 90일 판매 ${p.sold90d}` +
          (p.daysToStockout !== null ? ` · ${p.daysToStockout}일 내 품절 예상` : ""),
      ),
      source: "products · sales_order_items (90일 판매량)",
    },

    vip_inactive: {
      topicId: "vip_inactive",
      title: "VIP 이탈 위험",
      reasoning: `VIP 등급 고객 중 180일 이상 미주문 ${data.vipInactive.length}명입니다.`,
      metrics: [{ label: "180일+ 미주문 VIP", value: `${data.vipInactive.length}명` }],
      details: data.vipInactive.slice(0, 5).map((c) => `${c.name} · ${c.daysSince}일 미주문`),
      source: "customers · sales_orders (VIP + last_order_date)",
    },

    new_customer_no_order: {
      topicId: "new_customer_no_order",
      title: "신규 고객 미주문",
      reasoning: `최근 90일 가입 고객 ${data.newCustomerMonitoring.total90d}명 중 아직 주문 없는 고객 ${data.newCustomerMonitoring.noOrder}명입니다.`,
      metrics: [
        { label: "90일 신규 가입", value: `${data.newCustomerMonitoring.total90d}명` },
        { label: "미주문", value: `${data.newCustomerMonitoring.noOrder}명` },
      ],
      source: "customers · join_date (90일)",
    },

    new_customer_one_order: {
      topicId: "new_customer_one_order",
      title: "신규 고객 재구매 대기",
      reasoning: `1회만 구매 후 30일 이상 재구매 없는 신규 고객 ${data.newCustomerMonitoring.oneOrderRisk}명입니다.`,
      metrics: [
        { label: "재구매 대기", value: `${data.newCustomerMonitoring.oneOrderRisk}명` },
        { label: "첫 구매 완료", value: `${data.newCustomerMonitoring.firstBuy}명` },
      ],
      source: "customers · sales_orders (신규 cohort)",
    },

    new_customer_repeat: {
      topicId: "new_customer_repeat",
      title: "신규 고객 재구매율",
      reasoning: `90일 신규 가입 ${data.newCustomerMonitoring.total90d}명 중 재구매 ${data.newCustomerMonitoring.repeat}명, 재구매율 ${data.newCustomerMonitoring.repeatRate}%입니다.`,
      metrics: [
        { label: "신규 가입 (90일)", value: `${data.newCustomerMonitoring.total90d}명` },
        { label: "재구매", value: `${data.newCustomerMonitoring.repeat}명` },
        { label: "재구매율", value: `${data.newCustomerMonitoring.repeatRate}%` },
      ],
      source: "customers · sales_orders (신규 cohort)",
    },

    cancel_return: {
      topicId: "cancel_return",
      title: "취소·반품율",
      reasoning: `전체 ${kpis.orderCount.toLocaleString()}건 중 취소·반품율 ${kpis.cancelReturnRate}%입니다.`,
      metrics: [
        { label: "취소·반품율", value: `${kpis.cancelReturnRate}%` },
        { label: "전체 주문", value: `${kpis.orderCount.toLocaleString()}건` },
      ],
      details: data.statusCounts
        .filter((s) => ["취소", "반품"].includes(s.status))
        .map((s) => `${s.status}: ${s.count.toLocaleString()}건`),
      source: "sales_orders · status_code",
    },

    top_channel: {
      topicId: "top_channel",
      title: "채널별 매출",
      reasoning: data.channelRevenue[0]
        ? `최대 매출 채널은 '${data.channelRevenue[0].channel}' (${formatKrwShort(data.channelRevenue[0].revenue)})입니다.`
        : "채널별 매출 데이터가 없습니다.",
      metrics: data.channelRevenue.slice(0, 4).map((c) => ({
        label: c.channel,
        value: formatKrwShort(c.revenue),
      })),
      source: "sales_orders · channel_code (배송완료)",
    },

    avg_order_value: {
      topicId: "avg_order_value",
      title: "평균 주문액",
      reasoning: `배송완료 ${kpis.completedOrders.toLocaleString()}건 기준 평균 주문액 ${formatKrwShort(kpis.avgOrderValue)}입니다.`,
      metrics: [
        { label: "평균 주문액", value: formatKrw(kpis.avgOrderValue) },
        { label: "배송완료", value: `${kpis.completedOrders.toLocaleString()}건` },
      ],
      source: "sales_orders · total_amount_krw",
    },
  };

  return catalog;
}

const TOPIC_MATCHERS: Array<{ topicId: string; patterns: RegExp[] }> = [
  {
    topicId: "monthly_revenue",
    patterns: [/매출.*전월|전월.*매출|매출.*감소|매출.*증가|주문 건수|주문.*줄|주문.*감소|월 매출/i],
  },
  {
    topicId: "total_revenue_margin",
    patterns: [/누적 매출|총매출|총 매출|마진율|마진/i],
  },
  { topicId: "avg_order_value", patterns: [/평균 주문|객단가|B2B.*단가/i] },
  { topicId: "active_customers", patterns: [/활성 고객|고객.*명/i] },
  { topicId: "pending_orders", patterns: [/미처리|처리 대기|밀린|적체|934|출고.*지연/i] },
  { topicId: "stale_orders", patterns: [/7일|장기.*미처리|미처리 주문.*일/i] },
  { topicId: "low_stock", patterns: [/재고|품절|SKU|입고|발주/i] },
  { topicId: "vip_inactive", patterns: [/VIP|이탈|180일|미주문 VIP/i] },
  { topicId: "new_customer_no_order", patterns: [/신규.*미주문|미주문.*신규|온보딩|웰컴/i] },
  { topicId: "new_customer_one_order", patterns: [/재구매 대기|1회.*구매|첫 구매 후/i] },
  { topicId: "new_customer_repeat", patterns: [/재구매율|신규 고객.*재구매/i] },
  { topicId: "cancel_return", patterns: [/취소|반품/i] },
  { topicId: "top_channel", patterns: [/채널|영업사원|온라인|매장|전화/i] },
];

export function inferTopicId(text: string): string | null {
  for (const { topicId, patterns } of TOPIC_MATCHERS) {
    if (patterns.some((p) => p.test(text))) return topicId;
  }
  return null;
}

export function toInsightItem(text: string, topicId?: string | null): InsightItem {
  return { text, topicId: topicId ?? inferTopicId(text) };
}

export function attachEvidenceToInsights(
  items: string[],
  explicitTopics?: (string | null)[],
): InsightItem[] {
  return items.map((text, i) => toInsightItem(text, explicitTopics?.[i] ?? null));
}
