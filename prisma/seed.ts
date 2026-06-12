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

async function main() {
  const dataDir = path.join(__dirname, "..", "data");

  await prisma.salesOrderItem.deleteMany();
  await prisma.salesOrder.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  const customers = parseCsv(path.join(dataDir, "customers.csv"));
  await prisma.customer.createMany({
    data: customers.map((row) => ({
      customerId: Number(row.customer_id),
      customerName: row.customer_name,
      customerType: row.customer_type,
      city: row.city,
      phone: row.phone,
      email: row.email,
      joinDate: new Date(row.join_date),
      tier: row.tier,
    })),
  });

  const products = parseCsv(path.join(dataDir, "products.csv"));
  await prisma.product.createMany({
    data: products.map((row) => ({
      productId: Number(row.product_id),
      productName: row.product_name,
      category: row.category,
      brand: row.brand,
      unitCostKrw: Number(row.unit_cost_krw),
      unitPriceKrw: Number(row.unit_price_krw),
      stockQty: Number(row.stock_qty),
      status: row.status,
    })),
  });

  const orders = parseCsv(path.join(dataDir, "sales_orders.csv"));
  await prisma.salesOrder.createMany({
    data: orders.map((row) => ({
      orderNo: Number(row.order_no),
      customerId: Number(row.customer_id),
      orderDate: new Date(row.order_date),
      status: row.status,
      channel: row.channel,
      paymentMethod: row.payment_method,
      totalAmountKrw: Number(row.total_amount_krw),
    })),
  });

  const items = parseCsv(path.join(dataDir, "sales_order_items.csv"));
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
