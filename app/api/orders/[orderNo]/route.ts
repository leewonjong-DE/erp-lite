import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ orderNo: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { orderNo } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { orderNo: Number(orderNo) },
    include: {
      customer: true,
      items: { include: { product: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(order);
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { orderNo } = await params;
  const body = await request.json();
  const order = await prisma.salesOrder.update({
    where: { orderNo: Number(orderNo) },
    data: {
      ...(body.status ? { status: body.status } : {}),
      ...(body.channel ? { channel: body.channel } : {}),
      ...(body.paymentMethod ? { paymentMethod: body.paymentMethod } : {}),
    },
    include: { customer: true, items: { include: { product: true } } },
  });
  return NextResponse.json(order);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { orderNo } = await params;
  await prisma.salesOrder.delete({ where: { orderNo: Number(orderNo) } });
  return NextResponse.json({ ok: true });
}
