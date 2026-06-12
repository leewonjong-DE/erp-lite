export function formatKrw(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("ko-KR");
}

export function calcItemAmount(
  qty: number,
  unitPrice: number,
  discountPct: number,
): number {
  return Math.round(qty * unitPrice * (1 - discountPct / 100));
}

export function calcMarginPct(unitCost: number, unitPrice: number): number {
  if (unitCost === 0) return 0;
  return Math.round(((unitPrice - unitCost) / unitCost) * 100);
}
