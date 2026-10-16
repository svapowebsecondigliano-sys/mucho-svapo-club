-- Read-only paginated customer list. Operator-only, no points modification.
CREATE OR REPLACE FUNCTION public.list_customers_for_cashier(p_search text DEFAULT '', p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR coalesce(auth.jwt() ->> 'email', '') <> 'svapowebsecondigliano@gmail.com' THEN
    RAISE EXCEPTION 'Operatore non autorizzato';
  END IF;
  IF length(coalesce(p_search,'')) > 100 OR p_limit NOT BETWEEN 1 AND 100 OR p_offset < 0 OR p_offset > 100000 THEN
    RAISE EXCEPTION 'Parametri non validi';
  END IF;
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.customers c WHERE coalesce(p_search,'') = ''
      OR c.full_name ILIKE '%' || p_search || '%'
      OR c.phone LIKE '%' || p_search || '%'
      OR c.id::text ILIKE '%' || p_search || '%'),
    'customers', coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
      SELECT c.id, c.full_name, c.phone, c.points_balance
      FROM public.customers c
      WHERE coalesce(p_search,'') = '' OR c.full_name ILIKE '%' || p_search || '%'
        OR c.phone LIKE '%' || p_search || '%' OR c.id::text ILIKE '%' || p_search || '%'
      ORDER BY c.full_name, c.id LIMIT p_limit OFFSET p_offset
    ) x), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.list_customers_for_cashier(text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_customers_for_cashier(text,integer,integer) TO authenticated;
