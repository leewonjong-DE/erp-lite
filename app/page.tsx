"use client";

import KpiCard from "@/components/KpiCard";
import PageHeader from "@/components/PageHeader";
import { formatKrw } from "@/lib/format";
import { useEffect, useState } from "react";
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

type DashboardData = {
  kpis: {
    customerCount: number;
    productCount: number;
    orderCount: number;
    lowStockCount: number;
    totalRevenue: number;
  };
  channelRevenue: Array<{ channel: string; revenue: number }>;
  categoryRevenue: Array<{ category: string; revenue: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  lowStockProducts: Array<{
    productId: number;
    productName: string;
    stockQty: number;
    category: string;
  }>;
  statusCounts: Array<{ status: string; count: number }>;
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
        <p className="mt-2 text-sm">
          Supabase 연결 후 <code>npm run db:push</code>와 <code>npm run db:seed</code>를
          실행했는지 확인하세요.
        </p>
      </div>
    );
  }

  if (!data) {
    return <p className="text-zinc-500">대시보드 로딩 중...</p>;
  }

  return (
    <div>
      <PageHeader
        title="대시보드"
        description="매출, 채널, 재고 현황을 한눈에 확인합니다."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="총 매출" value={formatKrw(data.kpis.totalRevenue)} />
        <KpiCard label="주문 수" value={data.kpis.orderCount.toLocaleString()} />
        <KpiCard label="고객 수" value={data.kpis.customerCount.toLocaleString()} />
        <KpiCard label="상품 수" value={data.kpis.productCount.toLocaleString()} />
        <KpiCard
          label="재고 부족 SKU"
          value={data.kpis.lowStockCount.toLocaleString()}
          hint="재고 50개 미만"
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ChartCard title="채널별 매출">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.channelRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="channel" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000_000)}B`} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Bar dataKey="revenue" fill="#18181b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="월별 매출 추이">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${Math.round(v / 1_000_000_000)}B`} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <ChartCard title="카테고리별 매출 TOP">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.categoryRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1_000_000_000)}B`} />
              <YAxis type="category" dataKey="category" width={90} />
              <Tooltip formatter={(v) => formatKrw(Number(v))} />
              <Bar dataKey="revenue" fill="#52525b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold">재고 부족 상품</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-zinc-500">
                  <th className="pb-2 pr-4">상품명</th>
                  <th className="pb-2 pr-4">카테고리</th>
                  <th className="pb-2">재고</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStockProducts.map((product) => (
                  <tr key={product.productId} className="border-b border-zinc-100">
                    <td className="py-2 pr-4">{product.productName}</td>
                    <td className="py-2 pr-4">{product.category}</td>
                    <td className="py-2 font-medium text-red-600">{product.stockQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
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
