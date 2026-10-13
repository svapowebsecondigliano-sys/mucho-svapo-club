# Risultato audit Supabase (13 ottobre 2026)

## Esito e correzione verificata

Database Supabase progetto `vtnkvggdqagqdfyifflc` verificato in sola lettura, poi applicata una migrazione di protezione mirata. Il file [migrations/20261013_harden_points.sql](./migrations/20261013_harden_points.sql) riproduce la migrazione **già applicata** alla produzione; non va rilanciato senza una revisione delle eventuali modifiche successive.

- Tabelle `public.customers` e `public.transactions`: RLS attiva, nessuna policy di accesso. Revocati i privilegi tabellari diretti per `PUBLIC`, `anon` e `authenticated`.
- `add_points(cust_id uuid, pts integer, amount numeric)`: mantiene il controllo SQL dell'account operatore autorizzato; verifica importo tra 1 e 100000 euro, massimo due decimali e `pts = floor(amount)`. Accredito e registrazione storico avvengono in una singola transazione PostgreSQL.
- Post-migrazione: zero grant diretti per i ruoli sopra; `anon` non può eseguire `add_points`; `authenticated` può invocarla ma **solo l'identità operatore autorizzata** supera il controllo interno.

Non sono stati registrati acquisti, riscatti, modifiche ai saldi o transazioni di prova durante l'audit. Le verifiche sono su metadati e definizioni SQL; manca il test end-to-end su cliente fittizio con account operatore.

## RPC verificate (SQL di produzione)

| RPC | Accesso / osservazioni |
|---|---|
| `add_points` | SQL verifica account autorizzato e coerenza importo/punti dopo la correzione |
| `redeem_reward` | SQL verifica account autorizzato, costi premi lato server; `SELECT ... FOR UPDATE` previene riscatti concorrenti con saldo insufficiente |
| `get_admin_dashboard` | SQL verifica account autorizzato |
| `get_customer_history` | SQL verifica account autorizzato |
| `get_customer` | **CRITICITÀ APERTA**: eseguibile come anon e restituisce nome/telefono conoscendo l'UUID della tessera |
| `set_customer_pin` | **CRITICITÀ APERTA**: primo PIN impostabile con solo numero di telefono, senza OTP o token di attivazione |
| `login_customer` | **CRITICITÀ APERTA**: PIN a 4 cifre verificato con bcrypt ma non esiste rate limiting nella funzione SQL |
| `create_customer` | Pubblica intenzionalmente per la registrazione; necessarie misure anti-abuso e verifica del numero |

Le quattro funzioni pubbliche sono SECURITY DEFINER; i grant EXECUTE vanno rivisti insieme al flusso di autenticazione del cliente.

## Interventi necessari prima del lancio su vasta scala

1. Progettare una verifica telefono tramite OTP oppure consegnare un codice di attivazione monouso fisicamente in cassa, senza mettere PIN o token in QR e senza affidarsi al semplice numero.
2. Sostituire la lettura `get_customer(id)` anonima con una vista minimizzata e un'autenticazione di sessione cliente. La cassa deve conservare la possibilità di leggere i dati dietro verifica staff.
3. Aggiungere rate limiting effettivo al login cliente e protezione da enumerazione.
4. Aggiungere un identificatore univoco per operazione d'accredito lato server, evitando punti doppi anche in caso di riinvio. Testare su un account cliente fittizio o ambiente separato.
5. Testare l'intero percorso (registrazione, login, lettura tessera, scansione cassa, accredito, riscatto) su dispositivi reali.

**Non revocare indiscriminatamente EXECUTE a `get_customer` o `set_customer_pin` in produzione:** romperebbe l'app attuale. Questo documento non certifica l'assenza di vulnerabilità; descrive quelle verificate e il lavoro residuo.

Documentazione Supabase: [Security Advisor](https://supabase.com/docs/guides/database/database-linter) e [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).
