import KpiCard from "@/components/KpiCard";
import { formatKrw } from "@/lib/format";
import type { DashboardForecasts } from "@/lib/forecast";

function formatPredicted(unit: "krw" | "count", value: number): string {
  if (unit === "krw") return formatKrw(value);
  return `${value.toLocaleString()}명`;
}

function trendText(changePct: number | null, trend: "up" | "down" | "flat"): string {
  if (changePct === null) return "비교 기준 없음";
  const sign = changePct > 0 ? "+" : "";
  const label = trend === "up" ? "증가 전망" : trend === "down" ? "감소 전망" : "유사 수준";
  return `${sign}${changePct}% · ${label}`;
}

export default function ForecastPanel({ forecasts }: { forecasts: DashboardForecasts }) {
  const { revenue, newCustomers, totalCustomers, disclaimer } = forecasts;

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-zinc-500">전망 (예측)</h3>
        <p className="mt-0.5 text-xs text-zinc-400">
          {revenue.targetMonth} 기준 · {disclaimer}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label={revenue.label}
          value={formatPredicted(revenue.unit, revenue.predicted)}
          hint={`${revenue.compareLabel} 대비`}
          trend={{
            text: trendText(revenue.changePct, revenue.trend),
            positive: revenue.trend !== "down",
          }}
        />
        <KpiCard
          label={newCustomers.label}
          value={formatPredicted(newCustomers.unit, newCustomers.predicted)}
          hint={`${newCustomers.compareLabel} 신규 가입 대비`}
          trend={{
            text: trendText(newCustomers.changePct, newCustomers.trend),
            positive: newCustomers.trend !== "down",
          }}
        />
        <KpiCard
          label={totalCustomers.label}
          value={formatPredicted(totalCustomers.unit, totalCustomers.predicted)}
          hint={totalCustomers.compareLabel}
          trend={{
            text: trendText(totalCustomers.changePct, totalCustomers.trend),
            positive: totalCustomers.trend !== "down",
          }}
        />
      </div>
    </section>
  );
}
