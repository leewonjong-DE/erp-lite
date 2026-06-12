"use client";

import dynamic from "next/dynamic";
import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { formatDate, formatKrw } from "@/lib/format";
import Link from "next/link";
import { useEffect, useState } from "react";

const DashboardCharts = dynamic(() => import("@/components/DashboardCharts"), {
  ssr: false,
  loading: () => <p className="text-zinc-500">차트 로딩 중...</p>,
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
    customerName: string;
    orderDate: string;
    daysPending: number;
    amount: number;
  }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (res) => {
        if (!res.ok) throw new Error("대시보드 데이터를 불러오지 못했습니다.");
        return res.json();
      })
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        {error}
      </div>
    );
  }

  if (!data) {
    return <p className="text-zinc-500">대시보드 로딩 중...</p>;
  }

  const { kpis } = data;

  return (
    <div>
      <PageHeader
        title="경영·운영 대시보드"
        description="매출·마진·재고·고객 이탈 등 실무 의사결정 지표 (배송완료·최근월 기준)"
      />

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
            value={kpis.activeCustomers90d.toLocaleString()}
            hint={`최근 90일 주문 / 전체 ${kpis.customerCount.toLocaleString()}`}
          />
          <KpiCard
            label="재고 긴급 SKU"
            value={kpis.lowStockCount.toLocaleString()}
            hint="50개 미만 또는 30일 내 품절 예상"
          />
        </div>
      </section>

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
            <Link
              key={c.customerId}
              href={`/customers`}
              className="font-medium text-blue-600 hover:underline"
            >
              {c.name}
            </Link>,
            c.tier,
            formatKrw(c.revenue),
            `${c.orders}건`,
          ])}
        />

        <DataTable
          title="TOP 10 상품"
          subtitle="배송완료 매출 — 주력 SKU"
          headers={["상품", "카테고리", "수량", "매출"]}
          rows={data.topProducts.map((p) => [
            p.name.length > 24 ? `${p.name.slice(0, 24)}…` : p.name,
            p.category,
            p.qty.toLocaleString(),
            formatKrw(p.revenue),
          ])}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <DataTable
          title="재고 긴급 알림"
          subtitle="발주 검토 필요"
          headers={["상품", "재고", "90일 판매", "품절 예상"]}
          rows={data.stockAlerts.map((p) => [
            p.name.length > 22 ? `${p.name.slice(0, 22)}…` : p.name,
            <span key={p.productId} className="font-medium text-red-600">
              {p.stockQty}
            </span>,
            p.sold90d.toLocaleString(),
            p.daysToStockout !== null ? `${p.daysToStockout}일` : "—",
          ])}
        />

        <DataTable
          title="VIP 이탈 위험"
          subtitle="180일+ 미주문 — 영업팀 follow-up"
          headers={["고객", "미주문 기간"]}
          rows={
            data.vipInactive.length
              ? data.vipInactive.map((c) => [
                  c.name,
                  c.daysSince >= 9999 ? "주문 없음" : `${c.daysSince}일`,
                ])
              : [[<span key="ok" className="text-zinc-500">해당 없음</span>, "—"]]
          }
        />
      </div>

      {data.staleOrders.length > 0 ? (
        <div className="mt-8">
          <DataTable
            title="장기 미처리 주문"
            subtitle="7일+ 주문접수 상태 — 처리 지연"
            headers={["주문번호", "고객", "접수일", "경과", "금액"]}
            rows={data.staleOrders.map((o) => [
              <Link
                key={o.orderNo}
                href={`/orders/${o.orderNo}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {o.orderNo}
              </Link>,
              o.customerName,
              formatDate(o.orderDate),
              `${o.daysPending}일`,
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
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-zinc-500">
              {headers.map((h) => (
                <th key={h} className="pb-2 pr-4 last:pr-0">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-zinc-100 last:border-0">
                {row.map((cell, j) => (
                  <td key={j} className="py-2 pr-4 last:pr-0">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
