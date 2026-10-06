'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes('placeholder')) {
    return null;
  }

  return createClient(url, key);
}

function getQrId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `MS-${crypto.randomUUID()}`;
  }

  return `MS-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export default function Home() {
  const [customer, setCustomer] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('mucho_svapo_user_id');
    if (savedId) {
      fetchCustomer(savedId);
    }
  }, []);

  async function fetchCustomer(id) {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMsg('Il servizio tessere non è configurato correttamente. Controlla la configurazione Supabase su Vercel.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        console.error('Errore recupero cliente:', error);
        setErrorMsg('Impossibile recuperare la tua tessera. Prova a crearla di nuovo.');
        return;
      }

      if (data) setCustomer(data);
    } catch (error) {
      console.error('Errore connessione recupero cliente:', error);
      setErrorMsg('Errore di connessione al database.');
    }
  }

  async function handleRegister(event) {
    event.preventDefault();

    if (loading) return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    setErrorMsg('');
    setSuccessMsg('');

    if (cleanName.length < 2) {
      setErrorMsg('Inserisci nome e cognome.');
      return;
    }

    const normalizedPhone = cleanPhone.replace(/[\s().+-]/g, '');

    if (!/^\d{8,15}$/.test(normalizedPhone)) {
      setErrorMsg('Inserisci un numero di telefono valido.');
      return;
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
      setErrorMsg('Il servizio tessere non è configurato correttamente. Controlla le variabili Supabase su Vercel.');
      return;
    }

    setLoading(true);

    try {
      const qrId = getQrId();

      const { data, error } = await supabase
        .from('customers')
        .insert([
          {
            full_name: cleanName,
            phone: cleanPhone,
            qr_code_id: qrId,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Errore Supabase creazione tessera:', error);
        setErrorMsg(`Impossibile creare la tessera: ${error.message}`);
        return;
      }

      if (!data) {
        setErrorMsg('La tessera non è stata creata. Riprova.');
        return;
      }

      localStorage.setItem('mucho_svapo_user_id', data.id);
      setCustomer(data);
      setSuccessMsg('Tessera creata con successo!');
    } catch (error) {
      console.error('Errore inatteso creazione tessera:', error);
      setErrorMsg('Errore di connessione al database. Controlla la connessione e riprova.');
    } finally {
      setLoading(false);
    }
  }

  if (customer) {
    return (
      <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
        <section className="bg-neutral-800 p-6 rounded-2xl shadow-xl w-full max-w-sm text-center border border-neutral-700">
          <h1 className="text-2xl font-bold tracking-wide text-yellow-500 mb-1">
            MUCHO SVAPO CLUB
          </h1>
          <p className="text-sm text-gray-400 mb-6">Carta Fedeltà Digitale</p>

          {successMsg && (
            <div className="mb-4 rounded-lg border border-green-700 bg-green-950/40 px-3 py-2 text-sm text-green-300">
              {successMsg}
            </div>
          )}

          <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner">
            <QRCode value={customer.id} size={180} />
          </div>

          <p className="text-sm text-gray-400 mb-4">
            Mostra questo QR alla cassa per accumulare i tuoi punti.
          </p>

          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Saldo Punti</p>
            <p className="text-4xl font-extrabold text-yellow-400 mt-1">
              {customer.points_balance ?? 0} PTS
            </p>
          </div>

          <p className="text-sm font-semibold text-gray-300">{customer.full_name}</p>
          <p className="text-xs text-gray-500">{customer.phone}</p>

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {errorMsg}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">
      <form
        onSubmit={handleRegister}
        className="bg-neutral-800 p-6 rounded-2xl w-full max-w-sm border border-neutral-700"
      >
        <h1 className="text-2xl font-bold text-center text-yellow-500 mb-2">
          MUCHO SVAPO CLUB
        </h1>
        <p className="text-sm text-gray-400 text-center mb-6">
          Registrati per iniziare a raccogliere punti
        </p>

        {errorMsg && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {errorMsg}
          </div>
        )}

        <input
          type="text"
          placeholder="Nome e Cognome"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mb-3 focus:outline-none focus:border-yellow-500"
        />

        <input
          type="tel"
          placeholder="Numero di Telefono"
          required
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mb-6 focus:outline-none focus:border-yellow-500"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-60 text-black font-bold py-3 rounded-lg transition"
        >
          {loading ? 'Creazione tessera...' : 'Crea la mia Tessera'}
        </button>
      </form>
    </main>
  );
}
