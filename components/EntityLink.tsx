import Link from "next/link";

export const entityLinkClass =
  "font-medium text-blue-600 hover:text-blue-800 hover:underline";

export function CustomerLink({
  customerId,
  children,
}: {
  customerId: number;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/customers?customerId=${customerId}`} className={entityLinkClass}>
      {children}
    </Link>
  );
}

export function ProductLink({
  productId,
  children,
}: {
  productId: number;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/products?productId=${productId}`} className={entityLinkClass}>
      {children}
    </Link>
  );
}

export function OrderLink({
  orderNo,
  children,
}: {
  orderNo: number;
  children: React.ReactNode;
}) {
  return (
    <Link href={`/orders/${orderNo}`} className={entityLinkClass}>
      {children}
    </Link>
  );
}
