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

export default function Cassa() {
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [scannerError, setScannerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
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
        setScannerError('Impossibile avviare la fotocamera. Usa la ricerca manuale quando sarà disponibile.');
      });

    return () => {
      cancelled = true;
      if (scannerInstance) {
        scannerInstance.clear().catch(() => {});
      }
    };
  }, []);

  async function loadCustomer(id) {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setMessage('Supabase non è configurato correttamente.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Errore caricamento cliente:', error);
        setMessage(`Cliente non trovato: ${error.message}`);
        return;
      }

      setCustomer(data);
      setMessage('');
    } catch (error) {
      console.error('Errore connessione:', error);
      setMessage('Errore di connessione al database.');
    }
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

      setMessage(`Accreditati +${pointsToEarn} punti con successo!`);
      setCustomer((previous) => ({
        ...previous,
        points_balance: (previous.points_balance || 0) + pointsToEarn,
      }));
      setAmount('');
    } catch (error) {
      console.error('Errore inatteso accredito:', error);
      setMessage('Errore di connessione.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white p-4 flex flex-col items-center">
      <h1 className="text-xl font-bold text-yellow-500 mb-4">Cassa - Mucho Svapo Club</h1>

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

          <button
            onClick={() => {
              setCustomer(null);
              setMessage('');
              setAmount('');
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
