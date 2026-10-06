'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Home() {
  const [customer, setCustomer] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const savedId = localStorage.getItem('mucho_svapo_user_id');
    if (savedId) fetchCustomer(savedId);
  }, []);

  async function fetchCustomer(id) {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single();
    if (data) setCustomer(data);
  }

  async function handleRegister(e) {
    e.preventDefault();
    const qrId = 'MS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    const { data } = await supabase
      .from('customers')
      .insert([{ full_name: name, phone: phone, qr_code_id: qrId }])
      .select()
      .single();

    if (data) {
      localStorage.setItem('mucho_svapo_user_id', data.id);
      setCustomer(data);
    }
  }

  if (customer) {
    return (
      <div className="min-h-screen bg-neutral-900 text-white flex flex-col items-center justify-center p-4">
        <div className="bg-neutral-800 p-6 rounded-2xl shadow-xl w-full max-w-sm text-center border border-neutral-700">
          <h1 className="text-2xl font-bold tracking-wide text-yellow-500 mb-1">MUCHO SVAPO CLUB</h1>
          <p className="text-sm text-gray-400 mb-6">Carta Fedeltà Digitale</p>
          
          <div className="bg-white p-4 rounded-xl inline-block mb-6 shadow-inner">
            <QRCode value={customer.id} size={180} />
          </div>

          <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800 mb-4">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Saldo Punti</p>
            <p className="text-4xl font-extrabold text-yellow-400 mt-1">{customer.points_balance} PTS</p>
          </div>

          <p className="text-sm font-semibold text-gray-300">{customer.full_name}</p>
          <p className="text-xs text-gray-500">{customer.phone}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white flex items-center justify-center p-4">
      <form onSubmit={handleRegister} className="bg-neutral-800 p-6 rounded-2xl w-full max-w-sm border border-neutral-700">
        <h1 className="text-2xl font-bold text-center text-yellow-500 mb-2">MUCHO SVAPO CLUB</h1>
        <p className="text-sm text-gray-400 text-center mb-6">Registrati per iniziare a raccogliere punti</p>
        
        <input
          type="text"
          placeholder="Nome e Cognome"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mb-3 focus:outline-none focus:border-yellow-500"
        />
        <input
          type="tel"
          placeholder="Numero di Telefono"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white mb-6 focus:outline-none focus:border-yellow-500"
        />
        <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg transition">
          Crea la mia Tessera
        </button>
      </form>
    </div>
  );
}