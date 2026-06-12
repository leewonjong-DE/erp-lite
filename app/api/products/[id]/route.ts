import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productInclude, serializeProduct } from "@/lib/serialize";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { productId: Number(id) },
    include: productInclude,
  });
  if (!product) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(serializeProduct(product));
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const product = await prisma.product.update({
    where: { productId: Number(id) },
    data: {
      productName: body.productName,
      categoryCode: body.category,
      brandCode: body.brand,
      unitCostKrw: Number(body.unitCostKrw),
      unitPriceKrw: Number(body.unitPriceKrw),
      stockQty: Number(body.stockQty),
      statusCode: body.status,
    },
    include: productInclude,
  });
  return NextResponse.json(serializeProduct(product));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const itemCount = await prisma.salesOrderItem.count({
    where: { productId: Number(id) },
  });
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `주문 품목 ${itemCount}건이 연결되어 삭제할 수 없습니다.` },
      { status: 400 },
    );
  }
  await prisma.product.delete({ where: { productId: Number(id) } });
  return NextResponse.json({ ok: true });
}
