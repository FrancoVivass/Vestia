-- ============================================================
-- 028_reports_analytics.sql
-- Funciones de análisis para la página de reportes
-- ============================================================

-- ============================================================
-- Resumen ejecutivo del período
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sales_summary(p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_sales', (
      SELECT COALESCE(SUM(s.total), 0)
      FROM public.sales s
      WHERE s.business_id = public.current_business_id()
        AND s.status <> 'CANCELLED'
        AND s.created_at::date BETWEEN p_from AND p_to
    ),
    'total_cost', (
      SELECT COALESCE(SUM(
        (ai.quantity - COALESCE(ret.qty, 0)) * ai.unit_cost
      ), 0)
      FROM public.sales s
      JOIN public.sale_items si ON si.sale_id = s.id
      JOIN public.sale_item_allocations ai ON ai.sale_item_id = si.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(ri.quantity), 0) AS qty
        FROM public.return_items ri
        WHERE ri.sale_item_allocation_id = ai.id
      ) ret ON true
      WHERE s.business_id = public.current_business_id()
        AND s.status <> 'CANCELLED'
        AND s.created_at::date BETWEEN p_from AND p_to
    ),
    'total_returns', (
      SELECT COALESCE(SUM(ri.quantity * (si.subtotal / NULLIF(si.quantity, 0))), 0)
      FROM public.return_items ri
      JOIN public.sale_item_allocations sia ON sia.id = ri.sale_item_allocation_id
      JOIN public.sale_items si ON si.id = sia.sale_item_id
      JOIN public.sales s ON s.id = si.sale_id
      JOIN public.returns r ON r.id = ri.return_id
      WHERE s.business_id = public.current_business_id()
        AND r.created_at::date BETWEEN p_from AND p_to
    ),
    'total_expenses', (
      SELECT COALESCE(SUM(ABS(e.amount)), 0)
      FROM public.expenses e
      WHERE e.business_id = public.current_business_id()
        AND e.occurred_at::date BETWEEN p_from AND p_to
    ),
    'sale_count', (
      SELECT COUNT(*)::int
      FROM public.sales s
      WHERE s.business_id = public.current_business_id()
        AND s.status <> 'CANCELLED'
        AND s.created_at::date BETWEEN p_from AND p_to
    ),
    'total_units', (
      SELECT COALESCE(SUM(si.quantity), 0)
      FROM public.sales s
      JOIN public.sale_items si ON si.sale_id = s.id
      WHERE s.business_id = public.current_business_id()
        AND s.status <> 'CANCELLED'
        AND s.created_at::date BETWEEN p_from AND p_to
    ),
    'avg_ticket', (
      SELECT COALESCE(AVG(s.total), 0)
      FROM public.sales s
      WHERE s.business_id = public.current_business_id()
        AND s.status <> 'CANCELLED'
        AND s.created_at::date BETWEEN p_from AND p_to
    )
  );
$$;

-- ============================================================
-- Ventas por día (para gráfico de barras)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sales_by_day(p_from DATE, p_to DATE)
RETURNS TABLE (sale_date DATE, amount NUMERIC, count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.created_at::date AS sale_date,
    COALESCE(SUM(s.total), 0) AS amount,
    COUNT(*)::int AS count
  FROM public.sales s
  WHERE s.business_id = public.current_business_id()
    AND s.status <> 'CANCELLED'
    AND s.created_at::date BETWEEN p_from AND p_to
  GROUP BY s.created_at::date
  ORDER BY s.created_at::date;
$$;

-- ============================================================
-- Top productos más vendidos
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_top_products(p_from DATE, p_to DATE, p_limit INT DEFAULT 10)
RETURNS TABLE (
  product_name TEXT,
  variant_name TEXT,
  total_quantity INT,
  total_revenue NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.name AS product_name,
    pv.name AS variant_name,
    SUM(si.quantity)::int AS total_quantity,
    SUM(si.subtotal) AS total_revenue
  FROM public.sales s
  JOIN public.sale_items si ON si.sale_id = s.id
  JOIN public.product_variants pv ON pv.id = si.variant_id
  JOIN public.products p ON p.id = pv.product_id
  WHERE s.business_id = public.current_business_id()
    AND s.status <> 'CANCELLED'
    AND s.created_at::date BETWEEN p_from AND p_to
  GROUP BY p.name, pv.name
  ORDER BY total_quantity DESC
  LIMIT p_limit;
$$;

-- ============================================================
-- Ventas por método de pago
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_sales_by_payment_method(p_from DATE, p_to DATE)
RETURNS TABLE (method_name TEXT, amount NUMERIC, count INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(pm.name, 'Sin especificar') AS method_name,
    COALESCE(SUM(sp.amount), 0) AS amount,
    COUNT(*)::int AS count
  FROM public.sale_payments sp
  JOIN public.sales s ON s.id = sp.sale_id
  LEFT JOIN public.payment_methods pm ON pm.id = sp.payment_method_id
  WHERE s.business_id = public.current_business_id()
    AND s.status <> 'CANCELLED'
    AND s.created_at::date BETWEEN p_from AND p_to
  GROUP BY pm.name
  ORDER BY amount DESC;
$$;

-- ============================================================
-- Alertas de stock (productos con stock bajo o agotado)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_stock_alerts()
RETURNS TABLE (
  product_name TEXT,
  variant_name TEXT,
  sku TEXT,
  quantity INT,
  minimum_stock INT,
  status TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.name AS product_name,
    pv.name AS variant_name,
    pv.sku,
    COALESCE(ib.quantity, 0) AS quantity,
    pv.minimum_stock,
    CASE
      WHEN COALESCE(ib.quantity, 0) = 0 THEN 'Agotado'
      WHEN COALESCE(ib.quantity, 0) <= pv.minimum_stock THEN 'Bajo'
      ELSE 'OK'
    END AS status
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  LEFT JOIN public.inventory_balances ib ON ib.variant_id = pv.id AND ib.business_id = public.current_business_id()
  WHERE pv.business_id = public.current_business_id()
    AND pv.active = true
    AND COALESCE(ib.quantity, 0) <= pv.minimum_stock
  ORDER BY ib.quantity ASC NULLS FIRST;
$$;

-- ============================================================
-- Resumen de cajas (últimos cierres)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_cash_summary(p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_openings', (
      SELECT COUNT(*)::int
      FROM public.cash_sessions cs
      WHERE cs.business_id = public.current_business_id()
        AND cs.opened_at::date BETWEEN p_from AND p_to
    ),
    'total_sales', (
      SELECT COALESCE(SUM(cs.counted_amount), 0)
      FROM public.cash_sessions cs
      WHERE cs.business_id = public.current_business_id()
        AND cs.status = 'CLOSED'
        AND cs.closed_at::date BETWEEN p_from AND p_to
    ),
    'total_differences', (
      SELECT COALESCE(SUM(ABS(cs.difference)), 0)
      FROM public.cash_sessions cs
      WHERE cs.business_id = public.current_business_id()
        AND cs.status = 'CLOSED'
        AND cs.closed_at::date BETWEEN p_from AND p_to
    )
  );
$$;

-- Permisos
GRANT EXECUTE ON FUNCTION public.get_sales_summary(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_by_day(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_top_products(DATE, DATE, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sales_by_payment_method(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stock_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cash_summary(DATE, DATE) TO authenticated;
