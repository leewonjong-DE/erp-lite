"use client";

import PageHeader from "@/components/PageHeader";
import { calcMarginPct, formatKrw } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

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

export default function ProductsPage() {
  const [data, setData] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: "15",
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
      ...(lowStock ? { lowStock: "true" } : {}),
    });
    const res = await fetch(`/api/products?${params}`);
    const json = await res.json();
    setData(json.data);
    setTotal(json.total);
  }, [page, search, category, lowStock]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    if (!res.ok) {
      const json = await res.json();
      alert(json.error ?? "저장 실패");
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("이 상품을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error);
      return;
    }
    load();
  }

  async function updateStock(id: number, stockQty: number) {
    const product = data.find((p) => p.productId === id);
    if (!product) return;
    await fetch(`/api/products/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, stockQty }),
    });
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / 15));

  return (
    <div>
      <PageHeader title="상품·재고" description="상품 카탈로그와 재고 수량을 관리합니다." />

      <div className="mb-6 grid gap-4 rounded-xl border border-zinc-200 bg-white p-5 lg:grid-cols-4">
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="상품명/브랜드 검색"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />
        <input
          className="rounded-lg border border-zinc-300 px-3 py-2"
          placeholder="카테고리"
          value={category}
          onChange={(e) => {
            setPage(1);
            setCategory(e.target.value);
          }}
        />
        <label className="flex items-center gap-2 text-sm">
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
        <p className="self-center text-sm text-zinc-500">총 {total.toLocaleString()}개</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-left text-zinc-500">
              <tr>
                <th className="px-4 py-3">상품</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3">판매가</th>
                <th className="px-4 py-3">마진</th>
                <th className="px-4 py-3">재고</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product) => (
                <tr key={product.productId} className="border-t border-zinc-100">
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
                      className="w-20 rounded border border-zinc-300 px-2 py-1"
                      value={product.stockQty}
                      onChange={(e) =>
                        updateStock(product.productId, Number(e.target.value))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">{product.status}</td>
                  <td className="px-4 py-3">
                    <button
                      className="mr-2 text-blue-600 hover:underline"
                      onClick={() => {
                        setEditingId(product.productId);
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
                      className="text-red-600 hover:underline"
                      onClick={() => handleDelete(product.productId)}
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
                className="rounded-lg border border-zinc-300 px-3 py-2"
                placeholder={label}
                value={form[key as keyof typeof form]}
                disabled={key === "productId" && !!editingId}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                required
              />
            ))}
            <select
              className="rounded-lg border border-zinc-300 px-3 py-2"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="판매중">판매중</option>
              <option value="단종">단종</option>
            </select>
          </div>
          <button className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-white" type="submit">
            {editingId ? "수정 저장" : "추가"}
          </button>
        </form>
      </div>
    </div>
  );
}
