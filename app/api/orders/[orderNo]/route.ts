import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orderInclude, serializeOrder } from "@/lib/serialize";

type Params = { params: Promise<{ orderNo: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { orderNo } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { orderNo: Number(orderNo) },
    include: orderInclude,
  });
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(serializeOrder(order));
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { orderNo } = await params;
  const body = await request.json();
  const order = await prisma.salesOrder.update({
    where: { orderNo: Number(orderNo) },
    data: {
      ...(body.status ? { statusCode: body.status } : {}),
      ...(body.channel ? { channelCode: body.channel } : {}),
      ...(body.paymentMethod ? { paymentMethodCode: body.paymentMethod } : {}),
    },
    include: orderInclude,
  });
  return NextResponse.json(serializeOrder(order));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { orderNo } = await params;
  await prisma.salesOrder.delete({ where: { orderNo: Number(orderNo) } });
  return NextResponse.json({ ok: true });
}
