"use client";

import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/Skeleton";
import { formatDate, formatKrw } from "@/lib/format";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type OrderDetail = {
  orderNo: number;
  orderDate: string;
  status: string;
  channel: string;
  paymentMethod: string;
  totalAmountKrw: number;
  customer: {
    customerId: number;
    customerName: string;
    tier: string;
    city: string;
  };
  items: Array<{
    orderItemId: number;
    qty: number;
    unitPriceKrw: number;
    discountPct: number;
    amountKrw: number;
    product: { productName: string; category: string; brand: string };
  }>;
};

const statuses = ["주문접수", "결제완료", "배송중", "배송완료", "취소", "반품"];

export default function OrderDetailPage() {
  const params = useParams<{ orderNo: string }>();
  const router = useRouter();
  const isNew = params.orderNo === "new";
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [customers, setCustomers] = useState<Array<{ customerId: number; customerName: string }>>(
    [],
  );
  const [products, setProducts] = useState<
    Array<{ productId: number; productName: string; unitPriceKrw: number }>
  >([]);
  const [form, setForm] = useState({
    customerId: "",
    channel: "온라인",
    paymentMethod: "카드",
    status: "주문접수",
    orderDate: new Date().toISOString().slice(0, 10),
  });
  const [lines, setLines] = useState([
    { productId: "", qty: "1", unitPriceKrw: "", discountPct: "0" },
  ]);

  useEffect(() => {
    if (isNew) {
      Promise.all([
        fetch("/api/customers?limit=100").then((r) => r.json()),
        fetch("/api/products?limit=100").then((r) => r.json()),
      ]).then(([customerRes, productRes]) => {
        setCustomers(customerRes.data);
        setProducts(productRes.data);
      });
      return;
    }

    fetch(`/api/orders/${params.orderNo}`)
      .then((r) => r.json())
      .then(setOrder);
  }, [isNew, params.orderNo]);

  async function updateStatus(status: string) {
    const res = await fetch(`/api/orders/${params.orderNo}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    setOrder(json);
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    const items = lines
      .filter((line) => line.productId)
      .map((line) => ({
        productId: Number(line.productId),
        qty: Number(line.qty),
        unitPriceKrw: Number(line.unitPriceKrw),
        discountPct: Number(line.discountPct),
      }));

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        customerId: Number(form.customerId),
        items,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error ?? "주문 생성 실패");
      return;
    }
    router.push(`/orders/${json.orderNo}`);
  }

  if (isNew) {
    return (
      <div>
        <PageHeader title="주문 등록" description="고객과 품목을 선택해 새 주문을 생성합니다." />
        <form onSubmit={createOrder} className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              required
            >
              <option value="">고객 선택</option>
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerName} ({c.customerId})
                </option>
              ))}
            </select>
            <input
              type="date"
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.orderDate}
              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
            />
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
            >
              <option value="온라인">온라인</option>
              <option value="매장">매장</option>
              <option value="전화">전화</option>
              <option value="영업사원">영업사원</option>
            </select>
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            >
              <option value="카드">카드</option>
              <option value="현금">현금</option>
              <option value="계좌이체">계좌이체</option>
              <option value="여신">여신</option>
            </select>
          </div>

          <div className="mt-6 space-y-3">
            <h3 className="font-semibold">주문 품목</h3>
            {lines.map((line, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-5">
                <select
                  className="rounded-lg border border-zinc-300 px-3 py-2 md:col-span-2"
                  value={line.productId}
                  onChange={(e) => {
                    const product = products.find(
                      (p) => p.productId === Number(e.target.value),
                    );
                    const next = [...lines];
                    next[index] = {
                      ...next[index],
                      productId: e.target.value,
                      unitPriceKrw: product ? String(product.unitPriceKrw) : "",
                    };
                    setLines(next);
                  }}
                  required
                >
                  <option value="">상품 선택</option>
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId}>
                      {p.productName}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  placeholder="수량"
                  value={line.qty}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index].qty = e.target.value;
                    setLines(next);
                  }}
                  required
                />
                <input
                  type="number"
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  placeholder="단가"
                  value={line.unitPriceKrw}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index].unitPriceKrw = e.target.value;
                    setLines(next);
                  }}
                  required
                />
                <input
                  type="number"
                  className="rounded-lg border border-zinc-300 px-3 py-2"
                  placeholder="할인%"
                  value={line.discountPct}
                  onChange={(e) => {
                    const next = [...lines];
                    next[index].discountPct = e.target.value;
                    setLines(next);
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() =>
                setLines([
                  ...lines,
                  { productId: "", qty: "1", unitPriceKrw: "", discountPct: "0" },
                ])
              }
            >
              + 품목 추가
            </button>
          </div>

          <div className="mt-6 flex gap-3">
            <button className="rounded-lg bg-zinc-900 px-4 py-2 text-white" type="submit">
              주문 생성
            </button>
            <Link href="/orders" className="rounded-lg border px-4 py-2">
              취소
            </Link>
          </div>
        </form>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <TableSkeleton rows={4} cols={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`주문 #${order.orderNo}`}
        description={`${order.customer.customerName} · ${formatDate(order.orderDate)}`}
        action={
          <Link
            href="/orders"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm transition hover:bg-zinc-50"
          >
            목록으로
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <InfoCard label="상태" value={<StatusBadge label={order.status} />} />
        <InfoCard label="채널" value={order.channel} />
        <InfoCard label="결제" value={order.paymentMethod} />
        <InfoCard label="총액" value={formatKrw(order.totalAmountKrw)} />
      </div>

      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-5">
        <p className="text-sm text-zinc-500">고객 정보</p>
        <p className="mt-1 font-medium">
          {order.customer.customerName}{" "}
          <StatusBadge label={order.customer.tier} /> · {order.customer.city}
        </p>
        <p className="mt-4 text-sm text-zinc-500">상태 변경</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                order.status === status
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 hover:bg-zinc-50"
              }`}
              onClick={() => updateStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 text-left text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">상품</th>
              <th className="px-4 py-3 font-medium">수량</th>
              <th className="px-4 py-3 font-medium">단가</th>
              <th className="px-4 py-3 font-medium">할인</th>
              <th className="px-4 py-3 font-medium">금액</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.orderItemId} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{item.product.productName}</div>
                  <div className="text-xs text-zinc-400">
                    {item.product.brand} · {item.product.category}
                  </div>
                </td>
                <td className="px-4 py-3">{item.qty}</td>
                <td className="px-4 py-3">{formatKrw(item.unitPriceKrw)}</td>
                <td className="px-4 py-3">{item.discountPct}%</td>
                <td className="px-4 py-3">{formatKrw(item.amountKrw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
