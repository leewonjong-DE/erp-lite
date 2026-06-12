"use client";

import PageHeader from "@/components/PageHeader";
import { formatDate } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

type Customer = {
  customerId: number;
  customerName: string;
  customerType: string;
  city: string;
  phone: string;
  email: string;
  joinDate: string;
  tier: string;
};

const emptyForm = {
  customerId: "",
  customerName: "",
  customerType: "개인",
  city: "",
  phone: "",
  email: "",
  joinDate: new Date().toISOString().slice(0, 10),
  tier: "일반",
};

export default function CustomersPage() {
  const [data, setData] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [tier, setTier] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(search ? { search } : {}),
      ...(customerType ? { customerType } : {}),
      ...(tier ? { tier } : {}),
    });
    const res = await fetch(`/api/customers?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotal(json.total);
  }, [page, search, customerType, tier]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const payload = {
      ...form,
      customerId: Number(form.customerId),
    };
    const url = editingId ? `/api/customers/${editingId}` : "/api/customers";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "저장에 실패했습니다.");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? "고객 정보가 수정되었습니다." : "고객이 추가되었습니다.");
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("이 고객을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error);
      return;
    }
    load();
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.customerId);
    setForm({
      customerId: String(customer.customerId),
      customerName: customer.customerName,
      customerType: customer.customerType,
      city: customer.city,
      phone: customer.phone,
      email: customer.email,
      joinDate: customer.joinDate.slice(0, 10),
      tier: customer.tier,
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div>
      <PageHeader title="고객 관리" description="고객 정보를 조회·등록·수정합니다." />

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:grid-cols-4">
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="이름/도시 검색"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <select
          className="rounded-lg border border-zinc-300 px-3 py-2"
          value={customerType}
          onChange={(e) => {
            setPage(1);
            setCustomerType(e.target.value);
          }}
        >
          <option value="">전체 유형</option>
          <option value="개인">개인</option>
          <option value="법인">법인</option>
          <option value="대리점">대리점</option>
        </select>
        <select
          className="rounded-lg border border-zinc-300 px-3 py-2"
          value={tier}
          onChange={(e) => {
            setPage(1);
            setTier(e.target.value);
          }}
        >
          <option value="">전체 등급</option>
          <option value="일반">일반</option>
          <option value="VIP">VIP</option>
          <option value="휴면">휴면</option>
        </select>
        <p className="self-center text-sm text-zinc-500">총 {total.toLocaleString()}명</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">유형</th>
                <th className="px-4 py-3">도시</th>
                <th className="px-4 py-3">등급</th>
                <th className="px-4 py-3">가입일</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {data.map((customer) => (
                <tr key={customer.customerId} className="border-t border-zinc-100">
                  <td className="px-4 py-3">{customer.customerId}</td>
                  <td className="px-4 py-3">{customer.customerName}</td>
                  <td className="px-4 py-3">{customer.customerType}</td>
                  <td className="px-4 py-3">{customer.city}</td>
                  <td className="px-4 py-3">{customer.tier}</td>
                  <td className="px-4 py-3">{formatDate(customer.joinDate)}</td>
                  <td className="px-4 py-3">
                    <button
                      className="mr-2 text-blue-600 hover:underline"
                      onClick={() => startEdit(customer)}
                    >
                      수정
                    </button>
                    <button
                      className="text-red-600 hover:underline"
                      onClick={() => handleDelete(customer.customerId)}
                    >
                      삭제
                    </button>
                  </td>
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

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm"
        >
          <h3 className="mb-4 font-semibold">{editingId ? "고객 수정" : "고객 추가"}</h3>
          <div className="grid gap-3">
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="고객 ID"
              value={form.customerId}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              required
            />
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="고객명"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              required
            />
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.customerType}
              onChange={(e) => setForm({ ...form, customerType: e.target.value })}
            >
              <option value="개인">개인</option>
              <option value="법인">법인</option>
              <option value="대리점">대리점</option>
            </select>
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="도시"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="전화"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <input
              className="rounded-lg border border-zinc-300 px-3 py-2"
              placeholder="이메일"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              type="date"
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.joinDate}
              onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              required
            />
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
            >
              <option value="일반">일반</option>
              <option value="VIP">VIP</option>
              <option value="휴면">휴면</option>
            </select>
          </div>
          {message ? <p className="mt-3 text-sm text-green-600">{message}</p> : null}
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-zinc-900 px-4 py-2 text-white" type="submit">
              {editingId ? "수정 저장" : "추가"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-lg border px-4 py-2"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                취소
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
