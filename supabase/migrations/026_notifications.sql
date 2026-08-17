-- ============================================================
-- 026_notifications.sql
-- Tabla de notificaciones + funciones para crear y marcar leídas
-- ============================================================

-- Tabla
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'info',        -- info, sale, cash, stock, alert
  entity_type TEXT,                                -- sale, cash_session, product, etc.
  entity_id   UUID,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_notifications_business_user
  ON public.notifications (business_id, user_id, read, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Los usuarios ven sus propias notificaciones del negocio activo
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND business_id = public.active_business_id()
  );

-- Solo el sistema inserta notificaciones (via SECURITY DEFINER functions)
CREATE POLICY "notifications_insert_system"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Los usuarios pueden marcar las suyas como leídas
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Función para crear una notificación
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_notification(
  p_business_id UUID,
  p_user_id     UUID,
  p_title       TEXT,
  p_message     TEXT DEFAULT '',
  p_type        TEXT DEFAULT 'info',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (business_id, user_id, title, message, type, entity_type, entity_id)
  VALUES (p_business_id, p_user_id, p_title, p_message, p_type, p_entity_type, p_entity_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- Función para crear notificación para TODOS los usuarios del negocio
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_business(
  p_business_id UUID,
  p_title       TEXT,
  p_message     TEXT DEFAULT '',
  p_type        TEXT DEFAULT 'info',
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id   UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (business_id, user_id, title, message, type, entity_type, entity_id)
  SELECT p_business_id, au.id, p_title, p_message, p_type, p_entity_type, p_entity_id
  FROM public.profiles pr
  JOIN auth.users au ON au.id = pr.user_id
  WHERE pr.business_id = p_business_id;
END;
$$;

-- ============================================================
-- Función para marcar notificación como leída
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE id = p_notification_id
    AND user_id = auth.uid();
END;
$$;

-- ============================================================
-- Función para marcar TODAS como leídas
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
  SET read = true
  WHERE user_id = auth.uid()
    AND read = false;
END;
$$;

-- ============================================================
-- Función para contar no leídas
-- ============================================================
CREATE OR REPLACE FUNCTION public.unread_notification_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND read = false;
$$;

-- ============================================================
-- Función para obtener notificaciones paginadas
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_notifications(p_limit INT DEFAULT 20, p_offset INT DEFAULT 0)
RETURNS TABLE (
  id          UUID,
  title       TEXT,
  message     TEXT,
  type        TEXT,
  entity_type TEXT,
  entity_id   UUID,
  read        BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT n.id, n.title, n.message, n.type, n.entity_type, n.entity_id, n.read, n.created_at
  FROM public.notifications n
  WHERE n.user_id = auth.uid()
  ORDER BY n.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================================
-- Generador automático de notificaciones al cerrar caja
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_cash_close_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile UUID;
  v_diff NUMERIC;
  v_msg TEXT;
BEGIN
  IF NEW.status = 'CLOSED' AND OLD.status = 'OPEN' THEN
    v_diff := COALESCE(NEW.difference, 0);

    IF v_diff = 0 THEN
      v_msg := 'Caja ' || (SELECT name FROM cash_registers WHERE id = NEW.cash_register_id) || ' cerrada. Diferencia: $0';
    ELSIF v_diff > 0 THEN
      v_msg := 'Caja ' || (SELECT name FROM cash_registers WHERE id = NEW.cash_register_id) || ' cerrada. Sobrante: $' || v_diff;
    ELSE
      v_msg := 'Caja ' || (SELECT name FROM cash_registers WHERE id = NEW.cash_register_id) || ' cerrada. Faltante: $' || ABS(v_diff);
    END IF;

    SELECT pr.id INTO v_profile
    FROM public.profiles pr
    WHERE pr.user_id = NEW.closed_by
    LIMIT 1;

    IF v_profile IS NOT NULL THEN
      INSERT INTO public.notifications (business_id, user_id, title, message, type, entity_type, entity_id)
      SELECT NEW.business_id, pr.id, 'Caja cerrada', v_msg, 'cash', 'cash_session', NEW.id
      FROM public.profiles pr
      WHERE pr.business_id = NEW.business_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_session_close_notification ON public.cash_sessions;
CREATE TRIGGER trg_cash_session_close_notification
  AFTER UPDATE ON public.cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cash_close_notification();

-- ============================================================
-- Generador automático de notificaciones al abrir caja
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_cash_open_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_msg TEXT;
BEGIN
  IF NEW.status = 'OPEN' THEN
    v_msg := 'Caja ' || (SELECT name FROM cash_registers WHERE id = NEW.cash_register_id) || ' abierta con $' || NEW.opening_amount;

    INSERT INTO public.notifications (business_id, user_id, title, message, type, entity_type, entity_id)
    SELECT NEW.business_id, pr.id, 'Caja abierta', v_msg, 'cash', 'cash_session', NEW.id
    FROM public.profiles pr
    WHERE pr.business_id = NEW.business_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cash_session_open_notification ON public.cash_sessions;
CREATE TRIGGER trg_cash_session_open_notification
  AFTER INSERT ON public.cash_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_cash_open_notification();

-- ============================================================
-- Generador automático de notificaciones al crear una venta
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_sale_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_customer TEXT;
BEGIN
  v_total := COALESCE(NEW.total, 0);
  v_customer := COALESCE((SELECT first_name || ' ' || last_name FROM customers WHERE id = NEW.customer_id), 'Consumidor final');

  INSERT INTO public.notifications (business_id, user_id, title, message, type, entity_type, entity_id)
  SELECT NEW.business_id, pr.id,
    'Nueva venta',
    'Venta por $' || v_total || ' a ' || v_customer,
    'sale',
    'sale',
    NEW.id
  FROM public.profiles pr
  WHERE pr.business_id = NEW.business_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sale_notification ON public.sales;
CREATE TRIGGER trg_sale_notification
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_sale_notification();
