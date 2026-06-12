"use client";

import { formatKrw } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  배송완료: "#18181b",
  배송중: "#2563eb",
  결제완료: "#7c3aed",
  주문접수: "#f59e0b",
  취소: "#ef4444",
  반품: "#f97316",
};

type TooltipPayload = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
  name?: string;
};

type DashboardChartsProps = {
  channelRevenue: Array<{ channel: string; revenue: number }>;
  categoryMargin: Array<{ category: string; revenue: number; marginPct: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number; orders: number }>;
  statusCounts: Array<{ status: string; count: number; amount: number }>;
  paymentMix: Array<{ method: string; revenue: number; count: number }>;
  tierRevenue: Array<{ tier: string; revenue: number; customers: number }>;
};

export default function DashboardCharts({
  channelRevenue,
  categoryMargin,
  monthlyRevenue,
  statusCounts,
  paymentMix,
  tierRevenue,
}: DashboardChartsProps) {
  const recentMonths = monthlyRevenue.slice(-12);
  const rangeLabel =
    recentMonths.length > 0
      ? `${recentMonths[0].month} ~ ${recentMonths[recentMonths.length - 1].month}`
      : "최근 12개월";

  return (
    <>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ChartCard title="월별 매출·주문 추이" subtitle={rangeLabel}>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={recentMonths}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v}건`}
              />
              <Tooltip content={<MonthlyTooltip />} />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="revenue"
                name="매출"
                fill="#18181b"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="right"
                type="linear"
                dataKey="orders"
                name="주문"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3, fill: "#2563eb" }}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="주문 상태별 현황" subtitle="건수·금액 — 병목 구간 파악">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusCounts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip content={<StatusTooltip />} />
              <Legend />
              <Bar dataKey="count" name="건수" radius={[4, 4, 0, 0]}>
                {statusCounts.map((row) => (
                  <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? "#71717a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-3">
        <ChartCard title="채널별 매출" subtitle="배송완료 기준">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={channelRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Bar dataKey="revenue" name="매출" fill="#52525b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="고객 등급별 매출" subtitle="VIP·일반·휴면">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tierRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Bar dataKey="revenue" name="매출" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="결제수단별 매출" subtitle="여신·현금 비중">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={paymentMix}
                dataKey="revenue"
                nameKey="method"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ method, percent }) =>
                  `${method} ${((percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {paymentMix.map((_, i) => (
                  <Cell key={i} fill={["#18181b", "#2563eb", "#7c3aed", "#f59e0b"][i % 4]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-8">
        <ChartCard title="카테고리별 매출·마진율" subtitle="수익성 낮은 카테고리 식별">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={categoryMargin} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                xAxisId="left"
                tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`}
              />
              <XAxis type="number" xAxisId="right" orientation="top" domain={[0, 60]} hide />
              <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 11 }} />
              <Tooltip content={<CategoryMarginTooltip />} />
              <Legend />
              <Bar
                xAxisId="left"
                dataKey="revenue"
                name="매출"
                fill="#52525b"
                radius={[0, 4, 4, 0]}
              />
              <Line
                xAxisId="right"
                type="linear"
                dataKey="marginPct"
                name="마진율"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ef4444" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

function TooltipBox({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-md">
      <p className="mb-1.5 font-medium text-zinc-900">{label}</p>
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-2">
            {row.color ? (
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
            ) : null}
            <span className="text-zinc-500">{row.label}</span>
            <span className="font-medium text-zinc-900">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const revenue = payload.find((p) => p.dataKey === "revenue");
  const orders = payload.find((p) => p.dataKey === "orders");

  return (
    <TooltipBox
      label={String(label)}
      rows={[
        ...(revenue
          ? [{ label: "매출", value: formatKrw(Number(revenue.value)), color: "#18181b" }]
          : []),
        ...(orders
          ? [
              {
                label: "주문",
                value: `${Number(orders.value).toLocaleString()}건`,
                color: "#2563eb",
              },
            ]
          : []),
      ]}
    />
  );
}

function StatusTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<TooltipPayload & { payload?: { count: number; amount: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  const count = point?.count ?? payload.find((p) => p.dataKey === "count")?.value;

  return (
    <TooltipBox
      label={String(label)}
      rows={[
        ...(count !== undefined
          ? [
              {
                label: "건수",
                value: `${Number(count).toLocaleString()}건`,
                color: payload[0]?.color,
              },
            ]
          : []),
        ...(point?.amount !== undefined
          ? [{ label: "금액", value: formatKrw(point.amount) }]
          : []),
      ]}
    />
  );
}

function CategoryMarginTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const revenue = payload.find((p) => p.dataKey === "revenue");
  const margin = payload.find((p) => p.dataKey === "marginPct");

  return (
    <TooltipBox
      label={String(label)}
      rows={[
        ...(revenue
          ? [{ label: "매출", value: formatKrw(Number(revenue.value)), color: "#52525b" }]
          : []),
        ...(margin
          ? [{ label: "마진율", value: `${margin.value}%`, color: "#ef4444" }]
          : []),
      ]}
    />
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  );
}
