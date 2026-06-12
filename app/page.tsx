"use client";

import dynamic from "next/dynamic";
import AiInsights from "@/components/AiInsights";
import AiSearch from "@/components/AiSearch";
import KpiCard from "@/components/KpiCard";
import NewCustomerMonitor from "@/components/NewCustomerMonitor";
import { CustomerLink, OrderLink, ProductLink } from "@/components/EntityLink";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { DashboardSkeleton } from "@/components/Skeleton";
import { formatDate, formatKrw } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

const DashboardCharts = dynamic(() => import("@/components/DashboardCharts"), {
  ssr: false,
  loading: () => (
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      <div className="h-[320px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
      <div className="h-[320px] animate-pulse rounded-xl border border-zinc-200 bg-white" />
    </div>
  ),
});

type DashboardData = {
  kpis: {
    referenceMonth: string;
    monthRevenue: number;
    monthChangePct: number | null;
    totalRevenue: number;
    pendingOrderCount: number;
    pendingOrderAmount: number;
    avgOrderValue: number;
    grossMarginPct: number;
    cancelReturnRate: number;
    activeCustomers90d: number;
    customerCount: number;
    lowStockCount: number;
    completedOrders: number;
  };
  alerts: Array<{ level: "warning" | "info"; title: string; message: string }>;
  statusCounts: Array<{ status: string; count: number; amount: number }>;
  channelRevenue: Array<{ channel: string; revenue: number }>;
  categoryMargin: Array<{ category: string; revenue: number; marginPct: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  paymentMix: Array<{ method: string; revenue: number; count: number }>;
  tierRevenue: Array<{ tier: string; revenue: number; customers: number }>;
  topCustomers: Array<{
    customerId: number;
    name: string;
    tier: string;
    revenue: number;
    orders: number;
  }>;
  topProducts: Array<{
    productId: number;
    name: string;
    category: string;
    qty: number;
    revenue: number;
  }>;
  stockAlerts: Array<{
    productId: number;
    name: string;
    category: string;
    stockQty: number;
    sold90d: number;
    daysToStockout: number | null;
  }>;
  vipInactive: Array<{
    customerId: number;
    name: string;
    daysSince: number;
  }>;
  staleOrders: Array<{
    orderNo: number;
    customerId: number;
    customerName: string;
    orderDate: string;
    daysPending: number;
    amount: number;
  }>;
  newCustomerMonitoring: {
    total90d: number;
    noOrder: number;
    oneOrderRisk: number;
    firstBuy: number;
    repeat: number;
    repeatRate: number;
    watchlist: Array<{
      customerId: number;
      name: string;
      tier: string;
      joinDate: string;
      daysSinceJoin: number;
      orderCount: number;
      status: string;
      idleDays: number | null;
      lastOrderDate: string | null;
    }>;
  };
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("대시보드 데이터를 불러오지 못했습니다.");
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div>
        <AiSearch />
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center">
          <p className="text-red-700">{error}</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            onClick={() => load()}
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  if (!data && loading) {
    return (
      <div>
        <AiSearch />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!data) return <AiSearch />;

  const { kpis } = data;

  return (
    <div>
      <AiSearch />
      <PageHeader
        title="경영·운영 대시보드"
        description="매출·마진·재고·고객 이탈 등 실무 의사결정 지표 (배송완료·최근월 기준)"
        action={
          <button
            type="button"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-50 disabled:opacity-50"
            disabled={refreshing}
            onClick={() => load(true)}
          >
            {refreshing ? "새로고침 중…" : "새로고침"}
          </button>
        }
      />

      <AiInsights />

      {data.alerts.length > 0 ? (
        <div className="mb-6 space-y-2">
          {data.alerts.map((alert) => (
            <div
              key={alert.title}
              className={`rounded-lg border px-4 py-3 text-sm ${
                alert.level === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
              }`}
            >
              <span className="font-semibold">{alert.title}</span>
              <span className="mx-2">·</span>
              {alert.message}
            </div>
          ))}
        </div>
      ) : null}

      <section>
        <h3 className="mb-3 text-sm font-medium text-zinc-500">매출·수익성</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={`${kpis.referenceMonth} 매출`}
            value={formatKrw(kpis.monthRevenue)}
            trend={
              kpis.monthChangePct !== null
                ? {
                    text: `전월 대비 ${kpis.monthChangePct > 0 ? "+" : ""}${kpis.monthChangePct}%`,
                    positive: kpis.monthChangePct > 0,
                  }
                : undefined
            }
          />
          <KpiCard label="누적 매출" value={formatKrw(kpis.totalRevenue)} hint="취소·반품 제외" />
          <KpiCard
            label="평균 객단가"
            value={formatKrw(kpis.avgOrderValue)}
            hint={`배송완료 ${kpis.completedOrders.toLocaleString()}건`}
          />
          <KpiCard
            label="총 마진율"
            value={`${kpis.grossMarginPct}%`}
            hint="매출 − 원가 / 매출 (배송완료)"
          />
        </div>
      </section>

      <section className="mt-6">
        <h3 className="mb-3 text-sm font-medium text-zinc-500">운영·리스크</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="처리 대기"
            value={`${kpis.pendingOrderCount}건`}
            hint={formatKrw(kpis.pendingOrderAmount)}
          />
          <KpiCard
            label="취소·반품율"
            value={`${kpis.cancelReturnRate}%`}
            trend={{
              text: kpis.cancelReturnRate > 10 ? "개선 필요" : "양호",
              positive: kpis.cancelReturnRate <= 10,
            }}
          />
          <KpiCard
            label="활성 고객"
            value={`${kpis.activeCustomers90d.toLocaleString()}명`}
            hint={`최근 90일 주문 / 전체 ${kpis.customerCount.toLocaleString()}명`}
          />
          <KpiCard
            label="재고 긴급 SKU"
            value={`${kpis.lowStockCount.toLocaleString()}개`}
            hint="50개 미만 또는 30일 내 품절 예상"
          />
        </div>
      </section>

      <NewCustomerMonitor data={data.newCustomerMonitoring} />

      <DashboardCharts
        channelRevenue={data.channelRevenue}
        categoryMargin={data.categoryMargin}
        monthlyRevenue={data.monthlyRevenue}
        statusCounts={data.statusCounts}
        paymentMix={data.paymentMix}
        tierRevenue={data.tierRevenue}
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="TOP 10 고객"
          subtitle="배송완료 매출 — Key Account 관리"
          headers={["고객", "등급", "매출", "주문"]}
          rows={data.topCustomers.map((c) => [
            <CustomerLink key={c.customerId} customerId={c.customerId}>
              {c.name}
            </CustomerLink>,
            <StatusBadge key={`t-${c.customerId}`} label={c.tier} />,
            formatKrw(c.revenue),
            `${c.orders}건`,
          ])}
        />

        <DataTable
          title="TOP 10 상품"
          subtitle="배송완료 매출 — 주력 SKU"
          headers={["상품", "카테고리", "수량", "매출"]}
          rows={data.topProducts.map((p) => [
            <ProductLink key={p.productId} productId={p.productId}>
              {p.name.length > 24 ? `${p.name.slice(0, 24)}…` : p.name}
            </ProductLink>,
            p.category,
            `${p.qty.toLocaleString()}개`,
            formatKrw(p.revenue),
          ])}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="재고 긴급 알림"
          subtitle="발주 검토 필요"
          headers={["상품", "재고", "90일 판매", "품절 예상"]}
          emptyMessage="긴급 재고 SKU 없음"
          rows={data.stockAlerts.map((p) => [
            <ProductLink key={p.productId} productId={p.productId}>
              {p.name.length > 22 ? `${p.name.slice(0, 22)}…` : p.name}
            </ProductLink>,
            <span key={`s-${p.productId}`} className="font-medium text-red-600">
              {p.stockQty}개
            </span>,
            `${p.sold90d.toLocaleString()}개`,
            p.daysToStockout !== null ? (
              <span className="font-medium text-amber-700">{p.daysToStockout}일</span>
            ) : (
              "—"
            ),
          ])}
        />

        <DataTable
          title="VIP 이탈 위험"
          subtitle="180일+ 미주문 — 영업팀 follow-up"
          headers={["고객", "미주문 기간"]}
          emptyMessage="이탈 위험 VIP 없음"
          rows={data.vipInactive.map((c) => [
            <CustomerLink key={c.customerId} customerId={c.customerId}>
              {c.name}
            </CustomerLink>,
            c.daysSince >= 9999 ? "주문 없음" : `${c.daysSince}일`,
          ])}
        />
      </div>

      {data.staleOrders.length > 0 ? (
        <div className="mt-8">
          <DataTable
            title="장기 미처리 주문"
            subtitle="7일+ 주문접수 상태 — 처리 지연"
            headers={["주문번호", "고객", "접수일", "경과", "금액"]}
            rows={data.staleOrders.map((o) => [
              <OrderLink key={o.orderNo} orderNo={o.orderNo}>
                {o.orderNo}
              </OrderLink>,
              <CustomerLink key={`c-${o.orderNo}`} customerId={o.customerId}>
                {o.customerName}
              </CustomerLink>,
              formatDate(o.orderDate),
              <span key={`d-${o.orderNo}`} className="font-medium text-amber-700">
                {o.daysPending}일
              </span>,
              formatKrw(o.amount),
            ])}
          />
        </div>
      ) : null}
    </div>
  );
}

function DataTable({
  title,
  subtitle,
  headers,
  rows,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: React.ReactNode[][];
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
      <div className="mt-4 overflow-x-auto">
        {rows.length === 0 && emptyMessage ? (
          <p className="py-8 text-center text-sm text-zinc-500">{emptyMessage}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-zinc-500">
                {headers.map((h) => (
                  <th key={h} className="pb-2 pr-4 font-medium last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-zinc-100 transition last:border-0 hover:bg-zinc-50">
                  {row.map((cell, j) => (
                    <td key={j} className="py-2.5 pr-4 last:pr-0">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
