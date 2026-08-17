-- ============================================================
-- 027_cash_close_reports.sql
-- Tabla de reportes de cierre + trigger automático
-- ============================================================

-- Tabla para persistir el snapshot al cerrar caja
CREATE TABLE IF NOT EXISTS public.cash_close_reports (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id     UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  cash_session_id UUID NOT NULL REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  closed_by       UUID,
  closed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Datos de apertura
  register_name   TEXT NOT NULL,
  opening_amount  NUMERIC NOT NULL DEFAULT 0,

  -- Snapshot del resumen
  expected_amount NUMERIC NOT NULL DEFAULT 0,
  counted_amount  NUMERIC NOT NULL DEFAULT 0,
  difference      NUMERIC NOT NULL DEFAULT 0,

  total_sales     NUMERIC NOT NULL DEFAULT 0,
  total_income    NUMERIC NOT NULL DEFAULT 0,
  total_expenses  NUMERIC NOT NULL DEFAULT 0,
  total_withdrawals NUMERIC NOT NULL DEFAULT 0,
  total_refunds   NUMERIC NOT NULL DEFAULT 0,

  -- Desglose de pagos como JSONB [{"name":"Efectivo","amount":1000}, ...]
  payments_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Notas del cierre
  notes           TEXT DEFAULT ''
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cash_close_reports_business
  ON public.cash_close_reports (business_id, closed_at DESC);

-- RLS
ALTER TABLE public.cash_close_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_close_reports_read"
  ON public.cash_close_reports FOR SELECT
  TO authenticated
  USING (business_id = public.current_business_id());

CREATE POLICY "cash_close_reports_insert"
  ON public.cash_close_reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- Función para generar el reporte de cierre automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_cash_close_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_summary JSONB;
  v_register_name TEXT;
BEGIN
  -- Solo al cerrar caja
  IF NEW.status = 'CLOSED' AND OLD.status = 'OPEN' THEN

    -- Nombre de la caja
    SELECT name INTO v_register_name
    FROM public.cash_registers
    WHERE id = NEW.cash_register_id;

    -- Calcular el resumen desde cash_movements
    SELECT jsonb_build_object(
      'opening', NEW.opening_amount,
      'expectedCash', NEW.opening_amount + coalesce(sum(case
        when movement.movement_type = 'SALE' and method.code = 'CASH' then movement.amount
        when movement.movement_type in ('INCOME','EXPENSE','WITHDRAWAL','REFUND','CLOSING_ADJUSTMENT') then movement.amount
        else 0 end), 0),
      'sales', coalesce(sum(movement.amount) filter(where movement.movement_type = 'SALE'), 0),
      'income', coalesce(sum(movement.amount) filter(where movement.movement_type = 'INCOME'), 0),
      'expenses', abs(coalesce(sum(movement.amount) filter(where movement.movement_type = 'EXPENSE'), 0)),
      'withdrawals', abs(coalesce(sum(movement.amount) filter(where movement.movement_type = 'WITHDRAWAL'), 0)),
      'refunds', abs(coalesce(sum(movement.amount) filter(where movement.movement_type = 'REFUND'), 0)),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object('name', grouped.name, 'amount', grouped.amount) order by grouped.name)
        from (
          select coalesce(pm.name, 'Sin especificar') as name, sum(cm.amount) as amount
          from public.cash_movements cm
          left join public.payment_methods pm on pm.id = cm.payment_method_id
          where cm.cash_session_id = NEW.id and cm.movement_type = 'SALE'
          group by coalesce(pm.name, 'Sin especificar')
        ) grouped
      ), '[]'::jsonb)
    ) INTO v_summary
    FROM public.cash_movements movement
    LEFT JOIN public.payment_methods method ON method.id = movement.payment_method_id
    WHERE movement.cash_session_id = NEW.id
    GROUP BY NEW.opening_amount;

    -- Insertar el reporte
    INSERT INTO public.cash_close_reports (
      business_id, cash_session_id, closed_by, closed_at,
      register_name, opening_amount,
      expected_amount, counted_amount, difference,
      total_sales, total_income, total_expenses, total_withdrawals, total_refunds,
      payments_breakdown, notes
    ) VALUES (
      NEW.business_id, NEW.id, NEW.closed_by, NEW.closed_at,
      COALESCE(v_register_name, 'Sin nombre'), NEW.opening_amount,
      COALESCE((v_summary ->> 'expectedCash')::numeric, 0),
      COALESCE(NEW.counted_amount, 0),
      COALESCE(NEW.difference, 0),
      COALESCE((v_summary ->> 'sales')::numeric, 0),
      COALESCE((v_summary ->> 'income')::numeric, 0),
      COALESCE((v_summary ->> 'expenses')::numeric, 0),
      COALESCE((v_summary ->> 'withdrawals')::numeric, 0),
      COALESCE((v_summary ->> 'refunds')::numeric, 0),
      COALESCE(v_summary -> 'payments', '[]'::jsonb),
      COALESCE(NEW.notes, '')
    );

  END IF;

  RETURN NEW;
END;
$$;

-- Trigger (se agrega al mismo evento que el de notificación)
DROP TRIGGER IF EXISTS trg_cash_session_close_report ON public.cash_sessions;
CREATE TRIGGER trg_cash_session_close_report
  AFTER UPDATE ON public.cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cash_close_report();

-- ============================================================
-- Función para obtener historial de reportes de cierre
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_cash_close_reports(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id              UUID,
  register_name   TEXT,
  closed_at       TIMESTAMPTZ,
  opening_amount  NUMERIC,
  expected_amount NUMERIC,
  counted_amount  NUMERIC,
  difference      NUMERIC,
  total_sales     NUMERIC,
  total_income    NUMERIC,
  total_expenses  NUMERIC,
  total_withdrawals NUMERIC,
  total_refunds   NUMERIC,
  payments_breakdown JSONB,
  notes           TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.register_name, r.closed_at,
         r.opening_amount, r.expected_amount, r.counted_amount, r.difference,
         r.total_sales, r.total_income, r.total_expenses, r.total_withdrawals, r.total_refunds,
         r.payments_breakdown, r.notes
  FROM public.cash_close_reports r
  WHERE r.business_id = public.current_business_id()
  ORDER BY r.closed_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
