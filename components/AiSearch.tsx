"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate, formatKrw } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

type SuggestItem = {
  type: "customer" | "product" | "order";
  label: string;
  sublabel: string;
  value: string;
  customerId?: number;
};

type HomonymInfo = {
  name: string;
  totalCount: number;
  shownCount: number;
  candidates: Array<{ customerId: number; city: string; tier: string; joinDate: string }>;
};

type CustomerReport = {
  customerId: number;
  customerName: string;
  tier: string;
  customerType: string;
  city: string;
  joinDate: string;
  tenureLabel: string;
  orderCount: number;
  completedOrderCount: number;
  completedRevenue: number;
  avgOrderValue: number;
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  topChannel: string | null;
  highlights: string[];
};

type ProductReport = {
  productId: number;
  productName: string;
  brand: string;
  category: string;
  stockQty: number;
  marginPct: number;
  soldQty: number;
  soldRevenue: number;
  highlights: string[];
};

type SearchReports = {
  overview: string;
  customers: CustomerReport[];
  products: ProductReport[];
  orders: {
    orderCount: number;
    totalAmount: number;
    avgAmount: number;
    highlights: string[];
  } | null;
};

type SearchResult = {
  source: "ai" | "rule";
  showApiSetupHint?: boolean;
  query: string;
  summary: string;
  customers: { data: Array<{ customerId: number; customerName: string; tier: string; city: string; rank?: number; revenue?: number; orderCount?: number }>; total: number };
  products: {
    data: Array<{
      productId: number;
      productName: string;
      brand: string;
      stockQty: number;
      unitPriceKrw: number;
      unitCostKrw?: number;
      marginPct?: number;
      rank?: number;
    }>;
    total: number;
  };
  orders: {
    data: Array<{
      orderNo: number;
      orderDate: string;
      status: string;
      channel: string;
      totalAmountKrw: number;
      customer: { customerName: string };
    }>;
    total: number;
  };
  viewAll: { label: string; href: string }[];
  reports: SearchReports;
  relaxedNote?: string;
  homonyms: HomonymInfo | null;
  queryMode?: "filter" | "analytics" | "guided";
  directAnswer?: string;
  suggestions?: string[];
};

const examples = [
  "마진율이 가장 높은 상품",
  "다음 달 예상 매출",
  "다음 달 고객 증가 예측",
  "매출이 가장 많은 고객",
  "미처리 주문 몇 건",
  "재고 부족 삼성 노트북",
];

const typeLabels: Record<SuggestItem["type"], string> = {
  customer: "고객",
  product: "상품",
  order: "주문",
};

export default function AiSearch() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  const runSearch = useCallback(async (text: string, customerId?: number) => {
    const q = text.trim();
    if (!q && !customerId) return;

    setSuggestOpen(false);
    setActiveIndex(-1);
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q || text, customerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "검색에 실패했습니다.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  const selectSuggestion = useCallback(
    (item: SuggestItem) => {
      setQuery(item.value);
      runSearch(item.value, item.type === "customer" ? item.customerId : undefined);
    },
    [runSearch],
  );

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }

    setSuggestLoading(true);
    fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("suggest failed");
        return res.json();
      })
      .then((data: { data: SuggestItem[] }) => {
        setSuggestions(data.data);
        setActiveIndex(-1);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestLoading(false));
  }, [debouncedQuery]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!formRef.current?.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const totalHits =
    (result?.customers.total ?? 0) + (result?.products.total ?? 0) + (result?.orders.total ?? 0);

  const showEmptyState = result && totalHits === 0 && !result.directAnswer;

  const hasReports =
    result &&
    (result.reports.customers.length > 0 ||
      result.reports.products.length > 0 ||
      result.reports.orders);

  return (
    <section className="mb-8 rounded-2xl border border-zinc-200 bg-white px-4 py-8 shadow-sm sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            <span className="text-[#03c75a]">AI</span> 검색
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            고객·상품·주문을 자연어로 검색하세요
            <kbd className="ml-2 hidden rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline">
              Ctrl K
            </kbd>
          </p>
        </div>

        <form
          ref={formRef}
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            if (activeIndex >= 0 && suggestions[activeIndex]) {
              selectSuggestion(suggestions[activeIndex]);
              return;
            }
            runSearch(query);
          }}
        >
          <div className="flex overflow-hidden rounded-lg border-2 border-[#03c75a] shadow-md transition focus-within:shadow-lg">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onKeyDown={(e) => {
                if (!suggestOpen || suggestions.length === 0) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((i) => (i + 1) % suggestions.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                } else if (e.key === "Escape") {
                  setSuggestOpen(false);
                  setActiveIndex(-1);
                }
              }}
              placeholder="검색어를 입력하세요"
              className="min-w-0 flex-1 border-0 bg-white py-3.5 pl-5 text-base outline-none placeholder:text-zinc-400 sm:py-4 sm:text-lg"
              autoComplete="off"
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-autocomplete="list"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex shrink-0 items-center justify-center bg-[#03c75a] px-5 text-white transition hover:bg-[#02b351] disabled:opacity-60 sm:px-7"
              aria-label="검색"
            >
              {loading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </button>
          </div>

          {suggestOpen && query.trim() && (suggestions.length > 0 || suggestLoading) ? (
            <ul
              className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
              role="listbox"
            >
              {suggestLoading && suggestions.length === 0 ? (
                <li className="px-4 py-3 text-sm text-zinc-400">불러오는 중…</li>
              ) : null}
              {suggestions.map((item, index) => (
                <li key={`${item.type}-${item.label}-${index}`} role="option" aria-selected={activeIndex === index}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      activeIndex === index ? "bg-[#03c75a]/10" : "hover:bg-zinc-50"
                    }`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectSuggestion(item)}
                  >
                    <span className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                      {typeLabels[item.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-900">{item.label}</span>
                      <span className="block truncate text-xs text-zinc-500">{item.sublabel}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </form>

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setQuery(ex);
                runSearch(ex);
              }}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-600 transition hover:border-[#03c75a]/40 hover:bg-[#03c75a]/5 hover:text-[#02a84a]"
            >
              {ex}
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

        {result ? (
          <div className="mt-6 space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
            <div className="rounded-lg bg-white px-3 py-2.5 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-[#03c75a] px-2 py-0.5 text-[10px] font-semibold text-white">
                  {result.queryMode === "analytics"
                    ? "분석"
                    : result.queryMode === "guided"
                      ? "안내"
                      : result.source === "ai"
                        ? "AI"
                        : "규칙"}
                </span>
                <p className="text-sm font-medium text-zinc-800">{result.summary}</p>
              </div>
              {result.showApiSetupHint ? (
                <p className="mt-1 text-xs text-zinc-500">
                  GEMINI_API_KEY가 없어 규칙 기반 검색으로 동작합니다.
                </p>
              ) : null}
              <p className="mt-1 text-xs text-zinc-500">
                {result.directAnswer && totalHits === 0
                  ? "검색 결과 대신 아래 답변을 참고하세요"
                  : `총 ${totalHits.toLocaleString()}건 일치`}
              </p>
            </div>

            {result.directAnswer ? (
              <div
                className={`rounded-lg border px-4 py-3 ${
                  result.queryMode === "guided"
                    ? "border-amber-200 bg-amber-50"
                    : "border-[#03c75a]/30 bg-[#03c75a]/10"
                }`}
              >
                <p
                  className={`text-xs font-medium ${
                    result.queryMode === "guided" ? "text-amber-800" : "text-[#02a84a]"
                  }`}
                >
                  {result.queryMode === "guided" ? "안내" : "답변"}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-800">{result.directAnswer}</p>
                {result.suggestions && result.suggestions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {result.suggestions.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => {
                          setQuery(ex);
                          runSearch(ex);
                        }}
                        className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 transition hover:border-[#03c75a]/40 hover:text-[#02a84a]"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {result.relaxedNote ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {result.relaxedNote}
              </p>
            ) : null}

            {result.homonyms ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="text-sm font-medium text-blue-900">
                  &quot;{result.homonyms.name}&quot; 동명이인 {result.homonyms.totalCount}명
                </p>
                <p className="mt-1 text-xs text-blue-800">
                  이름이 같아 구분이 필요합니다. 지역·등급·가입일·고객 ID로 선택하세요.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.homonyms.candidates.map((c) => (
                    <button
                      key={c.customerId}
                      type="button"
                      onClick={() => runSearch(result.homonyms!.name, c.customerId)}
                      className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-left text-xs transition hover:border-[#03c75a] hover:bg-[#03c75a]/5"
                    >
                      <span className="font-medium text-zinc-900">#{c.customerId}</span>
                      <span className="mt-0.5 block text-zinc-600">
                        {c.city} · {c.tier} · 가입 {c.joinDate}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {hasReports ? (
              <section className="rounded-lg border border-[#03c75a]/20 bg-gradient-to-br from-[#03c75a]/5 to-white p-4">
                <h3 className="mb-2 text-sm font-semibold text-zinc-900">요약 보고서</h3>
                <p className="text-sm leading-relaxed text-zinc-700">{result.reports.overview}</p>

                {result.reports.customers.map((report) => (
                  <div
                    key={report.customerId}
                    className="mt-4 rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/customers?customerId=${report.customerId}`}
                            className="text-base font-semibold text-zinc-900 hover:text-[#03c75a] hover:underline"
                          >
                            {report.customerName}
                          </Link>
                          {result.homonyms ? (
                            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                              #{report.customerId}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {report.tier} · {report.customerType} · {report.city}
                          {result.homonyms ? ` · 가입 ${report.joinDate}` : ""}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-right text-xs sm:grid-cols-4">
                        <div>
                          <p className="text-zinc-400">고객 기간</p>
                          <p className="font-medium text-zinc-800">{report.tenureLabel}</p>
                        </div>
                        <div>
                          <p className="text-zinc-400">주문</p>
                          <p className="font-medium text-zinc-800">
                            {report.completedOrderCount}/{report.orderCount}건
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-400">거래액</p>
                          <p className="font-medium text-zinc-800">{formatKrw(report.completedRevenue)}</p>
                        </div>
                        <div>
                          <p className="text-zinc-400">평균 주문</p>
                          <p className="font-medium text-zinc-800">{formatKrw(report.avgOrderValue)}</p>
                        </div>
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs text-zinc-600">
                      {report.highlights.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-[#03c75a]">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    {result.homonyms ? (
                      <button
                        type="button"
                        onClick={() => runSearch(report.customerName, report.customerId)}
                        className="mt-3 text-xs font-medium text-[#03c75a] hover:underline"
                      >
                        이 고객만 검색 →
                      </button>
                    ) : null}
                  </div>
                ))}

                {result.reports.products.map((report) => (
                  <div
                    key={report.productId}
                    className="mt-4 rounded-lg border border-zinc-200 bg-white p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/products?productId=${report.productId}`}
                          className="text-base font-semibold text-zinc-900 hover:text-[#03c75a] hover:underline"
                        >
                          {report.productName}
                        </Link>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {report.brand} · {report.category}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-x-4 text-right text-xs">
                        <div>
                          <p className="text-zinc-400">재고</p>
                          <p className="font-medium text-zinc-800">{report.stockQty.toLocaleString()}개</p>
                        </div>
                        <div>
                          <p className="text-zinc-400">마진</p>
                          <p className="font-medium text-zinc-800">{report.marginPct}%</p>
                        </div>
                        <div>
                          <p className="text-zinc-400">누적 판매</p>
                          <p className="font-medium text-zinc-800">{formatKrw(report.soldRevenue)}</p>
                        </div>
                      </div>
                    </div>
                    <ul className="space-y-1 text-xs text-zinc-600">
                      {report.highlights.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-[#03c75a]">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {result.reports.orders ? (
                  <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
                    <h4 className="mb-2 text-sm font-semibold text-zinc-900">주문 분석</h4>
                    <ul className="space-y-1 text-xs text-zinc-600">
                      {result.reports.orders.highlights.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span className="text-[#03c75a]">·</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {result.customers.total > 0 ? (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {result.queryMode === "analytics" ? "순위" : "고객"} ({result.customers.total.toLocaleString()})
                </h3>
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  {result.customers.data.map((c) => (
                    <li key={c.customerId}>
                      <Link
                        href={`/customers?customerId=${c.customerId}`}
                        className="flex items-center justify-between px-3 py-2.5 text-sm transition hover:bg-zinc-50"
                      >
                        <span className="font-medium text-zinc-900">
                          {"rank" in c && c.rank ? (
                            <span className="mr-2 text-xs font-semibold text-[#03c75a]">{c.rank}위</span>
                          ) : null}
                          {c.customerName}
                          {result.homonyms ? (
                            <span className="ml-2 text-xs font-normal text-zinc-400">#{c.customerId}</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {c.city} · {c.tier}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.products.total > 0 ? (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {result.queryMode === "analytics" ? "순위" : "상품"} ({result.products.total.toLocaleString()})
                </h3>
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  {result.products.data.map((p) => (
                    <li key={p.productId}>
                      <Link
                        href={`/products?productId=${p.productId}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-zinc-50"
                      >
                        <span className="min-w-0 truncate font-medium text-zinc-900">
                          {"rank" in p && p.rank ? (
                            <span className="mr-2 text-xs font-semibold text-[#03c75a]">{p.rank}위</span>
                          ) : null}
                          {p.productName}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {p.brand} · 재고 {p.stockQty}
                          {"marginPct" in p && p.marginPct !== undefined
                            ? ` · 마진 ${p.marginPct}%`
                            : null}
                          {" · "}
                          {formatKrw(p.unitPriceKrw)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.orders.total > 0 ? (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  주문 ({result.orders.total.toLocaleString()})
                </h3>
                <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white">
                  {result.orders.data.map((o) => (
                    <li key={o.orderNo}>
                      <Link
                        href={`/orders/${o.orderNo}`}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition hover:bg-zinc-50"
                      >
                        <span className="font-medium text-zinc-900">
                          #{o.orderNo} {o.customer.customerName}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {formatDate(o.orderDate)} · {o.status} · {formatKrw(o.totalAmountKrw)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {showEmptyState ? (
              <p className="text-center text-sm text-zinc-500">
                일치하는 결과가 없습니다. 다른 표현으로 다시 검색해 보세요.
              </p>
            ) : null}

            {result.viewAll.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-3 border-t border-zinc-200 pt-3">
                {result.viewAll.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-xs font-medium text-[#03c75a] hover:text-[#02a84a] hover:underline"
                  >
                    {link.label} →
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
