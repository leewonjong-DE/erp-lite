import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = content.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

async function seedMasters(
  customers: Record<string, string>[],
  products: Record<string, string>[],
  orders: Record<string, string>[],
) {
  const customerTypes = unique(customers.map((r) => r.customer_type));
  const tiers = unique(customers.map((r) => r.tier));
  const cities = unique(customers.map((r) => r.city));
  const categories = unique(products.map((r) => r.category));
  const brands = unique(products.map((r) => r.brand));
  const productStatuses = unique(products.map((r) => r.status));
  const orderStatuses = unique(orders.map((r) => r.status));
  const channels = unique(orders.map((r) => r.channel));
  const paymentMethods = unique(orders.map((r) => r.payment_method));

  await prisma.customerType.createMany({
    data: customerTypes.map((code, i) => ({ code, name: code, sortOrder: i })),
  });
  await prisma.customerTier.createMany({
    data: tiers.map((code, i) => ({ code, name: code, sortOrder: i })),
  });
  await prisma.city.createMany({
    data: cities.map((code) => ({ code, name: code })),
  });
  await prisma.productCategory.createMany({
    data: categories.map((code) => ({ code, name: code })),
  });
  await prisma.brand.createMany({
    data: brands.map((code) => ({ code, name: code })),
  });
  await prisma.productStatus.createMany({
    data: productStatuses.map((code) => ({ code, name: code })),
  });
  await prisma.orderStatus.createMany({
    data: orderStatuses.map((code, i) => ({ code, name: code, sortOrder: i })),
  });
  await prisma.salesChannel.createMany({
    data: channels.map((code) => ({ code, name: code })),
  });
  await prisma.paymentMethod.createMany({
    data: paymentMethods.map((code) => ({ code, name: code })),
  });

  console.log(`Seeded masters: types=${customerTypes.length}, tiers=${tiers.length}, cities=${cities.length}`);
}

async function main() {
  const dataDir = path.join(__dirname, "..", "data");
  const customers = parseCsv(path.join(dataDir, "customers.csv"));
  const products = parseCsv(path.join(dataDir, "products.csv"));
  const orders = parseCsv(path.join(dataDir, "sales_orders.csv"));
  const items = parseCsv(path.join(dataDir, "sales_order_items.csv"));

  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.paymentMethod.deleteMany();
  await prisma.salesChannel.deleteMany();
  await prisma.orderStatus.deleteMany();
  await prisma.productStatus.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.city.deleteMany();
  await prisma.customerTier.deleteMany();
  await prisma.customerType.deleteMany();

  await seedMasters(customers, products, orders);

  await prisma.customer.createMany({
    data: customers.map((row) => ({
      customerId: Number(row.customer_id),
      customerName: row.customer_name,
      customerTypeCode: row.customer_type,
      cityCode: row.city,
      phone: row.phone,
      email: row.email,
      joinDate: new Date(row.join_date),
      tierCode: row.tier,
    })),
  });

  await prisma.product.createMany({
    data: products.map((row) => ({
      productId: Number(row.product_id),
      productName: row.product_name,
      categoryCode: row.category,
      brandCode: row.brand,
      unitCostKrw: Number(row.unit_cost_krw),
      unitPriceKrw: Number(row.unit_price_krw),
      stockQty: Number(row.stock_qty),
      statusCode: row.status,
    })),
  });

  await prisma.salesOrder.createMany({
    data: orders.map((row) => ({
      orderNo: Number(row.order_no),
      customerId: Number(row.customer_id),
      orderDate: new Date(row.order_date),
      statusCode: row.status,
      channelCode: row.channel,
      paymentMethodCode: row.payment_method,
      totalAmountKrw: Number(row.total_amount_krw),
    })),
  });

  const batchSize = 500;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await prisma.salesOrderItem.createMany({
      data: batch.map((row) => ({
        orderItemId: Number(row.order_item_id),
        orderNo: Number(row.order_no),
        productId: Number(row.product_id),
        qty: Number(row.qty),
        unitPriceKrw: Number(row.unit_price_krw),
        discountPct: Number(row.discount_pct),
        amountKrw: Number(row.amount_krw),
      })),
    });
  }

  console.log(`Seeded ${customers.length} customers`);
  console.log(`Seeded ${products.length} products`);
  console.log(`Seeded ${orders.length} orders`);
  console.log(`Seeded ${items.length} order items`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
