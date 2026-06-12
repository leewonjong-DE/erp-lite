const STATUS_STYLES: Record<string, string> = {
  주문접수: "bg-amber-100 text-amber-800",
  결제완료: "bg-violet-100 text-violet-800",
  배송중: "bg-blue-100 text-blue-800",
  배송완료: "bg-emerald-100 text-emerald-800",
  취소: "bg-red-100 text-red-800",
  반품: "bg-orange-100 text-orange-800",
  VIP: "bg-violet-100 text-violet-800",
  일반: "bg-zinc-100 text-zinc-700",
  휴면: "bg-zinc-200 text-zinc-600",
  판매중: "bg-emerald-100 text-emerald-800",
  단종: "bg-zinc-200 text-zinc-600",
  개인: "bg-sky-100 text-sky-800",
  법인: "bg-indigo-100 text-indigo-800",
  미주문: "bg-red-100 text-red-800",
  첫구매: "bg-sky-100 text-sky-800",
  재구매대기: "bg-amber-100 text-amber-800",
  재구매: "bg-emerald-100 text-emerald-800",
};

export default function StatusBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[label] ?? "bg-zinc-100 text-zinc-700"
      }`}
    >
      {label}
    </span>
  );
}
