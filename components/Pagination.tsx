export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-4 py-3">
      <p className="text-sm text-zinc-500">총 {total.toLocaleString()}건</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          이전
        </button>
        <span className="min-w-[4rem] text-center text-sm text-zinc-600">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
