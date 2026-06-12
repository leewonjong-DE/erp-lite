import { prisma } from "@/lib/prisma";

export type SuggestItem = {
  type: "customer" | "product" | "order";
  label: string;
  sublabel: string;
  value: string;
  customerId?: number;
};

export async function getSearchSuggestions(query: string, limit = 10): Promise<SuggestItem[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const perType = Math.max(2, Math.ceil(limit / 3));
  const orderNo = /^\d+$/.test(q) ? Number(q) : null;

  const [customers, products, orders] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { customerName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      take: perType,
      orderBy: { customerName: "asc" },
      include: { city: true, tier: true },
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { productName: { contains: q, mode: "insensitive" } },
          { brand: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: perType,
      orderBy: { productName: "asc" },
      include: { brand: true, category: true },
    }),
    prisma.salesOrder.findMany({
      where: {
        OR: [
          ...(orderNo ? [{ orderNo }] : []),
          { customer: { customerName: { contains: q, mode: "insensitive" } } },
        ],
      },
      take: perType,
      orderBy: { orderDate: "desc" },
      include: {
        customer: { select: { customerName: true } },
        orderStatus: { select: { name: true } },
      },
    }),
  ]);

  const items: SuggestItem[] = [
    ...customers.map((c) => ({
      type: "customer" as const,
      label: c.customerName,
      sublabel: `#${c.customerId} · ${c.city.name} · ${c.tier.name}`,
      value: c.customerName,
      customerId: c.customerId,
    })),
    ...products.map((p) => ({
      type: "product" as const,
      label: p.productName,
      sublabel: `${p.brand.name} · ${p.category.name} · 재고 ${p.stockQty}`,
      value: p.productName,
    })),
    ...orders.map((o) => ({
      type: "order" as const,
      label: `#${o.orderNo} ${o.customer.customerName}`,
      sublabel: `${o.orderStatus.name} · ${o.orderDate.toISOString().slice(0, 10)}`,
      value: String(o.orderNo),
    })),
  ];

  return items.slice(0, limit);
}
