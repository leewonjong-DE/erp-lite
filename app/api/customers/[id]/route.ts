import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { customerInclude, serializeCustomer } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { customerId: Number(id) },
    include: {
      ...customerInclude,
      orders: { take: 10, orderBy: { orderDate: "desc" } },
    },
  });
  if (!customer) {
    return NextResponse.json({ error: "고객을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(serializeCustomer(customer));
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const customer = await prisma.customer.update({
    where: { customerId: Number(id) },
    data: {
      customerName: body.customerName,
      customerTypeCode: body.customerType,
      cityCode: body.city,
      phone: body.phone,
      email: body.email,
      joinDate: new Date(body.joinDate),
      tierCode: body.tier,
    },
    include: customerInclude,
  });
  return NextResponse.json(serializeCustomer(customer));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const orderCount = await prisma.salesOrder.count({
    where: { customerId: Number(id) },
  });
  if (orderCount > 0) {
    return NextResponse.json(
      { error: `연결된 주문 ${orderCount}건이 있어 삭제할 수 없습니다.` },
      { status: 400 },
    );
  }
  await prisma.customer.delete({ where: { customerId: Number(id) } });
  return NextResponse.json({ ok: true });
}
