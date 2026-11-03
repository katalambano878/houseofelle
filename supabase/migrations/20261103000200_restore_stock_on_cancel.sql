-- Put stock back when a paid order is cancelled or refunded.
--
-- mark_order_paid takes stock off once and records metadata.stock_reduced; this
-- reverses it once (metadata.stock_restored) using the same product/variant match.

CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IN ('cancelled', 'refunded')
     AND OLD.status NOT IN ('cancelled', 'refunded')
     AND (NEW.metadata->>'stock_reduced') = 'true'
     AND (NEW.metadata->>'stock_restored') IS NULL THEN

    UPDATE products p
    SET quantity = p.quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;

    UPDATE product_variants pv
    SET quantity = pv.quantity + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND (
        (oi.variant_id IS NOT NULL AND oi.variant_id = pv.id)
        OR (
          oi.variant_id IS NULL
          AND oi.product_id = pv.product_id
          AND oi.variant_name IS NOT NULL
          AND oi.variant_name = pv.name
        )
      );

    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) ||
      jsonb_build_object('stock_restored', true, 'stock_restored_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_restore_stock_on_cancel ON public.orders;
CREATE TRIGGER orders_restore_stock_on_cancel
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_cancel();
