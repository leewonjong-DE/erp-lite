"use client";

import PageHeader from "@/components/PageHeader";
import { formatDate, formatKrw } from "@/lib/format";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Order = {
  orderNo: number;
  customerId: number;
  orderDate: string;
  status: string;
  channel: string;
  paymentMethod: string;
  totalAmountKrw: number;
  customer: { customerName: string; tier: string };
  _count: { items: number };
};

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(status ? { status } : {}),
      ...(channel ? { channel } : {}),
    });
    const res = await fetch(`/api/orders?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotal(json.total);
  }, [page, status, channel]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div>
      <PageHeader
        title="주문 관리"
        description="주문 목록을 조회하고 상세 페이지에서 상태를 변경합니다."
        action={
          <Link
            href="/orders/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            + 주문 등록
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:grid-cols-3">
        <select
          className="rounded-lg border border-zinc-300 px-3 py-2"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          <option value="">전체 상태</option>
          <option value="주문접수">주문접수</option>
          <option value="결제완료">결제완료</option>
          <option value="배송중">배송중</option>
          <option value="배송완료">배송완료</option>
          <option value="취소">취소</option>
          <option value="반품">반품</option>
        </select>
        <select
          className="rounded-lg border border-zinc-300 px-3 py-2"
          value={channel}
          onChange={(e) => {
            setPage(1);
            setChannel(e.target.value);
          }}
        >
          <option value="">전체 채널</option>
          <option value="온라인">온라인</option>
          <option value="매장">매장</option>
          <option value="전화">전화</option>
          <option value="영업사원">영업사원</option>
        </select>
        <p className="self-center text-sm text-zinc-500">총 {total.toLocaleString()}건</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-3">주문번호</th>
              <th className="px-4 py-3">고객</th>
              <th className="px-4 py-3">주문일</th>
              <th className="px-4 py-3">채널</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">품목</th>
              <th className="px-4 py-3">금액</th>
            </tr>
          </thead>
          <tbody>
            {data.map((order) => (
              <tr key={order.orderNo} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/orders/${order.orderNo}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {order.orderNo}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>{order.customer.customerName}</div>
                  <div className="text-xs text-zinc-400">{order.customer.tier}</div>
                </td>
                <td className="px-4 py-3">{formatDate(order.orderDate)}</td>
                <td className="px-4 py-3">{order.channel}</td>
                <td className="px-4 py-3">{order.status}</td>
                <td className="px-4 py-3">{order._count.items}개</td>
                <td className="px-4 py-3">{formatKrw(order.totalAmountKrw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-zinc-100 px-4 py-3">
          <button
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </button>
          <span className="text-sm text-zinc-500">
            {page} / {totalPages}
          </span>
          <button
            className="rounded-lg border px-3 py-1 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
