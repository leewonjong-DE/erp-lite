"use client";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/Skeleton";
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

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200";

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
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
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800"
          >
            + 주문 등록
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:grid-cols-2">
        <select
          className={inputClass}
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
          className={inputClass}
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
      </div>

      {loading ? (
        <TableSkeleton rows={10} cols={7} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          {data.length === 0 ? (
            <EmptyState
              title="주문이 없습니다"
              description="필터 조건을 변경하거나 새 주문을 등록해 보세요."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">주문번호</th>
                    <th className="px-4 py-3 font-medium">고객</th>
                    <th className="px-4 py-3 font-medium">주문일</th>
                    <th className="px-4 py-3 font-medium">채널</th>
                    <th className="px-4 py-3 font-medium">상태</th>
                    <th className="px-4 py-3 font-medium">품목</th>
                    <th className="px-4 py-3 font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((order) => (
                    <tr
                      key={order.orderNo}
                      className="border-t border-zinc-100 transition hover:bg-zinc-50"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.orderNo}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {order.orderNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{order.customer.customerName}</div>
                        <StatusBadge label={order.customer.tier} />
                      </td>
                      <td className="px-4 py-3">{formatDate(order.orderDate)}</td>
                      <td className="px-4 py-3">{order.channel}</td>
                      <td className="px-4 py-3">
                        <StatusBadge label={order.status} />
                      </td>
                      <td className="px-4 py-3">{order._count.items}개</td>
                      <td className="px-4 py-3 font-medium">{formatKrw(order.totalAmountKrw)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
