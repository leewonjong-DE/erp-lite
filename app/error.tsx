"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
      <h2 className="text-lg font-semibold">오류가 발생했습니다</h2>
      <p className="mt-2 text-sm">{error.message}</p>
      <button
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm text-white"
        onClick={reset}
      >
        다시 시도
      </button>
    </div>
  );
}
