-- Mucho Svapo Club — audit NON DISTRUTTIVO su Supabase Postgres
-- Eseguire nel SQL Editor di Supabase. Nessuna modifica a righe, saldi, ACL o configurazioni.
-- Condividere i risultati delle query, NON credenziali / chiavi API / PIN.
BEGIN TRANSACTION READ ONLY;

-- 1. RPC esposte tramite PostgREST, firme, SECURITY DEFINER, proprietari,
--    search_path e permessi di esecuzione per PUBLIC/anon/authenticated.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner_name,
       p.prosecdef AS security_definer,
       p.proconfig AS function_config,
       has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public')
  AND p.proname IN (
    'get_customer','create_customer','login_customer','set_customer_pin',
    'add_points','redeem_reward','get_customer_history','get_admin_dashboard'
  )
ORDER BY p.proname, arguments;

-- 2. Policy RLS e forza RLS su tabelle applicative (metadati, nessun dato personale).
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced,
       pg_get_userbyid(c.relowner) AS owner_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r','p')
ORDER BY c.relname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Privilegi sui dati: lettura e modifica diretta anon/authenticated.
SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC','anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 4. Definizioni delle funzioni: identificare controlli auth.uid()/ruoli,
--    ownership del cliente, limiti importo e atomicità dei riscatti.
--    Questo output può contenere logica riservata: condividerlo solo privatamente.
SELECT n.nspname AS schema_name, p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN (
    'get_customer','create_customer','login_customer','set_customer_pin',
    'add_points','redeem_reward','get_customer_history','get_admin_dashboard'
  )
ORDER BY p.proname;

ROLLBACK;
