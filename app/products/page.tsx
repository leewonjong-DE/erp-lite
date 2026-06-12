"use client";

import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import SearchInput from "@/components/SearchInput";
import StatusBadge from "@/components/StatusBadge";
import { TableSkeleton } from "@/components/Skeleton";
import { calcMarginPct, formatKrw } from "@/lib/format";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useCallback, useEffect, useRef, useState } from "react";

type Product = {
  productId: number;
  productName: string;
  category: string;
  brand: string;
  unitCostKrw: number;
  unitPriceKrw: number;
  stockQty: number;
  status: string;
};

const emptyForm = {
  productId: "",
  productName: "",
  category: "",
  brand: "",
  unitCostKrw: "",
  unitPriceKrw: "",
  stockQty: "",
  status: "판매중",
};

const inputClass =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm transition focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200";

export default function ProductsPage() {
  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stockDraft, setStockDraft] = useState<Record<number, string>>({});
  const [savingStock, setSavingStock] = useState<number | null>(null);
  const stockTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const debouncedSearch = useDebouncedValue(search);
  const debouncedCategory = useDebouncedValue(category);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(debouncedCategory ? { category: debouncedCategory } : {}),
      ...(lowStock ? { lowStock: "true" } : {}),
    });
    const res = await fetch(`/api/products?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotal(json.total);
    setStockDraft({});
    setLoading(false);
  }, [page, debouncedSearch, debouncedCategory, lowStock]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const payload = {
      ...form,
      productId: Number(form.productId),
      unitCostKrw: Number(form.unitCostKrw),
      unitPriceKrw: Number(form.unitPriceKrw),
      stockQty: Number(form.stockQty),
    };
    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setMessage(json.error ?? "저장에 실패했습니다.");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    setMessage(editingId ? "상품이 수정되었습니다." : "상품이 추가되었습니다.");
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setMessage(json.error ?? "삭제에 실패했습니다.");
      return;
    }
    setMessage("상품이 삭제되었습니다.");
    load();
  }

  function scheduleStockSave(product: Product, value: string) {
    const id = product.productId;
    setStockDraft((prev) => ({ ...prev, [id]: value }));

    if (stockTimers.current[id]) clearTimeout(stockTimers.current[id]);
    stockTimers.current[id] = setTimeout(async () => {
      const stockQty = Number(value);
      if (Number.isNaN(stockQty) || stockQty < 0) return;
      setSavingStock(id);
      await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, stockQty }),
      });
      setSavingStock(null);
      setStockDraft((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setData((prev) =>
        prev.map((p) => (p.productId === id ? { ...p, stockQty } : p)),
      );
    }, 600);
  }

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div>
      <PageHeader title="상품·재고" description="상품 카탈로그와 재고 수량을 관리합니다." />

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:grid-cols-3">
        <SearchInput
          value={search}
          onChange={(v) => {
            setPage(1);
            setSearch(v);
          }}
          placeholder="상품명/브랜드 검색"
        />
        <input
          className={inputClass}
          placeholder="카테고리"
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
        />
        <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => {
              setPage(1);
              setLowStock(e.target.checked);
            }}
          />
          재고 50개 미만만
        </label>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
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
                      <th className="px-4 py-3 font-medium">상품</th>
                      <th className="px-4 py-3 font-medium">카테고리</th>
                      <th className="px-4 py-3 font-medium">판매가</th>
                      <th className="px-4 py-3 font-medium">마진</th>
                      <th className="px-4 py-3 font-medium">재고</th>
                      <th className="px-4 py-3 font-medium">상태</th>
                      <th className="px-4 py-3 font-medium">액션</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((product) => {
                      const stockValue =
                        stockDraft[product.productId] ?? String(product.stockQty);
                      const isLow = product.stockQty < 50;
                      return (
                        <tr
                          key={product.productId}
                          className="border-t border-zinc-100 transition hover:bg-zinc-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium">{product.productName}</div>
                            <div className="text-xs text-zinc-400">{product.brand}</div>
                          </td>
                          <td className="px-4 py-3">{product.category}</td>
                          <td className="px-4 py-3">{formatKrw(product.unitPriceKrw)}</td>
                          <td className="px-4 py-3">
                            {calcMarginPct(product.unitCostKrw, product.unitPriceKrw)}%
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              className={`w-20 rounded border px-2 py-1 text-sm transition focus:outline-none focus:ring-2 focus:ring-zinc-200 ${
                                isLow
                                  ? "border-red-300 bg-red-50 text-red-700"
                                  : "border-zinc-300"
                              }`}
                              value={stockValue}
                              onChange={(e) => scheduleStockSave(product, e.target.value)}
                            />
                            {savingStock === product.productId ? (
                              <span className="ml-1 text-xs text-zinc-400">저장…</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge label={product.status} />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              className="mr-3 text-blue-600 hover:underline"
                              onClick={() => {
                                setEditingId(product.productId);
                                setMessage("");
                                setForm({
                                  productId: String(product.productId),
                                  productName: product.productName,
                                  category: product.category,
                                  brand: product.brand,
                                  unitCostKrw: String(product.unitCostKrw),
                                  unitPriceKrw: String(product.unitPriceKrw),
                                  stockQty: String(product.stockQty),
                                  status: product.status,
                                });
                              }}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="text-red-600 hover:underline"
                              onClick={() => handleDelete(product.productId)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
          <h3 className="mb-4 font-semibold">{editingId ? "상품 수정" : "상품 추가"}</h3>
          <div className="grid gap-3">
            {Object.entries({
              productId: "상품 ID",
              productName: "상품명",
              category: "카테고리",
              brand: "브랜드",
              unitCostKrw: "원가",
              unitPriceKrw: "판매가",
              stockQty: "재고",
            }).map(([key, label]) => (
              <input
                key={key}
                className={inputClass}
                placeholder={label}
                value={form[key as keyof typeof form]}
                disabled={key === "productId" && !!editingId}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required
              />
            ))}
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="판매중">판매중</option>
              <option value="단종">단종</option>
            </select>
          </div>
          {message ? (
            <p
              className={`mt-3 text-sm ${
                message.includes("실패") ? "text-red-600" : "text-emerald-600"
              }`}
            >
              {message}
            </p>
          ) : null}
          <button
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-800 disabled:opacity-50"
            type="submit"
            disabled={saving}
          >
            {saving ? "저장 중…" : editingId ? "수정 저장" : "추가"}
          </button>
        </form>
      </div>
    </div>
  );
}
