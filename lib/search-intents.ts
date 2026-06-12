import { prisma } from "@/lib/prisma";
import type { ParsedSearchFilters } from "@/lib/ai-search";
import {
  parseAnalyticsQuery,
  runIntentAnalytics,
  type AnalyticsSpec,
  type IntentAnalyticsResult,
} from "@/lib/search-analytics";

export type SearchMasters = {
  brands: string[];
  categories: string[];
  tiers: string[];
  cities: string[];
  orderStatuses: string[];
};

export type GuidedIntent = {
  id: string;
  summary: string;
  directAnswer: string;
  suggestions: string[];
};

export type ZeroResultGuidance = {
  directAnswer: string;
  suggestions: string[];
};

const QUESTION_SIGNAL =
  /(가장|최고|최저|최대|최소|top|상위|\d+\s*위|1위|많|적|높|낮|비싼|싼|베스트|몇\s*건|얼마|뭐|무엇|알려|줘|은\s*\?|이\s*\?|어떤|누구|언제|왜|어디)/i;

/** 인식은 되지만 자동 답변이 아직 없는 질문 — 0건 대신 안내 문구 */
const GUIDED_INTENTS: Array<{
  id: string;
  test: (q: string) => boolean;
  build: (q: string) => GuidedIntent;
}> = [
  {
    id: "period_compare",
    test: (q) => /(작년|전년|지난달|전월|대비|비교|증감|변화|추세)/i.test(q),
    build: () => ({
      id: "period_compare",
      summary: "기간 비교·추세 분석",
      directAnswer:
        "기간별 매출·주문 비교는 대시보드 하단 AI 브리핑에서 확인할 수 있습니다. " +
        "브리핑 항목을 클릭하면 근거 데이터와 계산 과정도 볼 수 있습니다.",
      suggestions: ["이번 달 배송완료 주문", "100만원 이상 주문", "VIP 고객"],
    }),
  },
  {
    id: "forecast",
    test: (q) => /(예측|전망|예상|내년|다음\s*달|앞으로)/i.test(q),
    build: () => ({
      id: "forecast",
      summary: "예측·전망 질문",
      directAnswer:
        "미래 매출·수요 예측은 아직 검색에서 지원하지 않습니다. " +
        "현재 데이터 기준으로는 '가장 많이 팔린 상품', '매출 상위 고객' 같은 순위 질문을 이용해 주세요.",
      suggestions: ["가장 많이 팔린 상품", "매출이 가장 많은 고객", "마진율이 가장 높은 상품"],
    }),
  },
  {
    id: "company_profit",
    test: (q) =>
      /(총\s*이익|순이익|영업이익|회사\s*마진|전체\s*수익)/i.test(q) &&
      !/(상품|제품|sku)/i.test(q),
    build: () => ({
      id: "company_profit",
      summary: "전사 손익 질문",
      directAnswer:
        "전사 순이익·영업이익 집계는 아직 검색 범위에 없습니다. " +
        "상품 단위 마진율·판매액 순위는 바로 답변할 수 있습니다.",
      suggestions: ["마진율이 가장 높은 상품", "매출 TOP 5 상품", "평균 주문 금액"],
    }),
  },
  {
    id: "recommendation",
    test: (q) => /(추천|어떤\s*걸|뭘\s*팔|재고\s*처리|프로모션)/i.test(q),
    build: () => ({
      id: "recommendation",
      summary: "추천·제안 질문",
      directAnswer:
        "상품·고객 추천은 AI 브리핑의 인사이트를 참고해 주세요. " +
        "검색에서는 '재고 부족 상품', '마진율 순위'처럼 조건이 명확한 질문에 답합니다.",
      suggestions: ["재고 부족 삼성 노트북", "마진율이 가장 높은 상품", "재고가 가장 많은 상품"],
    }),
  },
  {
    id: "complex_date",
    test: (q) =>
      /(\d{4}년|\d{1,2}월\s*\d{1,2}일|분기|상반기|하반기|최근\s*\d+\s*개월)/i.test(q) &&
      /(매출|주문|거래|판매)/i.test(q),
    build: (q) => ({
      id: "complex_date",
      summary: "기간 지정 매출·주문",
      directAnswer:
        `"${q.trim()}"처럼 특정 기간을 지정한 질문은 아직 자동 분석이 어렵습니다. ` +
        "대신 '이번 달 매출', '미처리 주문 몇 건', '100만원 이상 주문'처럼 단순 조건으로 검색해 보세요.",
      suggestions: ["이번 달 매출", "미처리 주문", "100만원 이상 주문"],
    }),
  },
];

function matchGuidedIntent(query: string): GuidedIntent | null {
  const q = query.trim();
  if (!q) return null;
  for (const intent of GUIDED_INTENTS) {
    if (intent.test(q)) return intent.build(q);
  }
  return null;
}

function looksLikeAnalyticsQuestion(query: string): boolean {
  const q = query.trim();
  return (
    QUESTION_SIGNAL.test(q) &&
    /(마진|마진율|판매가|가격|재고|원가|상품|고객|거래처|매출|주문|판매|배송|취소|품절|sku)/i.test(q)
  );
}

export async function tryResolveSearchIntent(
  query: string,
  masters: SearchMasters,
): Promise<IntentAnalyticsResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const analyticsSpec = parseAnalyticsQuery(trimmed, {
    brands: masters.brands,
    categories: masters.categories,
    tiers: masters.tiers,
    cities: masters.cities,
  });
  if (analyticsSpec) {
    return runIntentAnalytics(trimmed, analyticsSpec);
  }

  const guided = matchGuidedIntent(trimmed);
  if (guided) {
    return {
      mode: "guided",
      summary: guided.summary,
      directAnswer: guided.directAnswer,
      suggestions: guided.suggestions,
      customers: { data: [], total: 0 },
      products: { data: [], total: 0 },
      orders: { data: [], total: 0 },
      filters: { entities: [], summary: guided.summary },
    };
  }

  return null;
}

async function countPartialMatches(
  filters: ParsedSearchFilters,
  masters: SearchMasters,
): Promise<string[]> {
  const hints: string[] = [];
  const pf = filters.products;

  if (pf?.brand || pf?.category || pf?.lowStock) {
    const brandCount = pf.brand
      ? await prisma.product.count({ where: { brandCode: pf.brand } })
      : null;
    const categoryCount = pf.category
      ? await prisma.product.count({ where: { categoryCode: pf.category } })
      : null;
    const lowStockCount = await prisma.product.count({ where: { stockQty: { lt: 50 } } });

    if (pf.brand && pf.category && pf.lowStock && brandCount !== null && categoryCount !== null) {
      const combo = await prisma.product.count({
        where: { brandCode: pf.brand, categoryCode: pf.category },
      });
      const comboLow = await prisma.product.count({
        where: { brandCode: pf.brand, categoryCode: pf.category, stockQty: { lt: 50 } },
      });
      if (combo > 0 && comboLow === 0) {
        hints.push(
          `${pf.brand} ${pf.category} 상품은 ${combo}개 있지만, 재고 50개 미만은 없습니다.`,
        );
      } else if (brandCount > 0 && combo === 0) {
        hints.push(`${pf.brand} 상품은 ${brandCount}개 있지만, ${pf.category} 카테고리는 없습니다.`);
      }
    } else if (pf.lowStock && lowStockCount === 0) {
      hints.push("현재 재고 50개 미만 상품이 없습니다.");
    } else if (pf.brand && brandCount === 0) {
      hints.push(`'${pf.brand}' 브랜드 상품이 없습니다.`);
    }
  }

  if (filters.customers?.search && looksLikePersonName(filters.customers.search)) {
    const name = filters.customers.search;
    const count = await prisma.customer.count({
      where: { customerName: { contains: name, mode: "insensitive" } },
    });
    if (count === 0) {
      hints.push(`'${name}' 이름의 고객이 없습니다. 회사명·이메일로 검색해 보세요.`);
    }
  }

  if (filters.orders?.minAmount) {
    const count = await prisma.salesOrder.count({
      where: { totalAmountKrw: { gte: filters.orders.minAmount } },
    });
    if (count === 0) {
      hints.push(
        `${Math.round(filters.orders.minAmount / 10_000)}만원 이상 주문이 없습니다. 금액 조건을 낮춰 보세요.`,
      );
    }
  }

  void masters;
  return hints;
}

function looksLikePersonName(query: string): boolean {
  return /^[가-힣]{2,4}$/.test(query.trim());
}

export async function resolveZeroResultGuidance(
  query: string,
  filters: ParsedSearchFilters,
  masters: SearchMasters,
): Promise<ZeroResultGuidance | null> {
  const trimmed = query.trim();

  const partialHints = await countPartialMatches(filters, masters);
  if (partialHints.length > 0) {
    return {
      directAnswer: partialHints.join(" "),
      suggestions: buildSuggestionsFromQuery(trimmed, filters),
    };
  }

  const guided = matchGuidedIntent(trimmed);
  if (guided) {
    return { directAnswer: guided.directAnswer, suggestions: guided.suggestions };
  }

  if (looksLikeAnalyticsQuestion(trimmed)) {
    return {
      directAnswer:
        "질문 형태는 이해했지만, 아직 자동으로 답할 수 없는 분석입니다. " +
        "아래 예시처럼 마진율·매출·재고·주문 건수가 포함된 질문을 시도해 보세요.",
      suggestions: [
        "마진율이 가장 높은 상품",
        "가장 많이 팔린 상품",
        "매출이 가장 많은 고객",
        "미처리 주문 몇 건",
      ],
    };
  }

  if (trimmed) {
    return {
      directAnswer: `"${trimmed}"에 일치하는 고객·상품·주문이 없습니다. 철자를 확인하거나 더 짧은 키워드로 검색해 보세요.`,
      suggestions: buildSuggestionsFromQuery(trimmed, filters),
    };
  }

  return null;
}

function buildSuggestionsFromQuery(query: string, filters: ParsedSearchFilters): string[] {
  const suggestions: string[] = [];
  if (filters.entities.includes("products") || /상품|재고|마진/i.test(query)) {
    suggestions.push("마진율이 가장 높은 상품", "재고 부족 상품");
  }
  if (filters.entities.includes("customers") || /고객|vip/i.test(query)) {
    suggestions.push("서울 VIP 고객", "매출이 가장 많은 고객");
  }
  if (filters.entities.includes("orders") || /주문/i.test(query)) {
    suggestions.push("미처리 주문", "100만원 이상 주문");
  }
  if (suggestions.length === 0) {
    return ["마진율이 가장 높은 상품", "재고 부족 삼성 노트북", "서울 VIP 고객"];
  }
  return [...new Set(suggestions)].slice(0, 4);
}

export const EXAMPLE_QUERIES = [
  "마진율이 가장 높은 상품",
  "가장 많이 팔린 상품",
  "매출이 가장 많은 고객",
  "미처리 주문 몇 건",
  "재고 부족 삼성 노트북",
  "이번 달 매출",
];

export type { AnalyticsSpec };
