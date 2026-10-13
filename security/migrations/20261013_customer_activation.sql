-- Mucho Svapo Club: activation codes issued exclusively by verified cashier account.
-- Apply only after frontend has been tested, BEFORE publishing the new frontend.
-- This migration does NOT modify existing customers, PINs, points, or transactions.
-- Phase 2 (revoke legacy set_customer_pin) occurs ONLY AFTER production frontend is READY.

CREATE TABLE IF NOT EXISTS public.customer_activations (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_activations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_activations FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.find_customer_for_cashier(p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE c public.customers;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'email', '') <> 'svapowebsecondigliano@gmail.com' THEN
    RAISE EXCEPTION 'Operatore non autorizzato';
  END IF;
  IF p_phone IS NULL OR length(regexp_replace(p_phone, '[^0-9]', '', 'g')) NOT BETWEEN 8 AND 15 THEN
    RAISE EXCEPTION 'Numero non valido';
  END IF;
  SELECT * INTO c FROM public.customers
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g');
  IF NOT FOUND THEN RAISE EXCEPTION 'Tessera non trovata'; END IF;
  RETURN jsonb_build_object('id', c.id, 'full_name', c.full_name, 'phone', c.phone,
    'points_balance', coalesce(c.points_balance, 0), 'pin_configured', c.pin_hash IS NOT NULL);
END;
$function$;

CREATE OR REPLACE FUNCTION public.issue_customer_activation(p_customer_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE code text; pin_exists boolean;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'email', '') <> 'svapowebsecondigliano@gmail.com' THEN
    RAISE EXCEPTION 'Operatore non autorizzato';
  END IF;
  SELECT (pin_hash IS NOT NULL) INTO pin_exists FROM public.customers
  WHERE id = p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tessera non trovata'; END IF;
  IF pin_exists THEN RAISE EXCEPTION 'La tessera ha già un PIN'; END IF;
  code := upper(encode(extensions.gen_random_bytes(6), 'hex'));
  INSERT INTO public.customer_activations(customer_id, code_hash, expires_at, attempts, created_at)
  VALUES (p_customer_id, encode(extensions.digest(code, 'sha256'), 'hex'), now() + interval '15 minutes', 0, now())
  ON CONFLICT (customer_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
    expires_at = EXCLUDED.expires_at, attempts = 0, created_at = now();
  RETURN code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.activate_customer_pin(p_phone text, p_pin text, p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE c public.customers; a public.customer_activations;
BEGIN
  IF p_phone IS NULL OR p_pin IS NULL OR p_code IS NULL
     OR p_pin !~ '^[0-9]{4}$' OR upper(trim(p_code)) !~ '^[0-9A-F]{12}$' THEN
    RAISE EXCEPTION 'Dati di attivazione non validi';
  END IF;
  SELECT * INTO c FROM public.customers
  WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace(p_phone, '[^0-9]', '', 'g')
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dati di attivazione non validi'; END IF;
  IF c.pin_hash IS NOT NULL THEN RAISE EXCEPTION 'PIN già configurato'; END IF;

  SELECT * INTO a FROM public.customer_activations
  WHERE customer_id = c.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Richiedi un codice alla cassa'; END IF;
  IF a.expires_at < now() OR a.attempts >= 5 THEN
    RAISE EXCEPTION 'Codice scaduto o bloccato: richiedine uno nuovo alla cassa';
  END IF;
  IF a.code_hash <> encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex') THEN
    UPDATE public.customer_activations SET attempts = attempts + 1 WHERE customer_id = c.id;
    -- Note: no RAISE here: PostgreSQL rolls back attempts on exceptions.
    RETURN jsonb_build_object('success', false, 'message', 'Codice non valido', 'attempts_remaining', 4 - a.attempts);
  END IF;
  UPDATE public.customers
  SET pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  WHERE id = c.id AND pin_hash IS NULL;
  DELETE FROM public.customer_activations WHERE customer_id = c.id;
  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.find_customer_for_cashier(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_customer_for_cashier(text) TO authenticated;
REVOKE ALL ON FUNCTION public.issue_customer_activation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_customer_activation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.activate_customer_pin(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_customer_pin(text, text, text) TO anon, authenticated;
