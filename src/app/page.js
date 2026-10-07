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

const REWARDS = [
  { code: 'COTONE_DRIP', points: 60, name: 'Filtri cotone + Drip Tip' },
  { code: 'LACCIO_COPRI_DRIP', points: 70, name: 'Laccio porta sigaretta + Copri Drip Tip' },
  { code: 'RESISTENZE_2', points: 110, name: '2 resistenze' },
  { code: 'SCONTO_15_DEVICE', points: 300, name: '15% sconto su dispositivo' },
];

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
          <img src="data:image/webp;base64,UklGRrQQAABXRUJQVlA4IKgQAADwTACdASrcANwAPpFGnEqlpCMhpvYZwLASCWJu3lF3XTNjLv93+S3tA23/UeQDxh638xx8v/e+qb9Iewbz5/N/+yf7ge6n/xP2n92X9k/0HsAf0Tzu/Zh/a32Qv2j64H+3eetWUOm/4f7g81LqPzP+wL5nhp+WXzJ7AT9eq/+u9+5qreFNbm+3eoP/Nv856xH+t5VVuU9iTDNOF+CtO+SC3VnRnQ3Cs6MV7bOivV6Ml+zTmxCyiZf3xMR67CEJjrIcpnP/REBlIn2fwcLvbEp74dKtboOsM6yaD8XuBlUKGLkK7cu9cGF2ldAbQGywd6ZM3CCGJBYp407uAbXNQPv/duTuh09QJqxkHzoLPeOHZvQrwm8Sls4g1wa8qmB1BlMnTFTAtHEQmjD0eosGTViaWkLMnC87Pc95KegGiYgQgHoAwMqTWi+gaOoXfDUJSNLUdF982QTEJIX8/C3KNdyLJ0hBqxI3gKh5vArMNZ+jkU+G3NVkFUSYt6e0Sr87J6mUdT9Ou2U5z2Ey93wSeDO6MLlW2lKC/mnIAkZUHzEnUzlVYWD2bhrNNEa6nCX4Pt8O3l5cPAhWKZ3vKGvo9FsFvalTeaKPRbc3UeVB3jkAaUzFfA3vNnRsfFieBkwOgC6jiZLXIhNcGDgrdwfGBsi/2FIc8TDfZgppjRy45gSwaeLxH/f/Ny1Fy1ucxgEjX/VoPXwaVczznJCTJHQXlGkXUwzqO0s5PGbPHJdJ6um/UiDPf1c/+A4RO7icJIs/k8gPB4FNKJ3qe75hv5xluLcRtw7lb/pSoLcBaUv//5L9mnNiOlnLwwbHBKocpuJl+8gA/ueiQ//nzfoT636Hf/910f2Xj+y8fisPlSR6dj8kxrJMN9FTRdhGVL5HDArBGjssa+KANomdWiQJ6LEvNlFLMkgDi1hbQwxu0E/9UBeIkTHiSCa/4oGUX2w1Iehm4HlaTLuteRaxNZvR48U5nbIcawcVMYJnAK782AWWwFZbiFYA2FumxQv0xHpcNIPP/CZnSh7g8/vnDYVXw+B8D8TeSv7va5MyMwMgZmNLtTja8IMKROt3WViayWfd/5p4cunw4katpSXhnc1/2pZ8gnq3yneRfSU0grJ0MSzel98KNzCKsms8EiiEBp4rvpDdAm/BgrFPrZJn/qoGzjusYtSXI/sJk86mkVlWM/mkB/+y6FTLktPkrAnsZwBQBABrArG0FdPYV8mXRhOHk8vWgLx0qk/zNp66d+1MSZvfaVCAB1BLbzITGng2A+DV8idqtA5iBngMNXIkRWfZgkMx3RvAjl+ktC+O0Ne3lblXbwu0WYtWq7dAoe5R4hRZcAMaT4y7+S4mDZm5KtBhY/vv2OAkiVLgJDEeqAH5R0NzgG+1w+dqT6/m31PKJkG2hAu2hJlBlUmyAoFyaoW88Jn3733yQrK+nuP6aJ0J62f9iYPsEeaOppddibDHOwg/QEwzpqRrwsnP6RPF9wK+Cm40lEbbtSNUdvN++J4yQaaYYv1qJQudkmQvPW+Vay5JeL0nTGNQC6vxhx17ExOZZdfEmRLwIYmqjXqJYOqnjyuZUteV8lkmRtjx8A0SqTq//9S1oKHDUXjsi5gQYsUP5moHlBv8xT5SryI1X9Vrc9BlAVGBAtoQozzbeGl0+iM1tdBhw30409zcT7lEWpxMyOw7e7Qisv0eK4U8TsbhYIItwdltaikCyK5xOCw5rDIAcwHyxC8LUDof7NgSPlFiS9Eh+p3p6MJLkLEfbtI0zv2uL185zDbPMH4CoNxuNPO10iJgo+6fs5RK4BKFlEpcv1G0oySoFahb9N9/Zyec5ZHXsJkVbDWp83b/lD2RNXtuVVcOxQQZpk/TNBShzIbGX+8XmgjREBeknB8S3RrIpIowxbzFxubiTUHR2Eo4qD4G4+rneTG1hyNvIFErcekOi/PHUnZ5vy0/nbwR/ul6SW7OmpeKSGuuy6i611IcDVsOZ/jCu6wPNNI+rn0EXLFf62a/9hB8qCDHnza3ZR5DCFswhyPyrjHdJaTkQA9f3s+hC0aBvU/amYZeAGKeZHQEnnaD8juEYecR32PwNJj5ij1jBan0imEfjEZQxseWahDm8+5k5+/a/QsosgcaeVHuULhlB/RSEvOasBJ395Dk8SO90EuCUqalkeqeJXWdIjKNhfMjjKnhQYHb7VWVMuA7LMRl49XjPN7Y/zwZlFLrHaa3zuu581EplOv3UKp0QaWstFbpfBQp/ZrUR1RfAcEBdBRsVhub0KQ05q9jBEgAL/EWhFWSyRSc6P6rodX48sRiboXv9Csf9ksfHRgt6UQvRvzQT9Lzv2yDC6jlQ8TQcpVBL27j4fBk3J5/HZXkT/YWJ+WBfR5ST3q2dou0rQEcv8KH0gWUmvYdZXPHrMm8ggwGMD2tQKDON7GG/jRKhpQkMEe++2ZlLFL4ylSA3QVhsUmX74x4XBp1i8MsWVMfSEWofUkdOqNx7r/hohNkwk8Q4J8TH0ogcTG8txHXYLlFtnRn4MeVhOC6IE/aO/ovdg7qyDUPXCWkf1SHTx8CutsaM9MN84VB2TcrjqHnz1oeJyOLvxma8q7uX7o6fULEXUkpguYyhgFpd5+KINzZgGo3gKPWrxfyowQmbChVlxZCwzDonSX93yd+Kr+1h1rmyuLDG5e4dz9NEuINA67N+L51bNvwoIX18/rp8GGpHVqYTyt5xgD3MvjoZdu7faQCzXs25/1GUsY3KB1DQTUcXSoKtB4mKGzdF3Y4aeanIAI7GYS2G8wtayHmY7C2XsEYVhcBi+Fpt2oPHbHwMCKX2Ei7NX/eAniEn1yilptiuLAlcSk+PlyDtbuVTZzg/fda7I+HBt4cGHooemI4l5Q24m7H77jDmNLKP5Md1VZP5i2Bt0N1Av0nWZxqlN7lnKxGAHv1tdh8SJqRd3iMJNmhwomax5hAm0Obbs4rTPO1tW9FNXVldeTkSLfgEI5T0rOyWEDEe4GP+0G+C8uqiXopgzJm3t39DYiRLM+LhOiVHWIg//9jh4ywyzlglO0CJzNHYirdsatWtSuEe2YsnoDhC7qbs6n2vcUJiHbvPpGCUB4NX2GNTIJYs1sgwRT2MwRuxeqVBiNYqLhZQY00upKmCaT5f+Z+8LVjDio5NssER1FOOtws2+/RrBJYjgnwcbrbfY6i8RvxqR+gpz5k9rAmFv9rpSstber5MwtnY30g3+pbZ+LxeU/8XjQGBwoDk91nl794GLdSKMJ36oHDpJTamT1hvT+F6rn6mr4TUkNnDwq0NnLfTgTYp+mRa425DEVIibZ6mEqj7m2i+34sklCQfSNmJF6PLXN22Bbd5aoD//31oucvIVvsC8JtBKos9n8eBAUo8UbG/8Jd2gV4CdGJAKIo9ktMwV17C+zpbwj14HsQZ1K2s2ZUCP9z7iahLpcL1ZfDc92fU7QdoqXwsC4N2QUIS6zBjMwtf84NI/8VVW+zza4Z/kt3/ifIlFDgwiNLU17szIg8tcO+Ab7gckueKXkO8y6JLx76jnfHuoxt23vIxG/4XraacmrfqaByqcfa2eU6NcHRFXN5OmP7w2uk5qnBi/EXufQK76wMN1AT6IDsPT/hu90b1r6MquWF5od8OuyPgE4lkXC36+MVti3QwFFOQ/lioQhiAy1V+Ho+2fjs1oCi+4XqcSX5obn8uxgZvbiPPzHlEpDjBwaUVZ2rJEZZIUFH9NL9Rx8ya1X+v7XPU8VE0T7zzuaph5zjcr+/WWvQQ5e/v8kHsh6zteHaj3hUY4NxRMt7B+0zRqUI35YlxTSV03oUNdS+PILU7EtsCvyAL0ZFErmcWZByOHb3Cm5pAFKfPb5/U+n9ZOhmP+c7A7hy5cT+i3ibsPQnRRnBdoSz1gVQsJD8d1erQOCR+Kytlc7u0coq4U3miZQ2mResCqReC1Cp0a8kInd2CWa3MrTGMBJkMXPqEbKIly9Vsn4i+nRFR4cFeepJNOqWfZ+Z8qCUT3Ii1wl3NumisP1lP4Mp1ppLwdme0pzANp9r6BIcAfQ0yNlpXsCxs6yGh6SxaHb/xclw85gi59/VzZllMLWkqDKRjXkhpLOKkJn7wM+wp5h4W500761gUAZvO5jxHkhtokH9n/QKZGbDJQv6V9TTs//8YRncRQfZM7FDT3X386rlvmD4pJvJtBijbIi/VkDbmzuVC1ilNpTAfIVqGqS3sNTl/3EKqOGCoyi34iZQLXkoJvVCTTcx7891FWYSoUOeaja2osMuXgTm89KELWo+9SGMnWad4HJWi1/YbdTCxnp0CNickM/p5GY0IthZb8q0Ji2Rl0amT3cBliSmrfh8LX4CfwzVUefoIyipZ7FxR+edXBzf03CJudNUI/ROQ8bVw0LiKtUuxT7KkNDUVgc8v7wBlHMJ+K05N0daSGlvI6/8FHCBlUM4of+AqI7vUAtKUipm5yIfWBU9aZZjSzOkl5ylEK4rXonfodA8iNb/jefDEX930WXtQ3sXNUuc/On7uasvas2HAskKawkUl3IO653LcjJlr0M3PVQ/OlrBwo7pcaVIGojGzzlTV/YU1G/O+ghrSD0y/4aDNccrPxei0E9h1v8kuIWp5uDFTpuoKfr5UizmD6K+Ae85JqnzNYCf9oj6UFzYG1D9dNtsx0n115Vrminc3L+KOdlMzUsxc9BkgAi8z2JlPaI0xX9J6zzlxNEwk9YTJLCFtZnO62CqhjiUbby//WUbMMJbhIzcr4h4bj6TAaymfOy15wGR72PGL3BF4lPCgwlsf6pbcQ8weMKCns7IajZQW1VuW9ol7JEDxhSuB5sYT3S3ocZafUbNNI1ae4n5TR/4BEnon5BM/Tc+9xpoLF25ZvBDQICG2qvi8TUcv0h6uFNAUBg/Mzg1rZg7WA87tsCjmks99i66QXEaIlfTI6v71koDB0YIPaBhU/sDVWfHxIbi+bsmVbbrdaytO1MS3ahleSxrBqM8tynzqa8g4WI6PUVvHLxxko/qikm18Tx9WsZ77AFoI241aaebeRam33xtpsKuPWnCBSWAIjwvI/LKNc7qtUE4gwv2jRRrTF7D1rWL9TZPCgSW+KNJxSoxLYud6ejI9XwP6hla8BBpz692r0dOYhXN5+h3cPtiL/fvEgkU5agM8XT72jm29zMQ4rEvKm1VwmKNXOcIYxsnVCefezD5eYlEt12WzCBHiPgYL+J9tFNEaD/I9aOJtUJs0hdxr4iHpWUn82F7m45WhXIn2lPQfdTAowyPdH2QqVO/RqvXGLrbpLRogqPoRqB3vUKf5cqb40zr6kXFdmCaEAWJpRz+ZNfhlmI3f7kR/Rhn50KzYE/DwpmMflB7RFR63FfK6jzxNR3nVdZ/wGqkL6fPQKqX2+5OUOumYL/STkH7AQexp1ixi4ZZa/kXp1DwGGGcAgno1SMbZKSZyKOMT0NpOUdahX9it2aIJ2pNpG4JVJPzJMW2hmcQYDLSpUXnaIBVUA6TjAeLLhnKJ6OwG3+Zbc0yYfwP+YpveaDMa9CrLMaO5BUUfQ1cNglTQzZi1tpiaHC04f9J4zym+WxHR9z5BxEnZBCusmUJpJepfQ7RAAKMugH6wuJs/w8sNA2S1Tc/bAApxL8IQ6nGOt9IeyxQGOcNb2ChLchC5SO9b84l+QvkzKGasFOqchFiuCyX1mNjHkQEc0aHwDT+bgYH8oAAAAAA" alt="Svapo Web Secondigliano" className="w-36 h-36 object-cover rounded-2xl mx-auto mb-4 shadow-lg border border-neutral-700" />
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
          <div className="text-left mb-5">
            <h2 className="text-sm font-bold text-white mb-3">🎁 I tuoi premi</h2>
            <div className="space-y-2">
              {REWARDS.map((reward) => {
                const balance = customer.points_balance ?? 0;
                const available = balance >= reward.points;
                return (
                  <div key={reward.code} className={`rounded-xl border p-3 ${available ? 'border-yellow-500/60 bg-yellow-500/10' : 'border-neutral-700 bg-neutral-900/60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{reward.name}</p>
                        <p className="text-xs text-gray-400 mt-1">{reward.points} PTS</p>
                      </div>
                      <span className={`text-xs font-bold whitespace-nowrap ${available ? 'text-yellow-400' : 'text-gray-500'}`}>
                        {available ? 'Disponibile' : `Mancano ${reward.points - balance}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-3 text-center">I premi vengono riscattati direttamente in cassa.</p>
          </div>


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
        <img src="data:image/webp;base64,UklGRrQQAABXRUJQVlA4IKgQAADwTACdASrcANwAPpFGnEqlpCMhpvYZwLASCWJu3lF3XTNjLv93+S3tA23/UeQDxh638xx8v/e+qb9Iewbz5/N/+yf7ge6n/xP2n92X9k/0HsAf0Tzu/Zh/a32Qv2j64H+3eetWUOm/4f7g81LqPzP+wL5nhp+WXzJ7AT9eq/+u9+5qreFNbm+3eoP/Nv856xH+t5VVuU9iTDNOF+CtO+SC3VnRnQ3Cs6MV7bOivV6Ml+zTmxCyiZf3xMR67CEJjrIcpnP/REBlIn2fwcLvbEp74dKtboOsM6yaD8XuBlUKGLkK7cu9cGF2ldAbQGywd6ZM3CCGJBYp407uAbXNQPv/duTuh09QJqxkHzoLPeOHZvQrwm8Sls4g1wa8qmB1BlMnTFTAtHEQmjD0eosGTViaWkLMnC87Pc95KegGiYgQgHoAwMqTWi+gaOoXfDUJSNLUdF982QTEJIX8/C3KNdyLJ0hBqxI3gKh5vArMNZ+jkU+G3NVkFUSYt6e0Sr87J6mUdT9Ou2U5z2Ey93wSeDO6MLlW2lKC/mnIAkZUHzEnUzlVYWD2bhrNNEa6nCX4Pt8O3l5cPAhWKZ3vKGvo9FsFvalTeaKPRbc3UeVB3jkAaUzFfA3vNnRsfFieBkwOgC6jiZLXIhNcGDgrdwfGBsi/2FIc8TDfZgppjRy45gSwaeLxH/f/Ny1Fy1ucxgEjX/VoPXwaVczznJCTJHQXlGkXUwzqO0s5PGbPHJdJ6um/UiDPf1c/+A4RO7icJIs/k8gPB4FNKJ3qe75hv5xluLcRtw7lb/pSoLcBaUv//5L9mnNiOlnLwwbHBKocpuJl+8gA/ueiQ//nzfoT636Hf/910f2Xj+y8fisPlSR6dj8kxrJMN9FTRdhGVL5HDArBGjssa+KANomdWiQJ6LEvNlFLMkgDi1hbQwxu0E/9UBeIkTHiSCa/4oGUX2w1Iehm4HlaTLuteRaxNZvR48U5nbIcawcVMYJnAK782AWWwFZbiFYA2FumxQv0xHpcNIPP/CZnSh7g8/vnDYVXw+B8D8TeSv7va5MyMwMgZmNLtTja8IMKROt3WViayWfd/5p4cunw4katpSXhnc1/2pZ8gnq3yneRfSU0grJ0MSzel98KNzCKsms8EiiEBp4rvpDdAm/BgrFPrZJn/qoGzjusYtSXI/sJk86mkVlWM/mkB/+y6FTLktPkrAnsZwBQBABrArG0FdPYV8mXRhOHk8vWgLx0qk/zNp66d+1MSZvfaVCAB1BLbzITGng2A+DV8idqtA5iBngMNXIkRWfZgkMx3RvAjl+ktC+O0Ne3lblXbwu0WYtWq7dAoe5R4hRZcAMaT4y7+S4mDZm5KtBhY/vv2OAkiVLgJDEeqAH5R0NzgG+1w+dqT6/m31PKJkG2hAu2hJlBlUmyAoFyaoW88Jn3733yQrK+nuP6aJ0J62f9iYPsEeaOppddibDHOwg/QEwzpqRrwsnP6RPF9wK+Cm40lEbbtSNUdvN++J4yQaaYYv1qJQudkmQvPW+Vay5JeL0nTGNQC6vxhx17ExOZZdfEmRLwIYmqjXqJYOqnjyuZUteV8lkmRtjx8A0SqTq//9S1oKHDUXjsi5gQYsUP5moHlBv8xT5SryI1X9Vrc9BlAVGBAtoQozzbeGl0+iM1tdBhw30409zcT7lEWpxMyOw7e7Qisv0eK4U8TsbhYIItwdltaikCyK5xOCw5rDIAcwHyxC8LUDof7NgSPlFiS9Eh+p3p6MJLkLEfbtI0zv2uL185zDbPMH4CoNxuNPO10iJgo+6fs5RK4BKFlEpcv1G0oySoFahb9N9/Zyec5ZHXsJkVbDWp83b/lD2RNXtuVVcOxQQZpk/TNBShzIbGX+8XmgjREBeknB8S3RrIpIowxbzFxubiTUHR2Eo4qD4G4+rneTG1hyNvIFErcekOi/PHUnZ5vy0/nbwR/ul6SW7OmpeKSGuuy6i611IcDVsOZ/jCu6wPNNI+rn0EXLFf62a/9hB8qCDHnza3ZR5DCFswhyPyrjHdJaTkQA9f3s+hC0aBvU/amYZeAGKeZHQEnnaD8juEYecR32PwNJj5ij1jBan0imEfjEZQxseWahDm8+5k5+/a/QsosgcaeVHuULhlB/RSEvOasBJ395Dk8SO90EuCUqalkeqeJXWdIjKNhfMjjKnhQYHb7VWVMuA7LMRl49XjPN7Y/zwZlFLrHaa3zuu581EplOv3UKp0QaWstFbpfBQp/ZrUR1RfAcEBdBRsVhub0KQ05q9jBEgAL/EWhFWSyRSc6P6rodX48sRiboXv9Csf9ksfHRgt6UQvRvzQT9Lzv2yDC6jlQ8TQcpVBL27j4fBk3J5/HZXkT/YWJ+WBfR5ST3q2dou0rQEcv8KH0gWUmvYdZXPHrMm8ggwGMD2tQKDON7GG/jRKhpQkMEe++2ZlLFL4ylSA3QVhsUmX74x4XBp1i8MsWVMfSEWofUkdOqNx7r/hohNkwk8Q4J8TH0ogcTG8txHXYLlFtnRn4MeVhOC6IE/aO/ovdg7qyDUPXCWkf1SHTx8CutsaM9MN84VB2TcrjqHnz1oeJyOLvxma8q7uX7o6fULEXUkpguYyhgFpd5+KINzZgGo3gKPWrxfyowQmbChVlxZCwzDonSX93yd+Kr+1h1rmyuLDG5e4dz9NEuINA67N+L51bNvwoIX18/rp8GGpHVqYTyt5xgD3MvjoZdu7faQCzXs25/1GUsY3KB1DQTUcXSoKtB4mKGzdF3Y4aeanIAI7GYS2G8wtayHmY7C2XsEYVhcBi+Fpt2oPHbHwMCKX2Ei7NX/eAniEn1yilptiuLAlcSk+PlyDtbuVTZzg/fda7I+HBt4cGHooemI4l5Q24m7H77jDmNLKP5Md1VZP5i2Bt0N1Av0nWZxqlN7lnKxGAHv1tdh8SJqRd3iMJNmhwomax5hAm0Obbs4rTPO1tW9FNXVldeTkSLfgEI5T0rOyWEDEe4GP+0G+C8uqiXopgzJm3t39DYiRLM+LhOiVHWIg//9jh4ywyzlglO0CJzNHYirdsatWtSuEe2YsnoDhC7qbs6n2vcUJiHbvPpGCUB4NX2GNTIJYs1sgwRT2MwRuxeqVBiNYqLhZQY00upKmCaT5f+Z+8LVjDio5NssER1FOOtws2+/RrBJYjgnwcbrbfY6i8RvxqR+gpz5k9rAmFv9rpSstber5MwtnY30g3+pbZ+LxeU/8XjQGBwoDk91nl794GLdSKMJ36oHDpJTamT1hvT+F6rn6mr4TUkNnDwq0NnLfTgTYp+mRa425DEVIibZ6mEqj7m2i+34sklCQfSNmJF6PLXN22Bbd5aoD//31oucvIVvsC8JtBKos9n8eBAUo8UbG/8Jd2gV4CdGJAKIo9ktMwV17C+zpbwj14HsQZ1K2s2ZUCP9z7iahLpcL1ZfDc92fU7QdoqXwsC4N2QUIS6zBjMwtf84NI/8VVW+zza4Z/kt3/ifIlFDgwiNLU17szIg8tcO+Ab7gckueKXkO8y6JLx76jnfHuoxt23vIxG/4XraacmrfqaByqcfa2eU6NcHRFXN5OmP7w2uk5qnBi/EXufQK76wMN1AT6IDsPT/hu90b1r6MquWF5od8OuyPgE4lkXC36+MVti3QwFFOQ/lioQhiAy1V+Ho+2fjs1oCi+4XqcSX5obn8uxgZvbiPPzHlEpDjBwaUVZ2rJEZZIUFH9NL9Rx8ya1X+v7XPU8VE0T7zzuaph5zjcr+/WWvQQ5e/v8kHsh6zteHaj3hUY4NxRMt7B+0zRqUI35YlxTSV03oUNdS+PILU7EtsCvyAL0ZFErmcWZByOHb3Cm5pAFKfPb5/U+n9ZOhmP+c7A7hy5cT+i3ibsPQnRRnBdoSz1gVQsJD8d1erQOCR+Kytlc7u0coq4U3miZQ2mResCqReC1Cp0a8kInd2CWa3MrTGMBJkMXPqEbKIly9Vsn4i+nRFR4cFeepJNOqWfZ+Z8qCUT3Ii1wl3NumisP1lP4Mp1ppLwdme0pzANp9r6BIcAfQ0yNlpXsCxs6yGh6SxaHb/xclw85gi59/VzZllMLWkqDKRjXkhpLOKkJn7wM+wp5h4W500761gUAZvO5jxHkhtokH9n/QKZGbDJQv6V9TTs//8YRncRQfZM7FDT3X386rlvmD4pJvJtBijbIi/VkDbmzuVC1ilNpTAfIVqGqS3sNTl/3EKqOGCoyi34iZQLXkoJvVCTTcx7891FWYSoUOeaja2osMuXgTm89KELWo+9SGMnWad4HJWi1/YbdTCxnp0CNickM/p5GY0IthZb8q0Ji2Rl0amT3cBliSmrfh8LX4CfwzVUefoIyipZ7FxR+edXBzf03CJudNUI/ROQ8bVw0LiKtUuxT7KkNDUVgc8v7wBlHMJ+K05N0daSGlvI6/8FHCBlUM4of+AqI7vUAtKUipm5yIfWBU9aZZjSzOkl5ylEK4rXonfodA8iNb/jefDEX930WXtQ3sXNUuc/On7uasvas2HAskKawkUl3IO653LcjJlr0M3PVQ/OlrBwo7pcaVIGojGzzlTV/YU1G/O+ghrSD0y/4aDNccrPxei0E9h1v8kuIWp5uDFTpuoKfr5UizmD6K+Ae85JqnzNYCf9oj6UFzYG1D9dNtsx0n115Vrminc3L+KOdlMzUsxc9BkgAi8z2JlPaI0xX9J6zzlxNEwk9YTJLCFtZnO62CqhjiUbby//WUbMMJbhIzcr4h4bj6TAaymfOy15wGR72PGL3BF4lPCgwlsf6pbcQ8weMKCns7IajZQW1VuW9ol7JEDxhSuB5sYT3S3ocZafUbNNI1ae4n5TR/4BEnon5BM/Tc+9xpoLF25ZvBDQICG2qvi8TUcv0h6uFNAUBg/Mzg1rZg7WA87tsCjmks99i66QXEaIlfTI6v71koDB0YIPaBhU/sDVWfHxIbi+bsmVbbrdaytO1MS3ahleSxrBqM8tynzqa8g4WI6PUVvHLxxko/qikm18Tx9WsZ77AFoI241aaebeRam33xtpsKuPWnCBSWAIjwvI/LKNc7qtUE4gwv2jRRrTF7D1rWL9TZPCgSW+KNJxSoxLYud6ejI9XwP6hla8BBpz692r0dOYhXN5+h3cPtiL/fvEgkU5agM8XT72jm29zMQ4rEvKm1VwmKNXOcIYxsnVCefezD5eYlEt12WzCBHiPgYL+J9tFNEaD/I9aOJtUJs0hdxr4iHpWUn82F7m45WhXIn2lPQfdTAowyPdH2QqVO/RqvXGLrbpLRogqPoRqB3vUKf5cqb40zr6kXFdmCaEAWJpRz+ZNfhlmI3f7kR/Rhn50KzYE/DwpmMflB7RFR63FfK6jzxNR3nVdZ/wGqkL6fPQKqX2+5OUOumYL/STkH7AQexp1ixi4ZZa/kXp1DwGGGcAgno1SMbZKSZyKOMT0NpOUdahX9it2aIJ2pNpG4JVJPzJMW2hmcQYDLSpUXnaIBVUA6TjAeLLhnKJ6OwG3+Zbc0yYfwP+YpveaDMa9CrLMaO5BUUfQ1cNglTQzZi1tpiaHC04f9J4zym+WxHR9z5BxEnZBCusmUJpJepfQ7RAAKMugH6wuJs/w8sNA2S1Tc/bAApxL8IQ6nGOt9IeyxQGOcNb2ChLchC5SO9b84l+QvkzKGasFOqchFiuCyX1mNjHkQEc0aHwDT+bgYH8oAAAAAA" alt="Svapo Web Secondigliano" className="w-36 h-36 object-cover rounded-2xl mx-auto mb-4 shadow-lg border border-neutral-700" />
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
