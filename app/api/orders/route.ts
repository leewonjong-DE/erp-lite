import { NextRequest, NextResponse } from "next/server";
import { calcItemAmount } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const status = searchParams.get("status") ?? "";
  const channel = searchParams.get("channel") ?? "";
  const customerId = searchParams.get("customerId") ?? "";

  const where = {
    ...(status ? { status } : {}),
    ...(channel ? { channel } : {}),
    ...(customerId ? { customerId: Number(customerId) } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.salesOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { orderDate: "desc" },
      include: {
        customer: { select: { customerName: true, tier: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.salesOrder.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = body.items as Array<{
    productId: number;
    qty: number;
    unitPriceKrw: number;
    discountPct: number;
  }>;

  if (!items?.length) {
    return NextResponse.json({ error: "주문 품목이 필요합니다." }, { status: 400 });
  }

  const maxOrderNo = await prisma.salesOrder.aggregate({ _max: { orderNo: true } });
  const maxItemId = await prisma.salesOrderItem.aggregate({ _max: { orderItemId: true } });
  const orderNo = (maxOrderNo._max.orderNo ?? 1000000) + 1;

  let itemId = (maxItemId._max.orderItemId ?? 1100000) + 1;
  const lineItems = items.map((item) => {
    const amountKrw = calcItemAmount(item.qty, item.unitPriceKrw, item.discountPct);
    const row = {
      orderItemId: itemId++,
      productId: item.productId,
      qty: item.qty,
      unitPriceKrw: item.unitPriceKrw,
      discountPct: item.discountPct,
      amountKrw,
    };
    return row;
  });

  const totalAmountKrw = lineItems.reduce((sum, item) => sum + item.amountKrw, 0);

  const order = await prisma.salesOrder.create({
    data: {
      orderNo,
      customerId: Number(body.customerId),
      orderDate: new Date(body.orderDate ?? new Date()),
      status: body.status ?? "주문접수",
      channel: body.channel,
      paymentMethod: body.paymentMethod,
      totalAmountKrw,
      items: { create: lineItems },
    },
    include: { items: true, customer: true },
  });

  return NextResponse.json(order, { status: 201 });
}
