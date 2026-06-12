"use client";

import { formatKrw } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartData = {
  channelRevenue: Array<{ channel: string; revenue: number }>;
  categoryRevenue: Array<{ category: string; revenue: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
};

export default function DashboardCharts({
  channelRevenue,
  categoryRevenue,
  monthlyRevenue,
}: ChartData) {
  return (
    <>
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ChartCard title="채널별 매출">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={channelRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Bar dataKey="revenue" fill="#18181b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="월별 매출 추이">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-8">
        <ChartCard title="카테고리별 매출 TOP">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000_000)}B`} />
              <YAxis type="category" dataKey="category" width={90} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Bar dataKey="revenue" fill="#52525b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {children}
    </div>
  );
}
