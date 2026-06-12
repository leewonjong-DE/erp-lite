import { GoogleGenAI } from "@google/genai";
import type { DashboardData } from "@/lib/get-dashboard-data";
import { toInsightItem, type InsightItem } from "@/lib/insight-evidence";

export type AiInsightsResult = {
  source: "ai" | "rule";
  showApiSetupHint?: boolean;
  summary: string;
  highlights: InsightItem[];
  risks: InsightItem[];
  actions: InsightItem[];
  generatedAt: string;
};

function formatKrwShort(n: number): string {
  if (n >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(1)}억 원`;
  if (n >= 1_0000) return `${Math.round(n / 1_0000).toLocaleString()}만 원`;
  return `${n.toLocaleString()}원`;
}

export function buildInsightsContext(data: DashboardData): string {
  const { kpis } = data;
  const recentMonths = data.monthlyRevenue.slice(-3);
  const lowMarginCategories = [...data.categoryMargin]
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, 3);

  return JSON.stringify(
    {
      company: "IT 기기·소프트웨어 B2B 유통",
      referenceMonth: kpis.referenceMonth,
      kpis: {
        monthRevenue: kpis.monthRevenue,
        monthChangePct: kpis.monthChangePct,
        totalRevenue: kpis.totalRevenue,
        avgOrderValue: kpis.avgOrderValue,
        grossMarginPct: kpis.grossMarginPct,
        cancelReturnRate: kpis.cancelReturnRate,
        pendingOrders: kpis.pendingOrderCount,
        pendingAmount: kpis.pendingOrderAmount,
        activeCustomers90d: kpis.activeCustomers90d,
        totalCustomers: kpis.customerCount,
        lowStockSku: kpis.lowStockCount,
      },
      alerts: data.alerts,
      recentMonthlyTrend: recentMonths,
      statusPipeline: data.statusCounts,
      topChannels: data.channelRevenue.slice(0, 4),
      tierBreakdown: data.tierRevenue,
      lowMarginCategories,
      topCustomers: data.topCustomers.slice(0, 5),
      topProducts: data.topProducts.slice(0, 5),
      stockAlerts: data.stockAlerts.slice(0, 5),
      vipInactive: data.vipInactive.slice(0, 5),
      staleOrders: data.staleOrders.slice(0, 5),
      newCustomerMonitoring: data.newCustomerMonitoring,
    },
    null,
    0,
  );
}

function generateRuleBasedInsights(data: DashboardData): AiInsightsResult {
  const { kpis } = data;
  const highlights: InsightItem[] = [];
  const risks: InsightItem[] = [];
  const actions: InsightItem[] = [];

  highlights.push({
    text:
      `${kpis.referenceMonth} 매출 ${formatKrwShort(kpis.monthRevenue)}` +
      (kpis.monthChangePct !== null
        ? `, 전월 대비 ${kpis.monthChangePct > 0 ? "+" : ""}${kpis.monthChangePct}%`
        : ""),
    topicId: "monthly_revenue",
  });
  highlights.push({
    text: `누적 매출 ${formatKrwShort(kpis.totalRevenue)}, 마진율 ${kpis.grossMarginPct}%`,
    topicId: "total_revenue_margin",
  });
  highlights.push({
    text: `활성 고객 ${kpis.activeCustomers90d.toLocaleString()}명 / 전체 ${kpis.customerCount.toLocaleString()}명`,
    topicId: "active_customers",
  });

  if (kpis.pendingOrderCount > 0) {
    risks.push({
      text: `처리 대기 주문 ${kpis.pendingOrderCount}건 (${formatKrwShort(kpis.pendingOrderAmount)})`,
      topicId: "pending_orders",
    });
    actions.push({
      text: "미완료 주문 출고·배송 처리 우선 검토",
      topicId: "pending_orders",
    });
  }
  if (data.staleOrders.length > 0) {
    risks.push({
      text: `7일+ 미처리 주문 ${data.staleOrders.length}건`,
      topicId: "stale_orders",
    });
    actions.push({
      text: "장기 '주문접수' 건 CS·물류팀 즉시 확인",
      topicId: "stale_orders",
    });
  }
  if (kpis.lowStockCount > 0) {
    risks.push({
      text: `재고 긴급 SKU ${kpis.lowStockCount}개`,
      topicId: "low_stock",
    });
    actions.push({
      text: "품절 임박 SKU 발주·입고 검토",
      topicId: "low_stock",
    });
  }
  if (data.vipInactive.length > 0) {
    risks.push({
      text: `180일+ 미주문 VIP ${data.vipInactive.length}명`,
      topicId: "vip_inactive",
    });
    actions.push({
      text: "VIP 고객 이탈 방지 영업 follow-up",
      topicId: "vip_inactive",
    });
  }
  const nc = data.newCustomerMonitoring;
  if (nc.noOrder > 0) {
    risks.push({
      text: `신규 가입(90일) 중 미주문 ${nc.noOrder}명`,
      topicId: "new_customer_no_order",
    });
    actions.push({
      text: "미주문 신규 고객 웰컴 콜·첫 구매 프로모션",
      topicId: "new_customer_no_order",
    });
  }
  if (nc.oneOrderRisk > 0) {
    risks.push({
      text: `첫 구매 후 재구매 대기 ${nc.oneOrderRisk}명 (30일+)`,
      topicId: "new_customer_one_order",
    });
    actions.push({
      text: "1회 구매 신규 고객 재구매 제안·관계 점검",
      topicId: "new_customer_one_order",
    });
  }
  if (nc.total90d > 0) {
    highlights.push({
      text: `신규 고객 ${nc.total90d}명, 재구매율 ${nc.repeatRate}%`,
      topicId: "new_customer_repeat",
    });
  }
  if (kpis.cancelReturnRate > 10) {
    risks.push({
      text: `취소·반품율 ${kpis.cancelReturnRate}% — 업계 평균 대비 높을 수 있음`,
      topicId: "cancel_return",
    });
    actions.push({
      text: "취소·반품 원인 분석 및 프로세스 개선",
      topicId: "cancel_return",
    });
  }

  const topChannel = data.channelRevenue[0];
  if (topChannel) {
    actions.push({
      text: `주력 채널 '${topChannel.channel}' 매출 집중 — 채널별 전략 점검`,
      topicId: "top_channel",
    });
  }

  const summary =
    `IT B2B 유통 기준 ${kpis.referenceMonth} 매출은 ${formatKrwShort(kpis.monthRevenue)}이며, ` +
    `마진율 ${kpis.grossMarginPct}%, 활성 고객 ${kpis.activeCustomers90d}명입니다. ` +
    (data.alerts.length > 0
      ? `현재 ${data.alerts.length}건의 운영 알림이 있어 즉시 대응이 필요합니다.`
      : "주요 운영 알림은 없으며 안정적인 흐름을 유지 중입니다.");

  return {
    source: "rule",
    summary,
    highlights,
    risks,
    actions,
    generatedAt: new Date().toISOString(),
  };
}

async function generateGeminiInsights(context: string): Promise<AiInsightsResult> {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.JEM_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const prompt = `당신은 IT B2B 유통 회사의 경영·운영 분석가입니다.
아래 ERP 대시보드 JSON을 바탕으로 경영진 브리핑을 작성하세요.

규칙:
- 반드시 한국어로 작성
- JSON에 없는 수치를 만들지 말 것
- 실무자가 바로 실행할 수 있는 구체적 권장 액션 포함
- 각 배열 항목은 1문장, 80자 이내 권장
- 각 항목에 topicId를 반드시 지정 (근거 데이터 연결용). 아래 목록에서만 선택:
  monthly_revenue, total_revenue_margin, avg_order_value, active_customers,
  pending_orders, stale_orders, low_stock, vip_inactive,
  new_customer_no_order, new_customer_one_order, new_customer_repeat,
  cancel_return, top_channel

응답 JSON 스키마:
{
  "summary": "경영·운영 종합 요약 2~3문장",
  "highlights": [{ "text": "...", "topicId": "..." }],
  "risks": [{ "text": "...", "topicId": "..." }],
  "actions": [{ "text": "...", "topicId": "..." }]
}

대시보드 데이터:
${context}`;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  const parsed = JSON.parse(text) as {
    summary: string;
    highlights: Array<string | { text: string; topicId?: string }>;
    risks: Array<string | { text: string; topicId?: string }>;
    actions: Array<string | { text: string; topicId?: string }>;
  };

  function normalizeItems(items: Array<string | { text: string; topicId?: string }>): InsightItem[] {
    return items.map((item) => {
      if (typeof item === "string") return toInsightItem(item);
      return toInsightItem(item.text, item.topicId ?? null);
    });
  }

  return {
    source: "ai",
    summary: parsed.summary,
    highlights: normalizeItems(parsed.highlights ?? []),
    risks: normalizeItems(parsed.risks ?? []),
    actions: normalizeItems(parsed.actions ?? []),
    generatedAt: new Date().toISOString(),
  };
}

export async function generateInsights(data: DashboardData): Promise<AiInsightsResult> {
  const context = buildInsightsContext(data);

  try {
    return await generateGeminiInsights(context);
  } catch (err) {
    if (err instanceof Error && err.message === "API_KEY_MISSING") {
      return { ...generateRuleBasedInsights(data), showApiSetupHint: true };
    }
    console.error("AI insights fallback:", err);
    return generateRuleBasedInsights(data);
  }
}
