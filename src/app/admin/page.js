'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('placeholder')) return null;
  return createClient(url, key);
}

function euro(value) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value || 0));
}

export default function AdminDashboard() {
  const [session, setSession] = useState(undefined);
  const [email, setEmail] = useState('svapowebsecondigliano@gmail.com');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return setSession(null);
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.email === 'svapowebsecondigliano@gmail.com') loadStats();
  }, [session]);

  async function login(e) {
    e.preventDefault();
    setAuthError('');
    if (email.trim().toLowerCase() !== 'svapowebsecondigliano@gmail.com') return setAuthError('Account non autorizzato.');
    const supabase = getSupabaseClient();
    if (!supabase) return setAuthError('Supabase non configurato.');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthError('Email o password non corretti.');
    else setPassword('');
  }

  async function loadStats() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError('');
    const { data, error } = await supabase.rpc('get_admin_dashboard');
    if (error) return setError(error.message);
    setStats(data);
  }

  async function logout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    setStats(null);
  }

  if (session === undefined) return <main className="min-h-screen bg-neutral-900 text-white grid place-items-center">Caricamento...</main>;

  if (!session || session.user?.email !== 'svapowebsecondigliano@gmail.com') {
    return <main className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">
      <form onSubmit={login} className="w-full max-w-sm bg-neutral-800 border border-neutral-700 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-yellow-500 text-center">SVAPOWEB SECONDIGLIANO CLUB</h1>
        <p className="text-sm text-gray-400 text-center mb-6">Dashboard amministrativa</p>
        {authError && <p className="text-sm text-red-300 mb-4">{authError}</p>}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-3" />
        <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 mb-4" />
        <button className="w-full bg-yellow-500 text-black font-bold rounded-lg py-3">Accedi</button>
      </form>
    </main>;
  }

  const cards = stats ? [
    ['Clienti registrati', stats.customers_count],
    ['Spesa registrata', euro(stats.total_spend)],
    ['Punti distribuiti', stats.points_earned],
    ['Punti riscattati', stats.points_spent],
    ['Premi riscattati', stats.rewards_redeemed],
  ] : [];

  return <main className="min-h-screen bg-neutral-900 text-white p-4">
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-yellow-500">Dashboard Club</h1><p className="text-sm text-gray-400">SVAPOWEB SECONDIGLIANO</p></div>
        <div className="flex gap-2"><button onClick={loadStats} className="bg-yellow-500 text-black text-xs font-bold px-3 py-2 rounded-lg">Aggiorna</button><button onClick={logout} className="bg-neutral-700 text-xs px-3 py-2 rounded-lg">Esci</button></div>
      </div>
      {error && <div className="border border-red-800 bg-red-950/40 text-red-300 p-3 rounded-xl mb-4">{error}</div>}
      {!stats ? <p className="text-gray-400">Caricamento statistiche...</p> : <>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-7">
          {cards.map(([label,value])=><div key={label} className="bg-neutral-800 border border-neutral-700 rounded-2xl p-4"><p className="text-xs text-gray-400 mb-2">{label}</p><p className="text-xl font-extrabold text-yellow-400">{value}</p></div>)}
        </div>
        <section className="bg-neutral-800 border border-neutral-700 rounded-2xl p-5">
          <h2 className="font-bold mb-4">Attività recente</h2>
          {!stats.recent_activity?.length ? <p className="text-sm text-gray-500">Nessuna attività registrata.</p> :
          <div className="space-y-2">{stats.recent_activity.map(item=><div key={item.id} className="bg-neutral-900/70 rounded-xl p-3 flex justify-between gap-3">
            <div><p className="text-sm font-semibold">{item.customer_name}</p><p className="text-xs text-gray-500">{new Date(item.created_at).toLocaleString('it-IT')}</p></div>
            <div className="text-right"><p className={`font-bold ${item.type === 'REDEEM' ? 'text-red-300' : 'text-green-400'}`}>{item.type === 'REDEEM' ? `-${item.points_spent} PTS` : `+${item.points_earned} PTS`}</p><p className="text-xs text-gray-400">{item.type === 'REDEEM' ? item.reward_name : euro(item.amount_spent)}</p></div>
          </div>)}</div>}
        </section>
      </>}
    </div>
  </main>;
}
