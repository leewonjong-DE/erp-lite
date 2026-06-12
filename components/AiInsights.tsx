"use client";

import { useEffect, useState } from "react";
import type { InsightEvidence, InsightItem } from "@/lib/insight-evidence";

type InsightsData = {
  source: "ai" | "rule";
  showApiSetupHint?: boolean;
  summary: string;
  highlights: InsightItem[];
  risks: InsightItem[];
  actions: InsightItem[];
  generatedAt: string;
  evidence: Record<string, InsightEvidence>;
};

export default function AiInsights() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);

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

  const selectedEvidence =
    data && selectedTopicId ? data.evidence[selectedTopicId] ?? null : null;

  useEffect(() => {
    if (!selectedEvidence) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedTopicId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedEvidence]);

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
    <>
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
          <p className="mt-1 text-xs text-violet-600">항목을 클릭하면 근거 데이터를 확인할 수 있습니다.</p>
        </div>
        <p className="text-xs text-zinc-400">
          {new Date(data.generatedAt).toLocaleString("ko-KR")} 기준
        </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
        <InsightList
          title="핵심 성과"
          items={data.highlights}
          tone="positive"
          evidence={data.evidence}
          onSelect={setSelectedTopicId}
        />
        <InsightList
          title="리스크·주의"
          items={data.risks}
          tone="warning"
          evidence={data.evidence}
          onSelect={setSelectedTopicId}
        />
        <InsightList
          title="권장 액션"
          items={data.actions}
          tone="action"
          evidence={data.evidence}
          onSelect={setSelectedTopicId}
        />
        </div>

        {data.showApiSetupHint ? (
          <p className="mt-4 text-xs text-zinc-500">
            GEMINI_API_KEY 또는 JEM_API_KEY를 .env.local에 설정하면 Gemini AI 브리핑이 활성화됩니다.
          </p>
        ) : null}
      </section>

      {selectedEvidence ? (
        <EvidenceModal
          evidence={selectedEvidence}
          onClose={() => setSelectedTopicId(null)}
        />
      ) : null}
    </>
  );
}

function InsightList({
  title,
  items,
  tone,
  evidence,
  onSelect,
}: {
  title: string;
  items: InsightItem[];
  tone: "positive" | "warning" | "action";
  evidence: Record<string, InsightEvidence>;
  onSelect: (topicId: string) => void;
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
          items.map((item) => {
            const hasEvidence = item.topicId && evidence[item.topicId];

            if (!hasEvidence) {
              return (
                <li key={item.text} className="flex gap-2 text-sm text-zinc-600">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                  <span>{item.text}</span>
                </li>
              );
            }

            return (
              <li key={item.text}>
                <button
                  type="button"
                  onClick={() => onSelect(item.topicId!)}
                  className="flex w-full gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-zinc-600 transition hover:bg-violet-50 hover:text-violet-900"
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
                  <span className="flex-1">{item.text}</span>
                  <svg
                    className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            );
          })
        ) : (
          <li className="text-sm text-zinc-400">해당 없음</li>
        )}
      </ul>
    </div>
  );
}

function EvidenceModal({
  evidence,
  onClose,
}: {
  evidence: InsightEvidence;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="닫기"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-modal-title"
        className="relative z-10 max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-violet-200 bg-white p-5 shadow-2xl sm:max-w-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-violet-600">근거 데이터</p>
            <h4 id="evidence-modal-title" className="mt-1 text-base font-semibold text-zinc-900 sm:text-lg">
              {evidence.title}
            </h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-zinc-700">{evidence.reasoning}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evidence.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5"
            >
              <p className="text-xs text-zinc-500">{metric.label}</p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-900">{metric.value}</p>
              {metric.hint ? <p className="mt-0.5 text-[10px] text-zinc-400">{metric.hint}</p> : null}
            </div>
          ))}
        </div>

        {evidence.details && evidence.details.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-zinc-500">상세 내역</p>
            <ul className="space-y-1 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
              {evidence.details.map((line) => (
                <li key={line} className="text-xs text-zinc-600">
                  · {line}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-4 text-[11px] text-zinc-400">출처: {evidence.source}</p>
      </div>
    </div>
  );
}
