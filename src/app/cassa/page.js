'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('placeholder')) {
    return null;
  }

  return createClient(url, key);
}

function parseEuroAmount(value) {
  const normalized = String(value).trim().replace(',', '.');

  if (!normalized) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount <= 0) return null;

  return amount;
}

const REWARDS = [
  { code: 'COTONE_DRIP', points: 60, name: 'Filtri cotone + Drip Tip' },
  { code: 'LACCIO_COPRI_DRIP', points: 70, name: 'Laccio porta sigaretta + Copri Drip Tip' },
  { code: 'RESISTENZE_2', points: 110, name: '2 resistenze' },
  { code: 'SCONTO_15_DEVICE', points: 300, name: '15% sconto su dispositivo' },
];

export default function Cassa() {
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [scannerError, setScannerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('svapowebsecondigliano@gmail.com');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [redeeming, setRedeeming] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [manualCardId, setManualCardId] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [issuingActivation, setIssuingActivation] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setSession(null);
      setAuthError('Supabase non è configurato correttamente.');
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || session.user?.email !== 'svapowebsecondigliano@gmail.com') return undefined;
    if (typeof window === 'undefined') return undefined;

    let scannerInstance = null;
    let cancelled = false;

    import('html5-qrcode')
      .then(({ Html5QrcodeScanner }) => {
        if (cancelled) return;

        const scanner = new Html5QrcodeScanner(
          'reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );

        scannerInstance = scanner;

        scanner.render(
          (decodedText) => {
            loadCustomer(decodedText);
            scanner.clear().catch(() => {});
          },
          () => {}
        );
      })
      .catch((error) => {
        console.error('Errore scanner:', error);
        setScannerError('Fotocamera non disponibile. Inserisci il codice della tessera qui sotto.');
      });

    return () => {
      cancelled = true;
      if (scannerInstance) {
        scannerInstance.clear().catch(() => {});
      }
    };
  }, [session]);

  async function handleLogin(event) {
    event.preventDefault();
    if (authLoading) return;
    setAuthError('');
    if (email.trim().toLowerCase() !== 'svapowebsecondigliano@gmail.com') {
      setAuthError('Account non autorizzato per la Cassa.');
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) return setAuthError('Supabase non è configurato correttamente.');
    setAuthLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setAuthLoading(false);
    if (error) return setAuthError('Email o password non corretti.');
    if (data.user?.email !== 'svapowebsecondigliano@gmail.com') {
      await supabase.auth.signOut();
      return setAuthError('Account non autorizzato per la Cassa.');
    }
    setPassword('');
  }

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    setCustomer(null);
    setAmount('');
    setMessage('');
    setActivationCode('');
    setManualPhone('');
  }

  async function loadHistory(customerId) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc('get_customer_history', {
      p_customer_id: customerId,
    });
    if (!error) setHistory(data || []);
    else console.error('Errore storico cliente:', error);
    setHistoryLoading(false);
  }

  async function loadCustomer(id) {
    const supabase = getSupabaseClient();
    const customerId = String(id ?? '').trim();
    if (!customerId || customerId.length > 128) {
      setMessage('Inserisci un codice tessera valido.');
      return;
    }
    if (!supabase) {
      setMessage('Supabase non è configurato correttamente.');
      return;
    }
    setLookupLoading(true);
    setHistory([]);
    setActivationCode('');

    try {
      const { data, error } = await supabase.rpc('get_customer', {
        p_customer_id: customerId,
      });

      if (error || !data?.id) {
        console.error('Errore caricamento cliente:', error);
        setMessage('Tessera non trovata. Controlla il codice e riprova.');
        return;
      }

      setCustomer(data);
      setManualCardId('');
      setManualPhone('');
      setMessage('');
      await loadHistory(data.id);
    } catch (error) {
      console.error('Errore connessione:', error);
      setMessage('Errore di connessione al database.');
    } finally {
      setLookupLoading(false);
    }
  }

  async function lookupByPhone(event) {
    event.preventDefault();
    if (phoneLookupLoading || !manualPhone.trim()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return setMessage('Supabase non configurato.');
    setPhoneLookupLoading(true);
    setActivationCode('');
    setMessage('');
    setHistory([]);
    try {
      const { data, error } = await supabase.rpc('find_customer_for_cashier', { p_phone: manualPhone.trim() });
      if (error || !data?.id) return setMessage('Tessera non trovata: controlla il telefono.');
      setCustomer(data);
      setManualPhone('');
      await loadHistory(data.id);
    } catch {
      setMessage('Errore di connessione durante la ricerca.');
    } finally {
      setPhoneLookupLoading(false);
    }
  }

  async function issueActivationCode() {
    if (!customer || issuingActivation || submitting || redeeming) return;
    if (!window.confirm('Hai verificato di persona che la tessera appartenga al cliente? Generare un nuovo codice invalida quello precedente.')) return;
    const supabase = getSupabaseClient();
    if (!supabase) return setMessage('Supabase non configurato.');
    setActivationCode('');
    setMessage('');
    setIssuingActivation(true);
    try {
      const { data, error } = await supabase.rpc('issue_customer_activation', { p_customer_id: customer.id });
      if (error || !data) return setMessage(error?.message || 'Impossibile generare il codice.');
      setActivationCode(data);
      setMessage('Codice creato. Consegnalo al cliente: è valido per 15 minuti e utilizzabile una sola volta.');
    } catch {
      setMessage('Errore durante la generazione del codice.');
    } finally {
      setIssuingActivation(false);
    }
  }

  async function refreshCustomer(id) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configurato');
    const { data, error } = await supabase.rpc('get_customer', { p_customer_id: id });
    if (error || !data?.id) throw new Error('Saldo non disponibile: ricarica la tessera per verificare i punti.');
    setCustomer(data);
    await loadHistory(id);
  }

  async function handleAddPoints(event) {
    event.preventDefault();

    if (!customer || submitting) return;

    const parsedAmount = parseEuroAmount(amount);
    const pointsToEarn = parsedAmount === null ? 0 : Math.floor(parsedAmount);

    setMessage('');

    if (!parsedAmount || pointsToEarn <= 0) {
      setMessage('Inserisci un importo valido di almeno 1,00 €.');
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setMessage('Supabase non è configurato correttamente.');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.rpc('add_points', {
        cust_id: customer.id,
        pts: pointsToEarn,
        amount: parsedAmount,
      });

      if (error) {
        console.error('Errore accredito punti:', error);
        setMessage(`Errore durante l'accredito: ${error.message}`);
        return;
      }

      setAmount('');
      try {
        await refreshCustomer(customer.id);
        setMessage(`Accreditati +${pointsToEarn} punti. Saldo aggiornato dal database.`);
      } catch (refreshError) {
        setMessage(`Accredito registrato, ma impossibile verificare il saldo: ${refreshError.message}`);
      }
    } catch (error) {
      console.error('Errore inatteso accredito:', error);
      setMessage('Errore di connessione.');
    } finally {
      setSubmitting(false);
    }
  }


  async function handleRedeem(reward) {
    if (!customer || redeeming || submitting) return;
    if ((customer.points_balance ?? 0) < reward.points) return;

    const confirmed = window.confirm(`Confermi il riscatto di "${reward.name}" per ${reward.points} punti?`);
    if (!confirmed) return;

    const supabase = getSupabaseClient();
    if (!supabase) return setMessage('Supabase non è configurato correttamente.');

    setRedeeming(reward.code);
    setMessage('');
    try {
      const { data, error } = await supabase.rpc('redeem_reward', {
        cust_id: customer.id,
        reward_code: reward.code,
      });
      if (error) {
        setMessage(`Errore durante il riscatto: ${error.message}`);
        return;
      }
      try {
        await refreshCustomer(customer.id);
        setMessage(`Premio riscattato: ${data.reward}. Scalati ${data.points_spent} punti. Saldo aggiornato.`);
      } catch (refreshError) {
        setMessage(`Riscatto registrato, ma impossibile verificare il saldo: ${refreshError.message}`);
      }
    } catch (error) {
      console.error('Errore riscatto:', error);
      setMessage('Errore di connessione durante il riscatto.');
    } finally {
      setRedeeming('');
    }
  }

  if (session === undefined) {
    return <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">Caricamento...</main>;
  }

  if (!session || session.user?.email !== 'svapowebsecondigliano@gmail.com') {
    return (
      <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
          <h1 className="text-2xl font-bold text-yellow-500 text-center mb-1">SVAPOWEB SECONDIGLIANO CLUB</h1>
          <p className="text-sm text-gray-400 text-center mb-6">Accesso Cassa riservato</p>
          {authError && <p className="mb-4 text-sm text-red-300 bg-red-950/40 border border-red-800 rounded-lg p-3">{authError}</p>}
          <label className="text-xs text-gray-400">Email operatore</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mt-1 mb-3" />
          <label className="text-xs text-gray-400">Password</label>
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mt-1 mb-5" />
          <button disabled={authLoading} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-bold py-3 rounded-lg">
            {authLoading ? 'Accesso...' : 'Accedi alla Cassa'}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white p-4 flex flex-col items-center">
      <div className="w-full max-w-sm flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-yellow-500">Cassa - SVAPOWEB SECONDIGLIANO CLUB</h1>
        <a href="/clienti" className="text-xs bg-yellow-500 text-black font-bold px-3 py-2 rounded-lg">Gestione Clienti</a>
        <button onClick={handleLogout} className="text-xs bg-neutral-700 px-3 py-2 rounded-lg text-gray-300">Esci</button>
      </div>

      {!customer ? (
        <div className="w-full max-w-sm bg-neutral-800 p-4 rounded-xl">
          <div id="reader" className="w-full"></div>

          {scannerError && (
            <p className="text-sm text-red-300 mt-3">{scannerError}</p>
          )}

          {message && (
            <p className="text-sm text-red-300 mt-3">{message}</p>
          )}

          <p className="text-xs text-center text-gray-400 mt-2">
            Inquadra il QR Code dello smartphone del cliente
          </p>
          <form className="mt-5 space-y-2 border-t border-neutral-700 pt-4" onSubmit={(event) => { event.preventDefault(); if (!lookupLoading) void loadCustomer(manualCardId); }}>
            <label htmlFor="manual-card-id" className="block text-sm font-medium text-white">Oppure inserisci il codice tessera</label>
            <input id="manual-card-id" type="text" autoComplete="off" value={manualCardId} maxLength={128} onChange={(event) => setManualCardId(event.target.value)} placeholder="Codice riportato sulla tessera" className="w-full rounded-lg border border-neutral-600 bg-neutral-900 p-3 text-white" />
            <button type="submit" disabled={lookupLoading || !manualCardId.trim()} className="w-full rounded-lg bg-yellow-500 p-3 font-bold text-black disabled:opacity-50">{lookupLoading ? 'Ricerca...' : 'Cerca tessera'}</button>
          </form>
          <form className="mt-4 space-y-2 border-t border-neutral-700 pt-4" onSubmit={lookupByPhone}>
            <label htmlFor="manual-phone" className="block text-sm font-medium text-white">Oppure cerca per numero di telefono</label>
            <input id="manual-phone" type="tel" autoComplete="off" value={manualPhone} onChange={(event) => setManualPhone(event.target.value)} placeholder="Numero di telefono del cliente" className="w-full rounded-lg border border-neutral-600 bg-neutral-900 p-3 text-white" />
            <button type="submit" disabled={phoneLookupLoading || !manualPhone.trim()} className="w-full rounded-lg border border-yellow-600 p-3 font-bold text-yellow-400 disabled:opacity-50">{phoneLookupLoading ? 'Ricerca...' : 'Cerca per telefono'}</button>
          </form>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
          <p className="text-lg font-bold">{customer.full_name}</p>
          <p className="text-xs text-gray-400 mb-4">
            Saldo attuale:{' '}
            <span className="text-yellow-400 font-bold">
              {customer.points_balance ?? 0} PTS
            </span>
          </p>

          <section className="mb-5 rounded-xl border border-yellow-500/40 bg-neutral-900 p-4">
            <h2 className="font-bold text-yellow-400">Attivazione tessera</h2>
            <p className="my-2 text-xs text-gray-300">Se il cliente non ha ancora un PIN, verifica di persona la sua identità e consegna un codice monouso.</p>
            <button type="button" onClick={issueActivationCode} disabled={issuingActivation || submitting || Boolean(redeeming)} className="w-full rounded-lg bg-yellow-500 p-3 font-bold text-black disabled:opacity-60">{issuingActivation ? 'Generazione...' : 'Genera codice di attivazione'}</button>
            {activationCode && <div role="status" className="mt-3 rounded-lg border border-yellow-500 bg-neutral-800 p-4 text-center"><p className="text-xs text-gray-400">Codice monouso valido 15 minuti</p><p className="mt-2 break-all font-mono text-2xl font-bold tracking-widest text-yellow-400">{activationCode}</p><button type="button" className="mt-3 text-xs text-gray-300 underline" onClick={() => setActivationCode('')}>Nascondi codice</button></div>}
          </section>

          <form onSubmit={handleAddPoints} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400">Importo speso (€)</label>
              <input
                type="text"
                inputMode="decimal"
                required
                placeholder="es. 18,50"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-2xl font-bold text-yellow-400 text-center mt-1 focus:outline-none"
              />
            </div>

            <p className="text-xs text-center text-gray-400">
              Punti da accreditare:{' '}
              <strong className="text-white">
                {(() => {
                  const parsed = parseEuroAmount(amount);
                  return parsed ? Math.floor(parsed) : 0;
                })()}{' '}
                PTS
              </strong>
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60 text-black font-bold py-3 rounded-lg"
            >
              {submitting ? 'Accredito in corso...' : 'Conferma e Accredita Punti'}
            </button>
          </form>

          {message && (
            <p className="text-sm text-center mt-4 text-yellow-300">{message}</p>
          )}

          <div className="mt-6 border-t border-neutral-700 pt-5">
            <h2 className="font-bold mb-3">🎁 Riscatta premio</h2>
            <div className="space-y-2">
              {REWARDS.map((reward) => {
                const available = (customer.points_balance ?? 0) >= reward.points;
                return (
                  <button
                    key={reward.code}
                    type="button"
                    disabled={!available || Boolean(redeeming) || submitting}
                    onClick={() => handleRedeem(reward)}
                    className={`w-full text-left rounded-xl border p-3 transition ${available ? 'border-yellow-500/60 bg-yellow-500/10 hover:bg-yellow-500/20' : 'border-neutral-700 bg-neutral-900/50 opacity-55'}`}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="text-sm font-semibold">{reward.name}</span>
                      <span className={`text-xs font-bold whitespace-nowrap ${available ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {redeeming === reward.code ? 'Riscatto...' : available ? `${reward.points} PTS · Riscatta` : `Mancano ${reward.points - (customer.points_balance ?? 0)}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 border-t border-neutral-700 pt-5">
            <h2 className="font-bold mb-3">📋 Storico cliente</h2>
            {historyLoading ? (
              <p className="text-xs text-gray-400">Caricamento movimenti...</p>
            ) : history.length === 0 ? (
              <p className="text-xs text-gray-500">Nessun movimento registrato.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {history.map((item) => {
                  const redeem = item.type === 'REDEEM';
                  const date = new Date(item.created_at).toLocaleString('it-IT', {
                    day: '2-digit', month: '2-digit', year: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  });
                  return (
                    <div key={item.id} className="bg-neutral-900/70 border border-neutral-700 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {redeem ? (item.reward_name || 'Premio riscattato') : item.type === 'BONUS' ? 'Bonus punti' : `Acquisto € ${Number(item.amount_spent || 0).toFixed(2).replace('.', ',')}`}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{date}</p>
                      </div>
                      <span className={`text-sm font-extrabold whitespace-nowrap ${redeem ? 'text-red-300' : 'text-green-400'}`}>
                        {redeem ? `-${item.points_spent || 0}` : `+${item.points_earned || 0}`} PTS
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setCustomer(null);
              setMessage('');
              setAmount('');
              setHistory([]);
              setManualCardId('');
              setManualPhone('');
              setActivationCode('');
            }}
            className="w-full mt-4 bg-neutral-700 text-xs py-2 rounded-lg text-gray-300"
          >
            Scansiona altro cliente
          </button>
        </div>
      )}
    </main>
  );
}
