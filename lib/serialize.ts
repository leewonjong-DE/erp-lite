import type {
  Customer,
  CustomerTier,
  CustomerType,
  City,
  Product,
  ProductCategory,
  Brand,
  ProductStatus,
  SalesOrder,
  SalesOrderItem,
} from "@prisma/client";

type CustomerWithRelations = Customer & {
  customerType?: CustomerType;
  tier?: CustomerTier;
  city?: City;
};

type ProductWithRelations = Product & {
  category?: ProductCategory;
  brand?: Brand;
  productStatus?: ProductStatus;
};

type OrderWithRelations = SalesOrder & {
  customer?: CustomerWithRelations;
  orderStatus?: { name: string; code: string };
  salesChannel?: { name: string; code: string };
  paymentMethod?: { name: string; code: string };
  items?: Array<
    SalesOrderItem & {
      product?: ProductWithRelations;
    }
  >;
};

export function serializeCustomer(customer: CustomerWithRelations) {
  const { customerTypeCode, tierCode, cityCode, customerType, tier, city, ...rest } =
    customer;
  return {
    ...rest,
    customerType: customerType?.name ?? customerTypeCode,
    tier: tier?.name ?? tierCode,
    city: city?.name ?? cityCode,
  };
}

export function serializeProduct(product: ProductWithRelations) {
  const { categoryCode, brandCode, statusCode, category, brand, productStatus, ...rest } =
    product;
  return {
    ...rest,
    category: category?.name ?? categoryCode,
    brand: brand?.name ?? brandCode,
    status: productStatus?.name ?? statusCode,
  };
}

export function serializeOrder(order: OrderWithRelations) {
  const {
    statusCode,
    channelCode,
    paymentMethodCode,
    orderStatus,
    salesChannel,
    paymentMethod,
    customer,
    items,
    ...rest
  } = order;
  return {
    ...rest,
    status: orderStatus?.name ?? statusCode,
    channel: salesChannel?.name ?? channelCode,
    paymentMethod: paymentMethod?.name ?? paymentMethodCode,
    customer: customer ? serializeCustomer(customer) : undefined,
    items: items?.map((item) => ({
      ...item,
      product: item.product ? serializeProduct(item.product) : undefined,
    })),
  };
}

export const customerInclude = {
  customerType: true,
  tier: true,
  city: true,
} as const;

export const productInclude = {
  category: true,
  brand: true,
  productStatus: true,
} as const;

export const orderInclude = {
  customer: { include: customerInclude },
  orderStatus: true,
  salesChannel: true,
  paymentMethod: true,
  items: { include: { product: { include: productInclude } } },
} as const;

export const orderListInclude = {
  customer: { include: { tier: true } },
  orderStatus: true,
  salesChannel: true,
  paymentMethod: true,
  _count: { select: { items: true } },
} as const;

export function serializeOrderListItem(
  order: SalesOrder & {
    customer: Customer & { tier?: CustomerTier };
    orderStatus?: { name: string; code?: string };
    salesChannel?: { name: string; code?: string };
    paymentMethod?: { name: string; code?: string };
    _count: { items: number };
  },
) {
  return {
    orderNo: order.orderNo,
    customerId: order.customerId,
    orderDate: order.orderDate,
    status: order.orderStatus?.name ?? order.statusCode,
    channel: order.salesChannel?.name ?? order.channelCode,
    paymentMethod: order.paymentMethod?.name ?? order.paymentMethodCode,
    totalAmountKrw: order.totalAmountKrw,
    customer: {
      customerName: order.customer.customerName,
      tier: order.customer.tier?.name ?? order.customer.tierCode,
    },
    _count: order._count,
  };
}
