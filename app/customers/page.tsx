"use client";

import EmptyState from "@/components/EmptyState";
import { CustomerLink } from "@/components/EntityLink";
import FilterBanner from "@/components/FilterBanner";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import SearchInput from "@/components/SearchInput";
import StatusBadge from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/Skeleton";
import { formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

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

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200";

export default function CustomersPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={8} cols={6} />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const searchParams = useSearchParams();
  const filterCustomerId = searchParams.get("customerId") ?? "";

  const [data, setData] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [customerType, setCustomerType] = useState(() => searchParams.get("customerType") ?? "");
  const [tier, setTier] = useState(() => searchParams.get("tier") ?? "");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    setSearch(searchParams.get("search") ?? "");
    setCustomerType(searchParams.get("customerType") ?? "");
    setTier(searchParams.get("tier") ?? "");
    setPage(1);
  }, [searchParams, filterCustomerId]);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(filterCustomerId ? { customerId: filterCustomerId } : {}),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(customerType ? { customerType } : {}),
      ...(tier ? { tier } : {}),
    });
    const res = await fetch(`/api/customers?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotal(json.total);
    setLoading(false);
  }, [page, debouncedSearch, customerType, tier, filterCustomerId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    const payload = { ...form, customerId: Number(form.customerId) };
    const url = editingId ? `/api/customers/${editingId}` : "/api/customers";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);
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
      setMessage(json.error ?? "삭제에 실패했습니다.");
      return;
    }
    setMessage("고객이 삭제되었습니다.");
    load();
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.customerId);
    setMessage("");
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

      {filterCustomerId ? (
        <FilterBanner
          label={
            data[0]
              ? `고객 #${filterCustomerId} · ${data[0].customerName}`
              : `고객 #${filterCustomerId}`
          }
          clearHref="/customers"
        />
      ) : null}

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:grid-cols-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          placeholder="이름/도시 검색"
        />
        <select
          className={inputClass}
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
          className={inputClass}
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
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
            {data.length === 0 ? (
              <EmptyState
                title="검색 결과가 없습니다"
                description="검색어나 필터 조건을 변경해 보세요."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">ID</th>
                      <th className="px-4 py-3 font-medium">이름</th>
                      <th className="px-4 py-3 font-medium">유형</th>
                      <th className="px-4 py-3 font-medium">도시</th>
                      <th className="px-4 py-3 font-medium">등급</th>
                      <th className="px-4 py-3 font-medium">가입일</th>
                      <th className="px-4 py-3 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((customer) => (
                      <tr
                        key={customer.customerId}
                        className="border-t border-zinc-100 transition hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3 text-zinc-500">{customer.customerId}</td>
                        <td className="px-4 py-3 font-medium">
                          <CustomerLink customerId={customer.customerId}>
                            {customer.customerName}
                          </CustomerLink>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge label={customer.customerType} />
                        </td>
                        <td className="px-4 py-3">{customer.city}</td>
                        <td className="px-4 py-3">
                          <StatusBadge label={customer.tier} />
                        </td>
                        <td className="px-4 py-3">{formatDate(customer.joinDate)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="mr-3 text-blue-600 hover:underline"
                            onClick={() => startEdit(customer)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
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
              </div>
            )}
            <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-xl border border-zinc-200 bg-white p-5 shadow-sm xl:sticky xl:top-8"
        >
          <h3 className="mb-4 font-semibold">{editingId ? "고객 수정" : "고객 추가"}</h3>
          <div className="grid gap-3">
            <input
              className={inputClass}
              placeholder="고객 ID"
              value={form.customerId}
              disabled={!!editingId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              required
            />
            <input
              className={inputClass}
              placeholder="고객명"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              required
            />
            <select
              className={inputClass}
              value={form.customerType}
              onChange={(e) => setForm({ ...form, customerType: e.target.value })}
            >
              <option value="개인">개인</option>
              <option value="법인">법인</option>
              <option value="대리점">대리점</option>
            </select>
            <input
              className={inputClass}
              placeholder="도시"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              required
            />
            <input
              className={inputClass}
              placeholder="전화"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <input
              className={inputClass}
              placeholder="이메일"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              type="date"
              className={inputClass}
              value={form.joinDate}
              onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              required
            />
            <select
              className={inputClass}
              value={form.tier}
              onChange={(e) => setForm({ ...form, tier: e.target.value })}
            >
              <option value="일반">일반</option>
              <option value="VIP">VIP</option>
              <option value="휴면">휴면</option>
            </select>
          </div>
          {message ? (
            <p
              className={`mt-3 text-sm ${
                message.includes("실패") || message.includes("삭제에")
                  ? "text-red-600"
                  : "text-emerald-600"
              }`}
            >
              {message}
            </p>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:opacity-50"
              type="submit"
              disabled={saving}
            >
              {saving ? "저장 중…" : editingId ? "수정 저장" : "추가"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setMessage("");
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
