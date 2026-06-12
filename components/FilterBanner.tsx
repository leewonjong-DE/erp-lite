import Link from "next/link";

export default function FilterBanner({
  label,
  clearHref,
}: {
  label: string;
  clearHref: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <span>
        <span className="font-medium">필터 적용 중</span>
        <span className="mx-2">·</span>
        {label}
      </span>
      <Link href={clearHref} className="font-medium text-blue-700 hover:underline">
        필터 해제
      </Link>
    </div>
  );
}
