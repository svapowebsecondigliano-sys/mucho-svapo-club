# Mucho Svapo Club — audit sicurezza Supabase (13/10/2026)

## Stato e perimetro

**Stato: revisione del frontend completata; autorizzazioni RPC e RLS del DB non ancora verificate.**
Questo repository contiene il frontend Next.js ma non le definizioni SQL delle funzioni PostgreSQL. Non si deve dedurre la sicurezza del database dai controlli React. Nessun saldo, cliente o movimento reale è stato modificato durante questo audit.

L'app usa `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` nel browser. La chiave anon/publishable è per definizione pubblica: **non è una barriera di autorizzazione**. Le RPC invocate dal browser devono controllare i privilegi lato database. Le credenziali `service_role` non devono essere esposte al browser.

## Rischi da confermare con SQL Editor

| Gravità potenziale | Funzione | Verifica richiesta |
| --- | --- | --- |
| Critica | `add_points(cust_id, pts, amount)` | `anon` e clienti autenticati non autorizzati non devono poter accreditare, neanche richiamando direttamente l'endpoint REST. La funzione deve verificare `auth.uid()` o un ruolo server-side non manipolabile; `pts` e `amount` devono corrispondere, essere positivi e limitati. |
| Critica | `redeem_reward(cust_id, reward_code)` | Solo operatori autorizzati; premi e costi ricavati lato DB, controllo saldo e decremento **atomici**, impedendo doppio riscatto o saldo negativo con richieste concorrenti. |
| Alta | `set_customer_pin(p_phone, p_pin)` | L'assenza del PIN non è prova di possesso del numero: senza verifica SMS/OTP o token di attivazione a uso singolo, un malintenzionato può potenzialmente inizializzare il PIN di un'altra tessera. Non assumere sicurezza senza leggere la definizione. |
| Alta | `get_customer(p_customer_id)` | L'ID salvato in `localStorage` non autentica il cliente; non restituire numero di telefono o dati personali al solo possessore dell'ID. Un QR può essere condiviso, fotografato o smarrito. |
| Alta | `get_customer_history(p_customer_id)` | Storico visibile esclusivamente a cliente correttamente autenticato o operatore. |
| Alta | `get_admin_dashboard()` | Deve autorizzare nel DB, non affidarsi alla verifica email lato React. |
| Media | `create_customer` / `login_customer` | Limitazioni anti-abuso e anti-enumerazione, controllo tentativi PIN e verifica proprietà della tessera. Il PIN a 4 cifre richiede rate limiting lato server. |
| Alta | Tabelle clienti/movimenti | RLS attiva, grant minimali, nessuna UPDATE diretta al saldo tramite `anon`/`authenticated`. |

L'email fissa presente nella UI di cassa e admin è solo un controllo visivo. Se usata per autorizzare nella funzione SQL deve essere accertata leggendo l'identità verificata in JWT tramite `auth.uid()`, non un parametro arbitrario passato dal browser.

## Procedura SENZA scritture su produzione

1. Aprire Supabase → SQL Editor e lanciare [supabase-readonly-audit.sql](./supabase-readonly-audit.sql). Il file include `BEGIN TRANSACTION READ ONLY` e `ROLLBACK`; contiene esclusivamente `SELECT` e non esegue RPC aziendali.
2. Analizzare la presenza di `EXECUTE` per `PUBLIC`, `anon`, `authenticated`; verificare il contenuto delle funzioni e le policy RLS. **Un grant di esecuzione non basta per dichiarare vulnerabilità:** una RPC potrebbe effettuare già controlli solidi al suo interno.
3. Preparare la correzione su un branch database/test separato o un ambiente Supabase di staging. Testare chiamate dirette all'API da utenti anonimi, clienti A/B, account cassa autorizzato e utente autenticato ma non abilitato.
4. Per ogni modifica verificare prima transazioni concorrenti, rollback e consistenza del ledger. Fare backup e stabilire un piano di ripristino. Applicare migrazioni in produzione **solo dopo revisione**, in modo da non bloccare la cassa.

### Test di sicurezza richiesti (nessun cliente reale)

- `anon` invoca `add_points` / `redeem_reward` → negato senza scrivere movimenti.
- Auth non staff invoca le stesse RPC → negato.
- Operatore autorizzato su cliente fittizio → una sola registrazione per una singola operazione, bilancio corretto.
- Due riscatti concorrenti sulla medesima tessera fittizia → non più del saldo disponibile.
- Due accrediti ripetuti con lo stesso identificatore operazione (da introdurre sul DB) → un solo accredito.
- Un cliente A non può leggere i dati / lo storico del cliente B.
- Tentativi ripetuti di PIN sbagliati → blocco o rate limit lato server.
- Utente non staff invoca `get_admin_dashboard` → negato.

**Non applicare in produzione** comandi `REVOKE`, `GRANT`, `ALTER FUNCTION`, `DROP` o policy RLS finché non conosciamo firme e dipendenze delle funzioni esistenti. Bloccare `anon` indiscriminatamente può compromettere il primo accesso e la tessera clienti.

## Verifiche automatiche del repository

Il workflow `verify-security-audit.yml` esegue build Next.js e controlla che l'audit rimanga di sola lettura e che i punti siano gestiti attraverso RPC. È un controllo statico, **non** certifica che le RPC o le policy Supabase siano sicure.
