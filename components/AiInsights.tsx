"use client";

import { useEffect, useState } from "react";

type InsightsData = {
  source: "ai" | "rule";
  summary: string;
  highlights: string[];
  risks: string[];
  actions: string[];
  generatedAt: string;
};

export default function AiInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/insights")
      .then(async (res) => {
        if (!res.ok) throw new Error("인사이트를 불러오지 못했습니다.");
        return res.json();
      })
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mb-6 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
          <p className="text-sm font-medium text-violet-800">AI 경영·운영 브리핑 생성 중…</p>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-violet-100" />
          <div className="h-4 w-[85%] animate-pulse rounded bg-violet-100" />
          <div className="h-4 w-[65%] animate-pulse rounded bg-violet-100" />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="mb-6 rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500">
        {error || "인사이트를 표시할 수 없습니다."}
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
              {data.source === "ai" ? "AI 브리핑" : "자동 요약"}
            </span>
            <h3 className="font-semibold text-zinc-900">경영·운영 인사이트</h3>
          </div>
          <p className="mt-2 leading-relaxed text-zinc-700">{data.summary}</p>
        </div>
        <p className="text-xs text-zinc-400">
          {new Date(data.generatedAt).toLocaleString("ko-KR")} 기준
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InsightList title="핵심 성과" items={data.highlights} tone="positive" />
        <InsightList title="리스크·주의" items={data.risks} tone="warning" />
        <InsightList title="권장 액션" items={data.actions} tone="action" />
      </div>

      {data.source === "rule" ? (
        <p className="mt-4 text-xs text-zinc-500">
          GEMINI_API_KEY 또는 JEM_API_KEY를 .env.local에 설정하면 Gemini AI 브리핑이 활성화됩니다.
        </p>
      ) : null}
    </section>
  );
}

function InsightList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "positive" | "warning" | "action";
}) {
  const dotClass =
    tone === "positive"
      ? "bg-emerald-500"
      : tone === "warning"
        ? "bg-amber-500"
        : "bg-blue-500";

  return (
    <div className="rounded-lg border border-zinc-200/80 bg-white/80 p-4">
      <h4 className="text-sm font-semibold text-zinc-800">{title}</h4>
      <ul className="mt-2 space-y-2">
        {items.length ? (
          items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-zinc-600">
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
              <span>{item}</span>
            </li>
          ))
        ) : (
          <li className="text-sm text-zinc-400">해당 없음</li>
        )}
      </ul>
    </div>
  );
}
