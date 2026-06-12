import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const search = searchParams.get("search") ?? "";
  const customerType = searchParams.get("customerType") ?? "";
  const tier = searchParams.get("tier") ?? "";

  const where = {
    ...(search
      ? {
          OR: [
            { customerName: { contains: search, mode: "insensitive" as const } },
            { city: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(customerType ? { customerType } : {}),
    ...(tier ? { tier } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { customerId: "asc" },
    }),
    prisma.customer.count({ where }),
  ]);

  return NextResponse.json({ data, total, page, limit });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const customer = await prisma.customer.create({
    data: {
      customerId: Number(body.customerId),
      customerName: body.customerName,
      customerType: body.customerType,
      city: body.city,
      phone: body.phone,
      email: body.email,
      joinDate: new Date(body.joinDate),
      tier: body.tier,
    },
  });
  return NextResponse.json(customer, { status: 201 });
}
