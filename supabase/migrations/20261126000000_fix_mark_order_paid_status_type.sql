-- orders.status is a text column on the plain-Postgres database, but mark_order_paid
-- returned 'processing'::order_status from its CASE. Postgres cannot mix text and the
-- enum in one CASE, so every call failed ("CASE types text and order_status cannot be
-- matched") and no Moolre payment could mark an order paid. Same logic, text values.

CREATE OR REPLACE FUNCTION public.mark_order_paid(order_ref text, moolre_ref text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET
    payment_status = 'paid',
    status = CASE
        WHEN status::text IN ('pending', 'awaiting_payment') THEN 'processing'
        ELSE status::text
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order.id IS NOT NULL THEN
      IF (updated_order.metadata->>'stock_reduced') IS NULL THEN
          UPDATE products p
          SET quantity = GREATEST(0, p.quantity - oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND oi.product_id = p.id;

          UPDATE product_variants pv
          SET quantity = GREATEST(0, pv.quantity - oi.quantity)
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND (
              (oi.variant_id IS NOT NULL AND oi.variant_id = pv.id)
              OR (
                oi.variant_id IS NULL
                AND oi.product_id = pv.product_id
                AND oi.variant_name IS NOT NULL
                AND oi.variant_name = pv.name
              )
            );

          UPDATE orders
          SET metadata = metadata || '{"stock_reduced": true}'::jsonb
          WHERE id = updated_order.id;
      END IF;
  ELSE
      SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$function$;
