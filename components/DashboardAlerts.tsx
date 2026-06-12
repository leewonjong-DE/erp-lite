"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CustomerLink, OrderLink, ProductLink } from "@/components/EntityLink";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, formatKrw } from "@/lib/format";
import type { DashboardAlertId } from "@/lib/get-dashboard-data";
import { ORDER_STATUS_SLAS, slaNote, type OrderPipelineStat } from "@/lib/order-sla";

type AlertItem = {
  id: DashboardAlertId;
  level: "warning" | "info";
  title: string;
  message: string;
};

export type DashboardAlertsData = {
  kpis: { pendingOrderCount: number; pendingOrderAmount: number; lowStockCount: number };
  orderPipeline: {
    stats: OrderPipelineStat[];
    overdueOrders: Array<{
      orderNo: number;
      customerId: number;
      customerName: string;
      orderDate: string;
      status: string;
      amount: number;
      daysSinceOrder: number;
      overdueDays: number;
      severity: "overdue" | "critical";
    }>;
  };
  stockAlerts: Array<{
    productId: number;
    name: string;
    category: string;
    stockQty: number;
    sold90d: number;
    daysToStockout: number | null;
  }>;
  vipInactive: Array<{ customerId: number; name: string; daysSince: number }>;
  staleOrders: Array<{
    orderNo: number;
    customerId: number;
    customerName: string;
    orderDate: string;
    daysPending: number;
    amount: number;
  }>;
  newCustomerMonitoring: {
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

export default function DashboardAlerts({
  alerts,
  data,
}: {
  alerts: AlertItem[];
  data: DashboardAlertsData;
}) {
  const [selectedId, setSelectedId] = useState<DashboardAlertId | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedId]);

  if (alerts.length === 0) return null;

  const selected = alerts.find((a) => a.id === selectedId);

  return (
    <>
      <div className="mb-6 space-y-2">
        <p className="text-xs text-zinc-500">운영 알림 — 클릭하면 상태별 지연 목록을 바로 확인할 수 있습니다.</p>
        {alerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            onClick={() => setSelectedId(alert.id)}
            className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition hover:shadow-sm ${
              alert.level === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300 hover:bg-amber-100/80"
                : "border-blue-200 bg-blue-50 text-blue-900 hover:border-blue-300 hover:bg-blue-100/80"
            }`}
          >
            <span>
              <span className="font-semibold">{alert.title}</span>
              <span className="mx-2">·</span>
              {alert.message}
            </span>
            <svg
              className="h-4 w-4 shrink-0 opacity-60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {selected && selectedId ? (
        <AlertDetailModal alert={selected} data={data} onClose={() => setSelectedId(null)} />
      ) : null}
    </>
  );
}

function AlertDetailModal({
  alert,
  data,
  onClose,
}: {
  alert: AlertItem;
  data: DashboardAlertsData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="닫기" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-zinc-100 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">운영 알림</p>
              <h4 id="alert-modal-title" className="mt-1 text-base font-semibold text-zinc-900 sm:text-lg">
                {alert.title}
              </h4>
              <p className="mt-1 text-sm text-zinc-600">{alert.message}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
              aria-label="닫기"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {alert.id === "order_pipeline" ? <OrderPipelineDetail data={data} /> : null}
          {alert.id === "low_stock" ? <LowStockDetail data={data} /> : null}
          {alert.id === "vip_inactive" ? <VipInactiveDetail data={data} /> : null}
          {alert.id === "new_customer" ? <NewCustomerDetail data={data} /> : null}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-zinc-50 px-5 py-3 sm:px-6">
          <ModalFooterLink alertId={alert.id} />
        </div>
      </div>
    </div>
  );
}

function OrderPipelineDetail({ data }: { data: DashboardAlertsData }) {
  const totalOverdue = data.orderPipeline.stats.reduce((s, p) => s + p.overdue, 0);

  return (
    <div className="space-y-5">
      <p className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-600">
        {slaNote()}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricBox
          label="파이프라인 전체"
          value={`${data.kpis.pendingOrderCount.toLocaleString()}건`}
          hint={formatKrw(data.kpis.pendingOrderAmount)}
        />
        <MetricBox label="기준 초과(지연)" value={`${totalOverdue.toLocaleString()}건`} />
        <MetricBox label="상태 단계" value="3단계" hint="접수 → 결제 → 배송" />
      </div>

      {ORDER_STATUS_SLAS.map((sla) => {
        const stat = data.orderPipeline.stats.find((s) => s.status === sla.status);
        const orders = data.orderPipeline.overdueOrders.filter((o) => o.status === sla.status);

        return (
          <section key={sla.status} className="rounded-lg border border-zinc-200">
            <div className="border-b border-zinc-100 bg-zinc-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge label={sla.label} />
                  <span className="text-xs text-zinc-500">
                    기준: 접수 후 {sla.overdueFromOrderDays}일+
                    {sla.criticalFromOrderDays ? ` · 장기 ${sla.criticalFromOrderDays}일+` : ""}
                  </span>
                </div>
                {stat ? (
                  <span className="text-xs text-zinc-600">
                    전체 {stat.total.toLocaleString()}건 · 지연 {stat.overdue.toLocaleString()}건
                    {stat.critical > 0 ? ` (장기 ${stat.critical}건)` : ""}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-zinc-500">{sla.description}</p>
              <p className="mt-0.5 text-xs font-medium text-[#02a84a]">→ {sla.actionHint}</p>
            </div>

            {stat && stat.overdue > 0 ? (
              orders.length > 0 ? (
                <>
                  <ul className="divide-y divide-zinc-100">
                    {orders.map((o) => (
                      <li
                        key={o.orderNo}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0">
                          <OrderLink orderNo={o.orderNo}>#{o.orderNo}</OrderLink>
                          <span className="mx-1.5 text-zinc-300">·</span>
                          <CustomerLink customerId={o.customerId}>{o.customerName}</CustomerLink>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-xs">
                          <span className="text-zinc-500">{formatDate(o.orderDate)}</span>
                          <span
                            className={
                              o.severity === "critical"
                                ? "font-medium text-red-700"
                                : "font-medium text-amber-700"
                            }
                          >
                            접수 후 {o.daysSinceOrder}일
                            {o.overdueDays > 0 ? ` (+${o.overdueDays}일)` : ""}
                          </span>
                          {o.severity === "critical" ? (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-800">
                              장기
                            </span>
                          ) : null}
                          <span className="font-medium text-zinc-800">{formatKrw(o.amount)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {stat.overdue > orders.length ? (
                    <p className="border-t border-zinc-100 px-3 py-2 text-center text-xs text-zinc-500">
                      상위 {orders.length}건만 표시 · 외 {stat.overdue - orders.length}건
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="px-3 py-4 text-center text-xs text-amber-700">
                  지연 {stat.overdue.toLocaleString()}건 — 목록을 불러오지 못했습니다
                </p>
              )
            ) : (
              <p className="px-3 py-4 text-center text-xs text-emerald-600">기준 내 — 지연 없음</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LowStockDetail({ data }: { data: DashboardAlertsData }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <MetricBox label="긴급 SKU" value={`${data.stockAlerts.length}개`} />
        <MetricBox label="재고 50 미만 전체" value={`${data.kpis.lowStockCount}개`} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-zinc-500">
              <th className="pb-2 pr-3 font-medium">상품</th>
              <th className="pb-2 pr-3 font-medium">카테고리</th>
              <th className="pb-2 pr-3 font-medium">재고</th>
              <th className="pb-2 pr-3 font-medium">90일 판매</th>
              <th className="pb-2 font-medium">품절 예상</th>
            </tr>
          </thead>
          <tbody>
            {data.stockAlerts.map((p) => (
              <tr key={p.productId} className="border-b border-zinc-100 last:border-0">
                <td className="py-2 pr-3">
                  <ProductLink productId={p.productId}>{p.name}</ProductLink>
                </td>
                <td className="py-2 pr-3 text-zinc-600">{p.category}</td>
                <td className="py-2 pr-3 font-medium text-red-600">{p.stockQty}개</td>
                <td className="py-2 pr-3 text-zinc-600">{p.sold90d.toLocaleString()}개</td>
                <td className="py-2 text-zinc-600">
                  {p.daysToStockout !== null ? `${p.daysToStockout}일` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VipInactiveDetail({ data }: { data: DashboardAlertsData }) {
  return (
    <div className="space-y-4">
      <MetricBox label="180일+ 미주문 VIP" value={`${data.vipInactive.length}명`} />
      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {data.vipInactive.map((c) => (
          <li key={c.customerId} className="flex items-center justify-between px-3 py-2.5 text-sm">
            <CustomerLink customerId={c.customerId}>
              {c.name}
              <span className="ml-2 text-xs font-normal text-zinc-400">#{c.customerId}</span>
            </CustomerLink>
            <span className="text-zinc-600">
              {c.daysSince >= 9999 ? "주문 없음" : `${c.daysSince}일 미주문`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewCustomerDetail({ data }: { data: DashboardAlertsData }) {
  const list = data.newCustomerMonitoring.watchlist;
  return (
    <div className="space-y-4">
      <MetricBox label="관리 필요" value={`${list.length}명`} hint="미주문·재구매 대기" />
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-zinc-500">
              <th className="pb-2 pr-3 font-medium">고객</th>
              <th className="pb-2 pr-3 font-medium">등급</th>
              <th className="pb-2 pr-3 font-medium">상태</th>
              <th className="pb-2 pr-3 font-medium">주문</th>
              <th className="pb-2 font-medium">권장 조치</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.customerId} className="border-b border-zinc-100 last:border-0">
                <td className="py-2 pr-3">
                  <CustomerLink customerId={c.customerId}>{c.name}</CustomerLink>
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge label={c.tier} />
                </td>
                <td className="py-2 pr-3">
                  <StatusBadge label={c.status} />
                </td>
                <td className="py-2 pr-3 text-zinc-600">{c.orderCount}건</td>
                <td className="py-2 text-xs text-zinc-600">
                  {c.status === "미주문" ? "웰컴 콜·첫 구매 제안" : "재구매 제안·관계 점검"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MetricBox({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-zinc-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-zinc-400">{hint}</p> : null}
    </div>
  );
}

function ModalFooterLink({ alertId }: { alertId: DashboardAlertId }) {
  const links: Record<DashboardAlertId, { href: string; label: string }> = {
    order_pipeline: { href: "/orders", label: "주문 관리에서 처리" },
    low_stock: { href: "/products?lowStock=true", label: "재고 부족 상품 전체 보기" },
    vip_inactive: { href: "/customers?tier=VIP", label: "VIP 고객 목록 보기" },
    new_customer: { href: "/customers", label: "고객 관리에서 보기" },
  };
  const link = links[alertId];
  return (
    <Link
      href={link.href}
      className="text-sm font-medium text-[#03c75a] hover:text-[#02a84a] hover:underline"
    >
      {link.label} →
    </Link>
  );
}
