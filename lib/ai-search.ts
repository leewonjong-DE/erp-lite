import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import type { AnalyticsSpec } from "@/lib/search-analytics";
import {
  resolveZeroResultGuidance,
  tryResolveSearchIntent,
} from "@/lib/search-intents";
import { buildSearchReports, type HomonymInfo, type SearchReports } from "@/lib/search-reports";
import {
  customerInclude,
  orderListInclude,
  productInclude,
  serializeCustomer,
  serializeOrderListItem,
  serializeProduct,
} from "@/lib/serialize";

const RESULT_LIMIT = 5;

export type SearchEntity = "customers" | "products" | "orders";

export type ParsedSearchFilters = {
  entities: SearchEntity[];
  summary: string;
  customers?: {
    search?: string;
    customerId?: number;
    customerType?: string;
    tier?: string;
    city?: string;
  };
  products?: {
    search?: string;
    category?: string;
    brand?: string;
    status?: string;
    lowStock?: boolean;
  };
  orders?: {
    search?: string;
    customerId?: number;
    status?: string;
    channel?: string;
    minAmount?: number;
  };
};

export type AiSearchResult = {
  source: "ai" | "rule";
  showApiSetupHint?: boolean;
  query: string;
  summary: string;
  filters: ParsedSearchFilters;
  customers: { data: ReturnType<typeof serializeCustomer>[]; total: number };
  products: { data: ReturnType<typeof serializeProduct>[]; total: number };
  orders: { data: ReturnType<typeof serializeOrderListItem>[]; total: number };
  viewAll: { label: string; href: string }[];
  reports: SearchReports;
  relaxedNote?: string;
  homonyms: HomonymInfo | null;
  queryMode: "filter" | "analytics" | "guided";
  directAnswer?: string;
  suggestions?: string[];
  analytics?: AnalyticsSpec;
};

async function getMasterCodes() {
  const [customerTypes, tiers, cities, categories, brands, statuses, orderStatuses, channels] =
    await Promise.all([
      prisma.customerType.findMany({ select: { code: true } }),
      prisma.customerTier.findMany({ select: { code: true } }),
      prisma.city.findMany({ select: { code: true } }),
      prisma.productCategory.findMany({ select: { code: true } }),
      prisma.brand.findMany({ select: { code: true } }),
      prisma.productStatus.findMany({ select: { code: true } }),
      prisma.orderStatus.findMany({ select: { code: true } }),
      prisma.salesChannel.findMany({ select: { code: true } }),
    ]);

  return {
    customerTypes: customerTypes.map((r) => r.code),
    tiers: tiers.map((r) => r.code),
    cities: cities.map((r) => r.code),
    categories: categories.map((r) => r.code),
    brands: brands.map((r) => r.code),
    productStatuses: statuses.map((r) => r.code),
    orderStatuses: orderStatuses.map((r) => r.code),
    channels: channels.map((r) => r.code),
  };
}

const PRODUCT_HINT =
  /상품|재고|sku|품절|노트북|데스크탑|소프트웨어|액세서리|네트워크|모니터|프린터|마우스|키보드|램|ssd|cpu|gpu/i;
const ORDER_HINT = /주문|배송|취소|반품|미처리|처리.?대기|결제/i;
const CUSTOMER_HINT = /고객|거래처|회사|법인|대리점|개인|vip|휴면|연락처|이메일/i;

function hasMeaningfulCustomerFilters(filters?: ParsedSearchFilters["customers"]): boolean {
  return !!(
    filters?.search ||
    filters?.customerId ||
    filters?.customerType ||
    filters?.tier ||
    filters?.city
  );
}

function hasMeaningfulProductFilters(filters?: ParsedSearchFilters["products"]): boolean {
  return !!(
    filters?.search ||
    filters?.category ||
    filters?.brand ||
    filters?.status ||
    filters?.lowStock === true
  );
}

function hasMeaningfulOrderFilters(filters?: ParsedSearchFilters["orders"]): boolean {
  return !!(filters?.search || filters?.customerId || filters?.status || filters?.channel || filters?.minAmount);
}

function looksLikePersonName(query: string): boolean {
  const trimmed = query.trim();
  return /^[가-힣]{2,4}$/.test(trimmed);
}

function inferDefaultEntities(
  query: string,
  masters: Awaited<ReturnType<typeof getMasterCodes>>,
): SearchEntity[] {
  const q = query.trim();
  const hasProductSignal =
    PRODUCT_HINT.test(q) ||
    masters.brands.some((brand) => q.includes(brand)) ||
    masters.categories.some((category) => q.includes(category)) ||
    /재고\s*(부족|긴급|적음)|품절/i.test(q);
  const hasOrderSignal = ORDER_HINT.test(q) || masters.orderStatuses.some((s) => q.includes(s));
  const hasCustomerSignal =
    CUSTOMER_HINT.test(q) ||
    masters.tiers.some((tier) => q.includes(tier)) ||
    masters.customerTypes.some((type) => q.includes(type)) ||
    masters.cities.some((city) => q.includes(city));

  if (looksLikePersonName(q)) {
    return ["customers", "orders"];
  }
  if (hasProductSignal && !hasCustomerSignal && !hasOrderSignal) return ["products"];
  if (hasOrderSignal && !hasProductSignal && !hasCustomerSignal) return ["orders"];
  if (hasCustomerSignal && !hasProductSignal && !hasOrderSignal) return ["customers"];

  const entities: SearchEntity[] = [];
  if (hasCustomerSignal || looksLikePersonName(q)) entities.push("customers");
  if (hasProductSignal) entities.push("products");
  if (hasOrderSignal) entities.push("orders");

  if (entities.length > 0) return entities;
  return ["customers", "orders"];
}

function postProcessFilters(
  query: string,
  filters: ParsedSearchFilters,
  masters: Awaited<ReturnType<typeof getMasterCodes>>,
): ParsedSearchFilters {
  const next: ParsedSearchFilters = {
    ...filters,
    entities: [...filters.entities],
    customers: filters.customers ? { ...filters.customers } : undefined,
    products: filters.products ? { ...filters.products } : undefined,
    orders: filters.orders ? { ...filters.orders } : undefined,
  };

  if (next.products?.lowStock === false) {
    delete next.products.lowStock;
    if (!hasMeaningfulProductFilters(next.products)) next.products = undefined;
  }

  const defaultEntities = inferDefaultEntities(query, masters);
  const personName = looksLikePersonName(query);

  if (personName) {
    next.entities = ["customers", "orders"];
    next.customers = { ...next.customers, search: query };
    next.orders = { ...next.orders, search: query };
    next.products = undefined;
    if (!next.summary || next.summary.includes("통합")) {
      next.summary = `"${query}" 고객 및 주문 검색`;
    }
    return next;
  }

  if (next.entities.includes("customers") && !hasMeaningfulCustomerFilters(next.customers)) {
    next.customers = { search: query };
  }
  if (next.entities.includes("orders") && !hasMeaningfulOrderFilters(next.orders)) {
    next.orders = { search: query };
  }
  if (next.entities.includes("products") && !hasMeaningfulProductFilters(next.products)) {
    if (PRODUCT_HINT.test(query) || masters.brands.some((brand) => query.includes(brand))) {
      next.products = { search: query };
    } else {
      next.products = undefined;
    }
  }

  next.entities = next.entities.filter((entity) => {
    if (entity === "customers") return hasMeaningfulCustomerFilters(next.customers);
    if (entity === "products") return hasMeaningfulProductFilters(next.products);
    return hasMeaningfulOrderFilters(next.orders);
  });

  if (next.entities.length === 0) {
    next.entities = defaultEntities;
    if (next.entities.includes("customers")) next.customers = { search: query };
    if (next.entities.includes("products")) next.products = { search: query };
    if (next.entities.includes("orders")) next.orders = { search: query };
  }

  return next;
}

function buildViewAllLinks(filters: ParsedSearchFilters): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];

  if (filters.entities.includes("customers")) {
    const params = new URLSearchParams();
    if (filters.customers?.customerId) params.set("customerId", String(filters.customers.customerId));
    else if (filters.customers?.search) params.set("search", filters.customers.search);
    if (filters.customers?.customerType) params.set("customerType", filters.customers.customerType);
    if (filters.customers?.tier) params.set("tier", filters.customers.tier);
    const qs = params.toString();
    links.push({
      label: filters.customers?.customerId ? "고객 상세 보기" : "고객 전체 보기",
      href: `/customers${qs ? `?${qs}` : ""}`,
    });
  }

  if (filters.entities.includes("products")) {
    const params = new URLSearchParams();
    if (filters.products?.search) params.set("search", filters.products.search);
    if (filters.products?.category) params.set("category", filters.products.category);
    if (filters.products?.brand) params.set("brand", filters.products.brand);
    if (filters.products?.status) params.set("status", filters.products.status);
    if (filters.products?.lowStock) params.set("lowStock", "true");
    const qs = params.toString();
    links.push({ label: "상품 전체 보기", href: `/products${qs ? `?${qs}` : ""}` });
  }

  if (filters.entities.includes("orders")) {
    const params = new URLSearchParams();
    if (filters.orders?.customerId) params.set("customerId", String(filters.orders.customerId));
    else if (filters.orders?.search) params.set("search", filters.orders.search);
    if (filters.orders?.status) params.set("status", filters.orders.status);
    if (filters.orders?.channel) params.set("channel", filters.orders.channel);
    const qs = params.toString();
    links.push({ label: "주문 전체 보기", href: `/orders${qs ? `?${qs}` : ""}` });
  }

  return links;
}

async function searchCustomers(filters: ParsedSearchFilters["customers"]) {
  const where = {
    ...(filters?.customerId ? { customerId: filters.customerId } : {}),
    ...(filters?.search
      ? {
          OR: [
            { customerName: { contains: filters.search, mode: "insensitive" as const } },
            { city: { name: { contains: filters.search, mode: "insensitive" as const } } },
            { email: { contains: filters.search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(filters?.customerType ? { customerTypeCode: filters.customerType } : {}),
    ...(filters?.tier ? { tierCode: filters.tier } : {}),
    ...(filters?.city ? { city: { name: { contains: filters.city, mode: "insensitive" as const } } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      take: RESULT_LIMIT,
      orderBy: { customerId: "asc" },
      include: customerInclude,
    }),
    prisma.customer.count({ where }),
  ]);

  return { data: rows.map(serializeCustomer), total };
}

async function searchProducts(
  filters: ParsedSearchFilters["products"],
  orderBy: { productId: "asc" } | { stockQty: "asc" } = { productId: "asc" },
) {
  const where = {
    ...(filters?.search
      ? {
          OR: [
            { productName: { contains: filters.search, mode: "insensitive" as const } },
            { brand: { name: { contains: filters.search, mode: "insensitive" as const } } },
            { category: { name: { contains: filters.search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(filters?.category ? { categoryCode: filters.category } : {}),
    ...(filters?.brand ? { brandCode: filters.brand } : {}),
    ...(filters?.status ? { statusCode: filters.status } : {}),
    ...(filters?.lowStock ? { stockQty: { lt: 50 } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: RESULT_LIMIT,
      orderBy,
      include: productInclude,
    }),
    prisma.product.count({ where }),
  ]);

  return { data: rows.map(serializeProduct), total };
}

type ProductSearchOutcome = {
  data: ReturnType<typeof serializeProduct>[];
  total: number;
  relaxed: boolean;
  relaxedNote?: string;
  effectiveFilters?: NonNullable<ParsedSearchFilters["products"]>;
};

async function searchProductsWithFallback(
  filters: ParsedSearchFilters["products"],
): Promise<ProductSearchOutcome> {
  if (!hasMeaningfulProductFilters(filters)) {
    const result = await searchProducts(filters);
    return { ...result, relaxed: false, effectiveFilters: filters };
  }

  const primary = await searchProducts(filters);
  if (primary.total > 0) {
    return { ...primary, relaxed: false, effectiveFilters: filters };
  }

  const brand = filters?.brand;
  const category = filters?.category;
  const label = [brand, category].filter(Boolean).join(" ");

  const fallbacks: Array<{
    filters: NonNullable<ParsedSearchFilters["products"]>;
    note: string;
    orderBy?: { stockQty: "asc" };
  }> = [];

  if (filters?.lowStock && (brand || category)) {
    fallbacks.push({
      filters: { brand, category, status: filters.status, search: filters.search },
      note: `재고 50개 미만${label ? ` ${label}` : ""} 상품이 없습니다. 같은 조건에서 재고가 적은 순으로 표시합니다.`,
      orderBy: { stockQty: "asc" },
    });
  }

  if (filters?.lowStock && brand && category) {
    fallbacks.push({
      filters: { brand, lowStock: true, status: filters.status },
      note: `재고 부족 ${brand} ${category}은 없습니다. 재고 부족 ${brand} 상품을 표시합니다.`,
    });
  }

  if (brand && category) {
    fallbacks.push({
      filters: { brand, category, status: filters.status },
      note: `${brand} ${category} 상품을 재고가 적은 순으로 표시합니다.`,
      orderBy: { stockQty: "asc" },
    });
  }

  if (filters?.search) {
    fallbacks.push({
      filters: { search: filters.search, brand, category, status: filters.status },
      note: `"${filters.search}" 검색 결과를 재고가 적은 순으로 표시합니다.`,
      orderBy: { stockQty: "asc" },
    });
  }

  for (const fallback of fallbacks) {
    const cleaned = cleanOptional(fallback.filters);
    if (!cleaned || !hasMeaningfulProductFilters(cleaned)) continue;

    const result = await searchProducts(cleaned, fallback.orderBy ?? { productId: "asc" });
    if (result.total > 0) {
      return {
        ...result,
        relaxed: true,
        relaxedNote: fallback.note,
        effectiveFilters: cleaned,
      };
    }
  }

  return { ...primary, relaxed: false, effectiveFilters: filters };
}

async function searchOrders(filters: ParsedSearchFilters["orders"]) {
  const search = filters?.search?.trim() ?? "";
  const orderNo = /^\d+$/.test(search) ? Number(search) : null;

  const where = {
    ...(filters?.customerId ? { customerId: filters.customerId } : {}),
    ...(filters?.status ? { statusCode: filters.status } : {}),
    ...(filters?.channel ? { channelCode: filters.channel } : {}),
    ...(filters?.minAmount ? { totalAmountKrw: { gte: filters.minAmount } } : {}),
    ...(search
      ? {
          OR: [
            ...(orderNo ? [{ orderNo }] : []),
            { customer: { customerName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      take: RESULT_LIMIT,
      orderBy: { orderDate: "desc" },
      include: orderListInclude,
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return { data: rows.map(serializeOrderListItem), total };
}

async function detectHomonyms(
  customerRows: ReturnType<typeof serializeCustomer>[],
  customerTotal: number,
  query: string,
): Promise<HomonymInfo | null> {
  if (customerRows.length === 0) return null;

  const nameGroups = new Map<string, ReturnType<typeof serializeCustomer>[]>();
  for (const row of customerRows) {
    const list = nameGroups.get(row.customerName) ?? [];
    list.push(row);
    nameGroups.set(row.customerName, list);
  }

  let targetName: string | null = null;
  for (const [name, rows] of nameGroups) {
    if (rows.length > 1) {
      targetName = name;
      break;
    }
  }

  if (!targetName && looksLikePersonName(query.trim())) {
    const q = query.trim();
    if (customerRows.some((r) => r.customerName === q)) {
      targetName = q;
    }
  }

  if (!targetName) return null;

  const allSameName = await prisma.customer.findMany({
    where: { customerName: { equals: targetName, mode: "insensitive" } },
    orderBy: { customerId: "asc" },
    include: { city: true, tier: true },
  });

  if (allSameName.length < 2) return null;

  return {
    name: targetName,
    totalCount: allSameName.length,
    shownCount: customerRows.filter((r) => r.customerName === targetName).length,
    candidates: allSameName.map((c) => ({
      customerId: c.customerId,
      city: c.city.name,
      tier: c.tier.name,
      joinDate: c.joinDate.toISOString().slice(0, 10),
    })),
  };
}

async function buildCustomerIdFilters(customerId: number): Promise<ParsedSearchFilters | null> {
  const customer = await prisma.customer.findUnique({
    where: { customerId },
    include: customerInclude,
  });
  if (!customer) return null;

  return {
    entities: ["customers", "orders"],
    summary: `${customer.customerName} 고객 (ID ${customer.customerId} · ${customer.city.name})`,
    customers: { customerId },
    orders: { customerId },
  };
}

function parseRuleBasedQuery(query: string, masters: Awaited<ReturnType<typeof getMasterCodes>>): ParsedSearchFilters {
  const q = query.trim();
  const lower = q.toLowerCase();
  const entities = new Set<SearchEntity>();
  const customers: ParsedSearchFilters["customers"] = {};
  const products: ParsedSearchFilters["products"] = {};
  const orders: ParsedSearchFilters["orders"] = {};
  let summary = `"${q}" 검색 결과`;

  const matchCode = (text: string, codes: string[]) =>
    codes.find((code) => text.includes(code.toLowerCase()) || text.includes(code));

  if (/(고객|거래처|vip|휴면|대리점|법인|개인)/i.test(q)) entities.add("customers");
  if (/(상품|재고|sku|품절|노트북|데스크탑|소프트웨어|액세서리)/i.test(q)) entities.add("products");
  if (/(주문|배송|취소|반품|미처리|처리.?대기)/i.test(q)) entities.add("orders");

  for (const tier of masters.tiers) {
    if (q.includes(tier)) {
      customers.tier = tier;
      entities.add("customers");
    }
  }
  for (const type of masters.customerTypes) {
    if (q.includes(type)) {
      customers.customerType = type;
      entities.add("customers");
    }
  }
  for (const city of masters.cities) {
    if (q.includes(city)) {
      customers.city = city;
      entities.add("customers");
    }
  }
  for (const brand of masters.brands) {
    if (q.includes(brand)) {
      products.brand = brand;
      entities.add("products");
    }
  }
  for (const category of masters.categories) {
    if (q.includes(category)) {
      products.category = category;
      entities.add("products");
    }
  }

  if (/재고\s*(부족|긴급|적음)|품절|low\s*stock/i.test(q)) {
    products.lowStock = true;
    entities.add("products");
    summary = "재고 50개 미만 상품";
  }

  const orderStatus = matchCode(lower, masters.orderStatuses);
  if (orderStatus) {
    orders.status = orderStatus;
    entities.add("orders");
  } else if (/처리.?대기|미처리|주문접수/.test(q)) {
    orders.status = "주문접수";
    entities.add("orders");
  } else if (/배송/.test(q)) {
    orders.status = "배송중";
    entities.add("orders");
  } else if (/취소/.test(q)) {
    orders.status = "취소";
    entities.add("orders");
  }

  const channel = matchCode(q, masters.channels);
  if (channel) {
    orders.channel = channel;
    entities.add("orders");
  }

  const amountMatch = q.match(/(\d+)\s*만\s*원?/);
  if (amountMatch) {
    orders.minAmount = Number(amountMatch[1]) * 10_000;
    entities.add("orders");
  }

  const residual = q
    .replace(/고객|거래처|상품|재고|주문|배송|취소|반품|미처리|처리\s*대기|품절|검색|찾|보여|줘|알려/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (residual) {
    if (entities.has("customers") && !entities.has("products") && !entities.has("orders")) {
      customers.search = residual;
    } else if (entities.has("products") && !entities.has("customers") && !entities.has("orders")) {
      products.search = residual;
    } else if (entities.has("orders") && !entities.has("customers") && !entities.has("products")) {
      orders.search = residual;
    } else if (entities.size === 0) {
      for (const entity of inferDefaultEntities(residual || q, masters)) {
        entities.add(entity);
      }
      if (entities.has("customers")) customers.search = residual || q;
      if (entities.has("products")) products.search = residual || q;
      if (entities.has("orders")) orders.search = residual || q;
    } else {
      if (entities.has("customers")) customers.search = residual;
      if (entities.has("products")) products.search = residual;
      if (entities.has("orders")) orders.search = residual;
    }
  }

  if (entities.size === 0) {
    for (const entity of inferDefaultEntities(q, masters)) {
      entities.add(entity);
    }
    if (q) {
      if (entities.has("customers")) customers.search = q;
      if (entities.has("products")) products.search = q;
      if (entities.has("orders")) orders.search = q;
    }
    summary = q
      ? looksLikePersonName(q)
        ? `"${q}" 고객 및 주문 검색`
        : `"${q}" 검색`
      : "최근 데이터 미리보기";
  }

  return {
    entities: [...entities],
    summary,
    ...(Object.keys(customers).length ? { customers } : {}),
    ...(Object.keys(products).length ? { products } : {}),
    ...(Object.keys(orders).length ? { orders } : {}),
  };
}

async function parseGeminiQuery(
  query: string,
  masters: Awaited<ReturnType<typeof getMasterCodes>>,
): Promise<ParsedSearchFilters> {
  const apiKey =
    process.env.GEMINI_API_KEY ?? process.env.JEM_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const prompt = `당신은 IT B2B 유통 ERP의 자연어 검색 파서입니다.
사용자 질문을 구조화된 검색 필터 JSON으로 변환하세요.

규칙:
- 반드시 한국어 summary 작성
- 코드 값은 아래 마스터 목록에 있는 값만 사용 (없으면 null/생략)
- entities: 검색할 대상 배열 — "customers", "products", "orders" 중 필요한 것만
- 인명·고객명(예: 안우진, 해성상사)만 있으면 entities는 ["customers","orders"]만 — products 절대 포함 금지
- 상품·브랜드·재고·카테고리 키워드가 있을 때만 products 포함
- 주문·배송·취소·채널 키워드가 있거나 고객명+주문 맥락일 때 orders 포함
- 불명확해도 3개 모두 넣지 말 것. 최대 2개까지 우선 좁혀서 선택
- lowStock: 재고 50개 미만일 때만 true (false 출력 금지)
- minAmount: 원(KRW) 단위 정수 (예: 100만원 → 1000000)

마스터 코드:
${JSON.stringify(masters)}

응답 JSON 스키마:
{
  "entities": ["customers"|"products"|"orders"],
  "summary": "검색 의도 한 줄 요약",
  "customers": { "search": "문자열|null", "customerType": "코드|null", "tier": "코드|null", "city": "도시명|null" },
  "products": { "search": "문자열|null", "category": "코드|null", "brand": "코드|null", "status": "코드|null", "lowStock": boolean },
  "orders": { "search": "주문번호 또는 고객명|null", "status": "코드|null", "channel": "코드|null", "minAmount": number|null }
}

사용자 질문: ${query}`;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const text = response.text;
  if (!text) throw new Error("Gemini returned empty response");

  const parsed = JSON.parse(text) as ParsedSearchFilters;
  const entities = (parsed.entities ?? ["customers", "products", "orders"]).filter((e) =>
    ["customers", "products", "orders"].includes(e),
  ) as SearchEntity[];

  return {
    entities: entities.length ? entities : ["customers", "products", "orders"],
    summary: parsed.summary || `"${query}" 검색`,
    customers: cleanOptional(parsed.customers),
    products: cleanOptional(parsed.products),
    orders: cleanOptional(parsed.orders),
  };
}

function cleanOptional<T extends Record<string, unknown>>(obj?: T): T | undefined {
  if (!obj) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(obj).filter(([key, v]) => {
      if (v === null || v === undefined || v === "") return false;
      if (key === "lowStock" && v === false) return false;
      return true;
    }),
  ) as T;
  return Object.keys(cleaned).length ? cleaned : undefined;
}

export async function runAiSearch(
  query: string,
  options?: { customerId?: number },
): Promise<AiSearchResult> {
  const trimmed = query.trim();
  if (!trimmed && !options?.customerId) {
    throw new Error("검색어를 입력해 주세요.");
  }

  const masters = await getMasterCodes();
  const intentMasters = {
    brands: masters.brands,
    categories: masters.categories,
    tiers: masters.tiers,
    cities: masters.cities,
    orderStatuses: masters.orderStatuses,
  };

  if (!options?.customerId) {
    const intentResult = await tryResolveSearchIntent(trimmed, intentMasters);
    if (intentResult) {
      const { customers, products, orders, filters, mode, summary, directAnswer, suggestions, analytics } =
        intentResult;
      const productIds = products.data.map((p) => p.productId);
      const customerIds = customers.data.map((c) => c.customerId);
      const orderNos = orders.data.map((o) => o.orderNo);
      const totalHits = customers.total + products.total + orders.total;
      const reports = await buildSearchReports(
        filters,
        customerIds,
        productIds,
        orderNos,
        orders.total,
        totalHits,
        null,
      );

      return {
        source: "rule",
        query: trimmed,
        summary,
        filters,
        customers,
        products,
        orders,
        viewAll: buildViewAllLinks(filters),
        reports,
        homonyms: null,
        queryMode: mode,
        directAnswer,
        suggestions,
        analytics,
      };
    }
  }

  let source: "ai" | "rule" = "rule";
  let showApiSetupHint = false;
  let filters: ParsedSearchFilters;

  if (options?.customerId) {
    const idFilters = await buildCustomerIdFilters(options.customerId);
    if (!idFilters) {
      throw new Error("고객을 찾을 수 없습니다.");
    }
    filters = idFilters;
  } else {
    try {
      filters = await parseGeminiQuery(trimmed, masters);
      source = "ai";
    } catch (err) {
      if (err instanceof Error && err.message === "API_KEY_MISSING") {
        showApiSetupHint = true;
      } else {
        console.error("AI search fallback:", err);
      }
      filters = parseRuleBasedQuery(trimmed, masters);
    }
    filters = postProcessFilters(trimmed, filters, masters);
  }

  const emptyProductOutcome = (): ProductSearchOutcome => ({
    data: [],
    total: 0,
    relaxed: false,
  });

  const [customers, productOutcome, orders] = await Promise.all([
    filters.entities.includes("customers")
      ? searchCustomers(filters.customers)
      : Promise.resolve({ data: [], total: 0 }),
    filters.entities.includes("products")
      ? searchProductsWithFallback(filters.products)
      : Promise.resolve(emptyProductOutcome()),
    filters.entities.includes("orders")
      ? searchOrders(filters.orders)
      : Promise.resolve({ data: [], total: 0 }),
  ]);

  const products = { data: productOutcome.data, total: productOutcome.total };
  const viewAllFilters: ParsedSearchFilters = {
    ...filters,
    ...(productOutcome.effectiveFilters ? { products: productOutcome.effectiveFilters } : {}),
  };

  const homonyms =
    options?.customerId ? null : await detectHomonyms(customers.data, customers.total, trimmed);

  const totalHits = customers.total + products.total + orders.total;

  let directAnswer: string | undefined;
  let suggestions: string[] | undefined;
  let queryMode: AiSearchResult["queryMode"] = "filter";

  if (totalHits === 0 && !options?.customerId) {
    const guidance = await resolveZeroResultGuidance(trimmed, filters, intentMasters);
    if (guidance) {
      directAnswer = guidance.directAnswer;
      suggestions = guidance.suggestions;
      queryMode = "guided";
    }
  }

  const reports = await buildSearchReports(
    filters,
    customers.data.map((c) => c.customerId),
    products.data.map((p) => p.productId),
    orders.data.map((o) => o.orderNo),
    orders.total,
    totalHits,
    homonyms,
  );

  return {
    source,
    showApiSetupHint,
    query: trimmed,
    summary: productOutcome.relaxedNote ?? filters.summary,
    filters,
    customers,
    products,
    orders,
    viewAll: buildViewAllLinks(viewAllFilters),
    reports,
    relaxedNote: productOutcome.relaxedNote,
    homonyms,
    queryMode,
    directAnswer,
    suggestions,
  };
}
