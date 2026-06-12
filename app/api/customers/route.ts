import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { customerInclude, serializeCustomer } from "@/lib/serialize";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const search = searchParams.get("search") ?? "";
  const customerType = searchParams.get("customerType") ?? "";
  const tier = searchParams.get("tier") ?? "";
  const customerId = searchParams.get("customerId") ?? "";

  const where = {
    ...(customerId ? { customerId: Number(customerId) } : {}),
    ...(search
      ? {
          OR: [
            { customerName: { contains: search, mode: "insensitive" as const } },
            { city: { name: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}),
    ...(customerType ? { customerTypeCode: customerType } : {}),
    ...(tier ? { tierCode: tier } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { customerId: "asc" },
      include: customerInclude,
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({
    data: rows.map(serializeCustomer),
    total,
    page,
    limit,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const row = await prisma.customer.create({
    data: {
      customerId: Number(body.customerId),
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
  return NextResponse.json(serializeCustomer(row), { status: 201 });
}
