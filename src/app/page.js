'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('placeholder')) return null;
  return createClient(url, key);
}

function getQrId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `MS-${crypto.randomUUID()}`;
  }
  return `MS-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function validPhone(value) {
  return /^\d{8,15}$/.test(value.replace(/[\s().+-]/g, ''));
}

export default function Home() {
  const [customer, setCustomer] = useState(null);
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinSetupPhone, setPinSetupPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('mucho_svapo_user_id');
    if (savedId) fetchCustomer(savedId);
  }, []);

  function clearMessages() {
    setErrorMsg('');
    setSuccessMsg('');
  }

  async function fetchCustomer(id) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMsg('Il servizio tessere non è configurato correttamente.');
      return;
    }

    const { data, error } = await supabase.rpc('get_customer', {
      p_customer_id: id,
    });

    if (error || !data) {
      localStorage.removeItem('mucho_svapo_user_id');
      setErrorMsg('Accedi nuovamente alla tua tessera.');
      setMode('login');
      return;
    }

    setCustomer(data);
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (loading) return;
    clearMessages();

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (cleanName.length < 2) return setErrorMsg('Inserisci nome e cognome.');
    if (!validPhone(cleanPhone)) return setErrorMsg('Inserisci un numero di telefono valido.');

    const supabase = getSupabaseClient();
    if (!supabase) return setErrorMsg('Il servizio tessere non è configurato correttamente.');

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_customer', {
        p_full_name: cleanName,
        p_phone: cleanPhone,
        p_qr_code_id: getQrId(),
      });

      if (error) {
        if (error.message?.includes('customers_phone_key') || error.message?.includes('duplicate key')) {
          setPhone(cleanPhone);
          setMode('login');
          setErrorMsg('Questo numero ha già una tessera. Accedi oppure configura il PIN al primo accesso.');
        } else {
          setErrorMsg(`Impossibile creare la tessera: ${error.message}`);
        }
        return;
      }

      setPinSetupPhone(cleanPhone);
      setCustomer(data);
      setMode('setupPin');
      setSuccessMsg('Tessera creata. Ora scegli un PIN di 4 cifre.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (loading) return;
    clearMessages();

    const cleanPhone = phone.trim();
    if (!validPhone(cleanPhone)) return setErrorMsg('Inserisci un numero di telefono valido.');
    if (!/^\d{4}$/.test(pin)) return setErrorMsg('Il PIN deve essere di 4 cifre.');

    const supabase = getSupabaseClient();
    if (!supabase) return setErrorMsg('Il servizio tessere non è configurato correttamente.');

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('login_customer', {
        p_phone: cleanPhone,
        p_pin: pin,
      });

      if (error || !data) {
        setErrorMsg('Numero di telefono o PIN non corretto. Se non hai ancora un PIN, usa "Primo accesso".');
        return;
      }

      localStorage.setItem('mucho_svapo_user_id', data.id);
      setCustomer(data);
      setSuccessMsg('Accesso effettuato.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPin(event) {
    event.preventDefault();
    if (loading) return;
    clearMessages();

    const targetPhone = (pinSetupPhone || phone).trim();
    if (!validPhone(targetPhone)) return setErrorMsg('Inserisci il numero associato alla tessera.');
    if (!/^\d{4}$/.test(pin)) return setErrorMsg('Scegli un PIN di 4 cifre.');
    if (pin !== pinConfirm) return setErrorMsg('I due PIN non coincidono.');

    const supabase = getSupabaseClient();
    if (!supabase) return setErrorMsg('Il servizio tessere non è configurato correttamente.');

    setLoading(true);
    try {
      const { error } = await supabase.rpc('set_customer_pin', {
        p_phone: targetPhone,
        p_pin: pin,
      });

      if (error) {
        if (error.message?.includes('PIN già configurato')) {
          setMode('login');
          setErrorMsg('Questa tessera ha già un PIN. Accedi con il PIN esistente.');
        } else {
          setErrorMsg(error.message || 'Impossibile configurare il PIN.');
        }
        return;
      }

      const { data, error: loginError } = await supabase.rpc('login_customer', {
        p_phone: targetPhone,
        p_pin: pin,
      });

      if (loginError || !data) {
        setMode('login');
        setSuccessMsg('PIN configurato. Ora accedi.');
        return;
      }

      localStorage.setItem('mucho_svapo_user_id', data.id);
      setCustomer(data);
      setSuccessMsg('PIN configurato. Tessera pronta!');
      setMode('card');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('mucho_svapo_user_id');
    setCustomer(null);
    setPhone('');
    setPin('');
    setPinConfirm('');
    setPinSetupPhone('');
    clearMessages();
    setMode('login');
  }

  if (customer && mode !== 'setupPin') {
    return (
      <main className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
        <section className="bg-neutral-800 p-6 rounded-2xl shadow-xl w-full max-w-sm text-center border border-neutral-700">
          <h1 className="text-2xl font-bold tracking-wide text-yellow-500 mb-1">SVAPOWEB SECONDIGLIANO CLUB</h1>
          <p className="text-sm text-gray-400 mb-5">Carta Fedeltà Digitale</p>

          {successMsg && <div className="mb-4 rounded-lg border border-green-700 bg-green-950/40 px-3 py-2 text-sm text-green-300">{successMsg}</div>}

          <div className="bg-white p-4 rounded-xl inline-block mb-5 shadow-inner">
            <QRCode value={customer.id} size={180} />
          </div>

          <p className="text-sm text-gray-400 mb-4">Mostra questo QR alla cassa per accumulare i tuoi punti.</p>

          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Saldo Punti</p>
            <p className="text-4xl font-extrabold text-yellow-400 mt-1">{customer.points_balance ?? 0} PTS</p>
          </div>

          <p className="text-sm font-semibold text-gray-300">{customer.full_name}</p>
          <p className="text-xs text-gray-500 mb-5">{customer.phone}</p>

          <button onClick={logout} className="w-full bg-neutral-700 hover:bg-neutral-600 text-sm py-3 rounded-lg">
            Esci dalla tessera
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">
      <section className="bg-neutral-800 p-6 rounded-2xl w-full max-w-sm border border-neutral-700">
        <h1 className="text-2xl font-bold text-center text-yellow-500 mb-1">SVAPOWEB SECONDIGLIANO CLUB</h1>
        <p className="text-sm text-gray-400 text-center mb-6">La tua carta fedeltà digitale</p>

        {successMsg && <div className="mb-4 rounded-lg border border-green-700 bg-green-950/40 px-3 py-2 text-sm text-green-300">{successMsg}</div>}
        {errorMsg && <div className="mb-4 rounded-lg border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-300">{errorMsg}</div>}

        {mode === 'register' && (
          <form onSubmit={handleRegister}>
            <input type="text" placeholder="Nome e Cognome" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-3 focus:outline-none focus:border-yellow-500" />
            <input type="tel" placeholder="Numero di Telefono" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-5 focus:outline-none focus:border-yellow-500" />
            <button disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-bold py-3 rounded-lg">
              {loading ? 'Creazione...' : 'Crea la mia Tessera'}
            </button>
            <button type="button" onClick={() => { clearMessages(); setMode('login'); }} className="w-full mt-3 text-sm text-yellow-400 py-2">
              Ho già una tessera
            </button>
          </form>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <p className="text-sm text-gray-300 mb-4 text-center">Accedi alla tua tessera</p>
            <input type="tel" placeholder="Numero di Telefono" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-3 focus:outline-none focus:border-yellow-500" />
            <input type="password" inputMode="numeric" maxLength={4} placeholder="PIN a 4 cifre" required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-5 text-center tracking-[0.4em] focus:outline-none focus:border-yellow-500" />
            <button disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-bold py-3 rounded-lg">
              {loading ? 'Accesso...' : 'Accedi alla Tessera'}
            </button>
            <button type="button" onClick={() => { clearMessages(); setPin(''); setPinConfirm(''); setPinSetupPhone(''); setMode('setupPin'); }} className="w-full mt-3 text-sm text-gray-300 py-2">
              Primo accesso? Configura PIN
            </button>
            <button type="button" onClick={() => { clearMessages(); setMode('register'); }} className="w-full text-sm text-yellow-400 py-2">
              Crea una nuova tessera
            </button>
          </form>
        )}

        {mode === 'setupPin' && (
          <form onSubmit={handleSetPin}>
            <p className="text-sm text-gray-300 mb-4 text-center">Configura il tuo PIN personale</p>
            {!pinSetupPhone && (
              <input type="tel" placeholder="Numero associato alla tessera" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-3 focus:outline-none focus:border-yellow-500" />
            )}
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Scegli PIN (4 cifre)" required value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-3 text-center tracking-[0.4em] focus:outline-none focus:border-yellow-500" />
            <input type="password" inputMode="numeric" maxLength={4} placeholder="Ripeti PIN" required value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-5 text-center tracking-[0.4em] focus:outline-none focus:border-yellow-500" />
            <button disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-60 text-black font-bold py-3 rounded-lg">
              {loading ? 'Salvataggio...' : 'Salva PIN e apri Tessera'}
            </button>
            <button type="button" onClick={() => { clearMessages(); setMode('login'); }} className="w-full mt-3 text-sm text-gray-300 py-2">
              Torna all'accesso
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
