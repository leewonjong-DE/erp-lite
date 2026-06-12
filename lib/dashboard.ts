import { prisma } from "@/lib/prisma";

type DashboardRow = {
  customer_count: number;
  product_count: number;
  order_count: number;
  low_stock_count: number;
  total_revenue: bigint;
  this_month: bigint;
  prev_month: bigint;
  reference_month: string;
  pending_count: bigint;
  pending_amount: bigint;
  active_customers: bigint;
  cancel_return_count: bigint;
  margin_revenue: bigint;
  margin_cost: bigint;
  completed_orders: bigint;
  monthly_revenue: Array<{ month: string; revenue: number; orders: number }>;
  status_counts: Array<{ status: string; count: number; amount: number }>;
  channel_revenue: Array<{ channel: string; revenue: number }>;
  payment_mix: Array<{ method: string; revenue: number; count: number }>;
  tier_revenue: Array<{ tier: string; revenue: number; customers: number }>;
  category_margin: Array<{ category: string; revenue: number; marginPct: number }>;
  top_customers: Array<{
    customerId: number;
    name: string;
    tier: string;
    revenue: number;
    orders: number;
  }>;
  top_products: Array<{
    productId: number;
    name: string;
    category: string;
    qty: number;
    revenue: number;
  }>;
  stock_alerts: Array<{
    productId: number;
    name: string;
    category: string;
    stockQty: number;
    sold90d: number;
    daysToStockout: number | null;
  }>;
  vip_inactive: Array<{ customerId: number; name: string; daysSince: number }>;
  stale_orders: Array<{
    orderNo: number;
    customerId: number;
    customerName: string;
    orderDate: string;
    daysPending: number;
    amount: number;
  }>;
  new_customers_90d: number;
  new_no_order: number;
  new_one_order_risk: number;
  new_repeat: number;
  new_first_buy: number;
  new_customer_watchlist: Array<{
    customerId: number;
    name: string;
    tier: string;
    joinDate: string;
    daysSinceJoin: number;
    orderCount: number;
    status: string;
    idleDays: number | null;
    lastOrderDate: string | null;
  }>;
};

export async function fetchDashboardRow(): Promise<DashboardRow> {
  const [row] = await prisma.$queryRaw<DashboardRow[]>`
    WITH ref AS (SELECT MAX(order_date) AS d FROM sales_orders),
    bounds AS (
      SELECT DATE_TRUNC('month', d) AS this_m,
             DATE_TRUNC('month', d) - INTERVAL '1 month' AS prev_m,
             TO_CHAR(DATE_TRUNC('month', d), 'YYYY-MM') AS reference_month
      FROM ref
    ),
    velocity AS (
      SELECT i.product_id, SUM(i.qty)::bigint AS sold_90d
      FROM sales_order_items i
      JOIN sales_orders o ON o.order_no = i.order_no
      CROSS JOIN ref
      WHERE o.order_date >= ref.d - INTERVAL '90 days'
        AND o.status_code NOT IN ('취소', '반품')
      GROUP BY i.product_id
    ),
    margin AS (
      SELECT COALESCE(SUM(i.amount_krw), 0)::bigint AS revenue,
             COALESCE(SUM(i.qty * p.unit_cost_krw), 0)::bigint AS cost,
             COUNT(DISTINCT o.order_no)::bigint AS completed_orders
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN sales_orders o ON o.order_no = i.order_no
      WHERE o.status_code = '배송완료'
    ),
    category_stats AS (
      SELECT c.name AS category,
             SUM(i.amount_krw)::bigint AS revenue,
             SUM(i.qty * p.unit_cost_krw)::bigint AS cost
      FROM sales_order_items i
      JOIN products p ON p.product_id = i.product_id
      JOIN product_categories c ON c.code = p.category_code
      JOIN sales_orders o ON o.order_no = i.order_no
      WHERE o.status_code = '배송완료'
      GROUP BY c.name
      ORDER BY revenue DESC
      LIMIT 8
    ),
    new_customer_stats AS (
      SELECT c.customer_id, c.customer_name, t.name AS tier, c.join_date,
             (ref.d - c.join_date)::int AS days_since_join,
             COALESCE(os.order_count, 0) AS order_count,
             os.first_order, os.last_order,
             CASE
               WHEN COALESCE(os.order_count, 0) = 0 THEN '미주문'
               WHEN os.order_count = 1 AND (ref.d - os.last_order) >= 30 THEN '재구매대기'
               WHEN os.order_count = 1 THEN '첫구매'
               ELSE '재구매'
             END AS status,
             CASE
               WHEN COALESCE(os.order_count, 0) = 0 THEN (ref.d - c.join_date)::int
               WHEN os.order_count = 1 THEN (ref.d - os.last_order)::int
               ELSE NULL
             END AS idle_days
      FROM customers c
      JOIN customer_tiers t ON t.code = c.tier_code
      CROSS JOIN ref
      LEFT JOIN (
        SELECT o.customer_id,
               COUNT(*) FILTER (WHERE o.status_code NOT IN ('취소', '반품')) AS order_count,
               MIN(o.order_date) AS first_order,
               MAX(o.order_date) AS last_order
        FROM sales_orders o
        JOIN customers c2 ON c2.customer_id = o.customer_id
        WHERE o.order_date >= c2.join_date
        GROUP BY o.customer_id
      ) os ON os.customer_id = c.customer_id
      WHERE c.join_date >= ref.d - INTERVAL '90 days'
    )
    SELECT
      (SELECT COUNT(*)::int FROM customers) AS customer_count,
      (SELECT COUNT(*)::int FROM products) AS product_count,
      (SELECT COUNT(*)::int FROM sales_orders) AS order_count,
      (SELECT COUNT(*)::int FROM products WHERE stock_qty < 50) AS low_stock_count,
      (SELECT COALESCE(SUM(total_amount_krw), 0)::bigint FROM sales_orders
       WHERE status_code NOT IN ('취소', '반품')) AS total_revenue,
      (SELECT COALESCE(SUM(o.total_amount_krw), 0)::bigint FROM sales_orders o, bounds b
       WHERE DATE_TRUNC('month', o.order_date) = b.this_m
         AND o.status_code NOT IN ('취소', '반품')) AS this_month,
      (SELECT COALESCE(SUM(o.total_amount_krw), 0)::bigint FROM sales_orders o, bounds b
       WHERE DATE_TRUNC('month', o.order_date) = b.prev_m
         AND o.status_code NOT IN ('취소', '반품')) AS prev_month,
      (SELECT reference_month FROM bounds) AS reference_month,
      (SELECT COUNT(*)::bigint FROM sales_orders
       WHERE status_code IN ('주문접수', '결제완료', '배송중')) AS pending_count,
      (SELECT COALESCE(SUM(total_amount_krw), 0)::bigint FROM sales_orders
       WHERE status_code IN ('주문접수', '결제완료', '배송중')) AS pending_amount,
      (SELECT COUNT(DISTINCT o.customer_id)::bigint FROM sales_orders o, ref
       WHERE o.order_date >= ref.d - INTERVAL '90 days'
         AND o.status_code NOT IN ('취소', '반품')) AS active_customers,
      (SELECT COUNT(*)::bigint FROM sales_orders
       WHERE status_code IN ('취소', '반품')) AS cancel_return_count,
      (SELECT revenue FROM margin) AS margin_revenue,
      (SELECT cost FROM margin) AS margin_cost,
      (SELECT completed_orders FROM margin) AS completed_orders,
      (
        SELECT COALESCE(json_agg(t ORDER BY month), '[]'::json)
        FROM (
          SELECT TO_CHAR(order_date, 'YYYY-MM') AS month,
                 SUM(total_amount_krw)::bigint AS revenue,
                 COUNT(*)::int AS orders
          FROM sales_orders
          WHERE status_code NOT IN ('취소', '반품')
          GROUP BY 1
        ) t
      ) AS monthly_revenue,
      (
        SELECT COALESCE(json_agg(t ORDER BY sort_order), '[]'::json)
        FROM (
          SELECT s.code AS status, s.sort_order,
                 COUNT(o.order_no)::int AS count,
                 COALESCE(SUM(o.total_amount_krw), 0)::bigint AS amount
          FROM order_statuses s
          LEFT JOIN sales_orders o ON o.status_code = s.code
          GROUP BY s.code, s.sort_order
        ) t
      ) AS status_counts,
      (
        SELECT COALESCE(json_agg(t ORDER BY revenue DESC), '[]'::json)
        FROM (
          SELECT channel_code AS channel,
                 SUM(total_amount_krw)::bigint AS revenue
          FROM sales_orders
          WHERE status_code = '배송완료'
          GROUP BY channel_code
        ) t
      ) AS channel_revenue,
      (
        SELECT COALESCE(json_agg(t ORDER BY revenue DESC), '[]'::json)
        FROM (
          SELECT payment_method_code AS method,
                 SUM(total_amount_krw)::bigint AS revenue,
                 COUNT(*)::int AS count
          FROM sales_orders
          WHERE status_code = '배송완료'
          GROUP BY payment_method_code
        ) t
      ) AS payment_mix,
      (
        SELECT COALESCE(json_agg(t ORDER BY sort_order), '[]'::json)
        FROM (
          SELECT t.name AS tier, t.sort_order,
                 SUM(o.total_amount_krw)::bigint AS revenue,
                 COUNT(DISTINCT c.customer_id)::int AS customers
          FROM sales_orders o
          JOIN customers c ON c.customer_id = o.customer_id
          JOIN customer_tiers t ON t.code = c.tier_code
          WHERE o.status_code = '배송완료'
          GROUP BY t.name, t.sort_order
        ) t
      ) AS tier_revenue,
      (
        SELECT COALESCE(json_agg(
          json_build_object(
            'category', category,
            'revenue', revenue::float8,
            'marginPct', CASE WHEN revenue > 0
              THEN ROUND(((revenue - cost)::numeric / revenue) * 1000) / 10
              ELSE 0 END
          ) ORDER BY revenue DESC
        ), '[]'::json)
        FROM category_stats
      ) AS category_margin,
      (
        SELECT COALESCE(json_agg(t ORDER BY revenue DESC), '[]'::json)
        FROM (
          SELECT c.customer_id AS "customerId", c.customer_name AS name, ct.name AS tier,
                 SUM(o.total_amount_krw)::bigint AS revenue,
                 COUNT(*)::int AS orders
          FROM sales_orders o
          JOIN customers c ON c.customer_id = o.customer_id
          JOIN customer_tiers ct ON ct.code = c.tier_code
          WHERE o.status_code = '배송완료'
          GROUP BY c.customer_id, c.customer_name, ct.name
          ORDER BY revenue DESC
          LIMIT 10
        ) t
      ) AS top_customers,
      (
        SELECT COALESCE(json_agg(t ORDER BY revenue DESC), '[]'::json)
        FROM (
          SELECT p.product_id AS "productId", p.product_name AS name, c.name AS category,
                 SUM(i.qty)::int AS qty,
                 SUM(i.amount_krw)::bigint AS revenue
          FROM sales_order_items i
          JOIN products p ON p.product_id = i.product_id
          JOIN product_categories c ON c.code = p.category_code
          JOIN sales_orders o ON o.order_no = i.order_no
          WHERE o.status_code = '배송완료'
          GROUP BY p.product_id, p.product_name, c.name
          ORDER BY revenue DESC
          LIMIT 10
        ) t
      ) AS top_products,
      (
        SELECT COALESCE(json_agg(t ORDER BY "daysToStockout" NULLS LAST, "stockQty"), '[]'::json)
        FROM (
          SELECT p.product_id AS "productId", p.product_name AS name, c.name AS category,
                 p.stock_qty AS "stockQty",
                 COALESCE(v.sold_90d, 0)::int AS "sold90d",
                 CASE WHEN COALESCE(v.sold_90d, 0) > 0
                      THEN ROUND(p.stock_qty / (v.sold_90d::numeric / 90))::int
                      ELSE NULL END AS "daysToStockout"
          FROM products p
          JOIN product_categories c ON c.code = p.category_code
          LEFT JOIN velocity v ON v.product_id = p.product_id
          WHERE p.stock_qty < 50
             OR (v.sold_90d > 0 AND p.stock_qty / (v.sold_90d::numeric / 90) < 30)
          ORDER BY "daysToStockout" NULLS LAST, "stockQty"
          LIMIT 10
        ) t
      ) AS stock_alerts,
      (
        SELECT COALESCE(json_agg(t ORDER BY "daysSince" DESC), '[]'::json)
        FROM (
          SELECT c.customer_id AS "customerId", c.customer_name AS name,
                 CASE WHEN MAX(o.order_date) IS NULL THEN 9999
                      ELSE (ref.d - MAX(o.order_date))::int END AS "daysSince"
          FROM customers c
          CROSS JOIN ref
          LEFT JOIN sales_orders o ON o.customer_id = c.customer_id
            AND o.status_code NOT IN ('취소', '반품')
          WHERE c.tier_code = 'VIP'
          GROUP BY c.customer_id, c.customer_name, ref.d
          HAVING MAX(o.order_date) IS NULL OR MAX(o.order_date) < ref.d - INTERVAL '180 days'
          ORDER BY "daysSince" DESC
          LIMIT 8
        ) t
      ) AS vip_inactive,
      (
        SELECT COALESCE(json_agg(t ORDER BY "orderDate"), '[]'::json)
        FROM (
          SELECT o.order_no AS "orderNo", c.customer_id AS "customerId",
                 c.customer_name AS "customerName",
                 o.order_date::text AS "orderDate",
                 (ref.d - o.order_date)::int AS "daysPending",
                 o.total_amount_krw::bigint AS amount
          FROM sales_orders o
          JOIN customers c ON c.customer_id = o.customer_id
          CROSS JOIN ref
          WHERE o.status_code = '주문접수'
            AND o.order_date < ref.d - INTERVAL '7 days'
          ORDER BY o.order_date
          LIMIT 8
        ) t
      ) AS stale_orders,
      (SELECT COUNT(*)::int FROM new_customer_stats) AS new_customers_90d,
      (SELECT COUNT(*)::int FROM new_customer_stats WHERE status = '미주문') AS new_no_order,
      (SELECT COUNT(*)::int FROM new_customer_stats WHERE status = '재구매대기') AS new_one_order_risk,
      (SELECT COUNT(*)::int FROM new_customer_stats WHERE status = '재구매') AS new_repeat,
      (SELECT COUNT(*)::int FROM new_customer_stats WHERE status = '첫구매') AS new_first_buy,
      (
        SELECT COALESCE(json_agg(t ORDER BY priority, "idleDays" DESC NULLS LAST), '[]'::json)
        FROM (
          SELECT customer_id AS "customerId", customer_name AS name, tier,
                 join_date::text AS "joinDate",
                 days_since_join AS "daysSinceJoin",
                 order_count AS "orderCount",
                 status,
                 idle_days AS "idleDays",
                 last_order::text AS "lastOrderDate",
                 CASE status WHEN '재구매대기' THEN 1 WHEN '미주문' THEN 2 ELSE 3 END AS priority
          FROM new_customer_stats
          WHERE status IN ('미주문', '재구매대기')
            AND (status = '재구매대기' OR days_since_join >= 7)
          ORDER BY priority, idle_days DESC NULLS LAST
          LIMIT 12
        ) t
      ) AS new_customer_watchlist
  `;

  if (!row) {
    throw new Error("Dashboard query returned no data");
  }

  return row;
}
