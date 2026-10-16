'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAIL = 'svapowebsecondigliano@gmail.com';
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}
export default function ClientiPage() {
  const [session, setSession] = useState(undefined);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const supabase = client();
    if (!supabase) { setSession(null); setError('Supabase non configurato'); return; }
    supabase.auth.getSession().then(({data}) => setSession(data.session || null));
    const {data:listener} = supabase.auth.onAuthStateChange((_event,s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (session === undefined || !session || session.user?.email !== ADMIN_EMAIL) return;
    let cancelled = false;
    const supabase = client();
    setLoading(true); setError('');
    supabase.rpc('list_customers_for_cashier', { p_search:query, p_limit:50, p_offset:page * 50 })
      .then(({data,error:rpcError}) => {
        if(cancelled) return;
        if(rpcError) { setError('Elenco non disponibile: verifica che la migrazione sia applicata e i permessi dell’operatore siano corretti.'); return; }
        setItems(Array.isArray(data?.customers) ? data.customers : []);
        setTotal(Number(data?.total || 0));
      }).catch(() => { if(!cancelled) setError('Errore di connessione.'); })
      .finally(() => { if(!cancelled) setLoading(false); });
    return () => {cancelled = true;};
  }, [session,query,page]);
  if(session === undefined) return <main className="min-h-screen bg-neutral-900 text-white p-8">Caricamento...</main>;
  if(!session || session.user?.email !== ADMIN_EMAIL) return <main className="min-h-screen bg-neutral-900 text-white p-8"><h1 className="text-2xl text-yellow-400 font-bold">Gestione clienti</h1><p className="my-4">Accesso riservato all’operatore. Accedi prima dalla Cassa.</p><Link href="/cassa" className="underline text-yellow-400">Vai alla Cassa</Link></main>;
  return <main className="min-h-screen bg-neutral-900 text-white p-4 md:p-8">
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center gap-3 mb-6"><h1 className="text-2xl font-bold text-yellow-400">Gestione Clienti</h1><Link href="/cassa" className="text-yellow-400 underline">Torna alla Cassa</Link></div>
      <p className="text-sm text-neutral-400 mb-4">Elenco riservato degli iscritti. Consultazione soltanto: nessuna modifica a punti o tessere.</p>
      <form className="flex gap-2 mb-4" onSubmit={e => {e.preventDefault();setPage(0);setQuery(search.trim());}}>
        <input aria-label="Cerca nome, telefono o numero tessera" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, telefono o numero tessera" className="w-full p-3 bg-neutral-800 border border-neutral-600 rounded-lg"/>
        <button className="bg-yellow-500 text-black font-bold px-4 rounded-lg">Cerca</button>
      </form>
      {error && <p role="alert" className="bg-red-950 border border-red-700 p-3 rounded-lg mb-4">{error}</p>}
      <p className="mb-3 text-sm text-neutral-400">{loading ? 'Caricamento...' : total + ' clienti trovati'}</p>
      <div className="overflow-x-auto rounded-lg border border-neutral-700">
        <table className="w-full text-left text-sm"><thead className="bg-neutral-800"><tr><th className="p-3">Cliente</th><th className="p-3">Telefono</th><th className="p-3">Numero tessera</th><th className="p-3 text-right">Punti</th></tr></thead>
        <tbody>{items.map(c=><tr key={c.id} className="border-t border-neutral-700"><td className="p-3">{c.full_name}</td><td className="p-3">{c.phone}</td><td className="p-3 font-mono text-xs break-all">{c.id}</td><td className="p-3 text-right font-bold text-yellow-400">{c.points_balance ?? 0}</td></tr>)}</tbody></table>
      </div>
      {!loading && !error && items.length === 0 && <p className="p-5 text-neutral-400">Nessun cliente trovato.</p>}
      <div className="flex justify-between items-center mt-5">
        <button disabled={page===0 || loading} onClick={()=>setPage(p=>p-1)} className="bg-neutral-700 px-4 py-2 rounded disabled:opacity-40">Precedenti</button>
        <span className="text-sm text-neutral-400">Pagina {page+1} / {Math.max(1,Math.ceil(total/50))}</span>
        <button disabled={(page+1)*50>=total || loading} onClick={()=>setPage(p=>p+1)} className="bg-neutral-700 px-4 py-2 rounded disabled:opacity-40">Successivi</button>
      </div>
    </div>
  </main>;
}
