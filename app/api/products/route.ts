import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productInclude, serializeProduct } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const search = searchParams.get("search") ?? "";
  const category = searchParams.get("category") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const status = searchParams.get("status") ?? "";
  const lowStock = searchParams.get("lowStock") === "true";

  const where = {
    ...(search
      ? {
          OR: [
            { productName: { contains: search, mode: "insensitive" as const } },
            { brand: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(category ? { categoryCode: category } : {}),
    ...(brand ? { brandCode: brand } : {}),
    ...(status ? { statusCode: status } : {}),
    ...(lowStock ? { stockQty: { lt: 50 } } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { productId: "asc" },
      include: productInclude,
    }),
    prisma.product.count({ where }),
  ]);

  return NextResponse.json({
    data: rows.map(serializeProduct),
    total,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const row = await prisma.product.create({
    data: {
      productId: Number(body.productId),
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
  return NextResponse.json(serializeProduct(row), { status: 201 });
}
