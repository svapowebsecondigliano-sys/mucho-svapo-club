-- Applied to Mucho Svapo Club production on 2026-10-13.
-- Non-destructive DDL: does not edit customers, point balances, or transactions.
-- SECURITY DEFINER RPCs are the only supported database access.
REVOKE ALL PRIVILEGES ON TABLE public.customers, public.transactions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.add_points(cust_id uuid, pts integer, amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR coalesce(auth.jwt() ->> 'email', '') <> 'svapowebsecondigliano@gmail.com' THEN
    RAISE EXCEPTION 'Operatore non autorizzato';
  END IF;

  IF amount IS NULL OR amount < 1 OR amount > 100000
     OR scale(amount) > 2 THEN
    RAISE EXCEPTION 'Importo non valido';
  END IF;

  IF pts IS NULL OR pts <= 0 OR pts <> floor(amount) THEN
    RAISE EXCEPTION 'I punti devono corrispondere agli euro interi spesi';
  END IF;

  UPDATE public.customers
  SET points_balance = coalesce(points_balance, 0) + pts
  WHERE id = cust_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente non trovato';
  END IF;

  INSERT INTO public.transactions(customer_id, amount_spent, points_earned, type)
  VALUES (cust_id, amount, pts, 'EARN');
END;
$function$;

REVOKE ALL ON FUNCTION public.add_points(uuid, integer, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_points(uuid, integer, numeric) TO authenticated;
