'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Html5QrcodeScanner } from 'html5-qrcode';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Cassa() {
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    
    scanner.render((decodedText) => {
      loadCustomer(decodedText);
      scanner.clear();
    }, () => {});

    return () => { scanner.clear().catch(() => {}); };
  }, []);

  async function loadCustomer(id) {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single();
    if (data) setCustomer(data);
  }

  async function handleAddPoints(e) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const pointsToEarn = Math.floor(parsedAmount);

    if (pointsToEarn <= 0) return;

    const { error } = await supabase.rpc('add_points', {
      cust_id: customer.id,
      pts: pointsToEarn,
      amount: parsedAmount
    });

    if (!error) {
      setMessage(`Accreditati +${pointsToEarn} Punti con successo!`);
      setCustomer(prev => ({ ...prev, points_balance: prev.points_balance + pointsToEarn }));
      setAmount('');
    } else {
      setMessage('Errore durante l\'accredito');
    }
  }

  return (
    <div className="min-h-screen bg-neutral-900 text-white p-4 flex flex-col items-center">
      <h1 className="text-xl font-bold text-yellow-500 mb-4">Cassa - Mucho Svapo Club</h1>

      {!customer ? (
        <div className="w-full max-w-sm bg-neutral-800 p-4 rounded-xl">
          <div id="reader" className="w-full"></div>
          <p className="text-xs text-center text-gray-400 mt-2">Inquadra il QR Code dello smartphone del cliente</p>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-neutral-800 p-6 rounded-2xl border border-neutral-700">
          <p className="text-lg font-bold">{customer.full_name}</p>
          <p className="text-xs text-gray-400 mb-4">Saldo attuale: <span className="text-yellow-400 font-bold">{customer.points_balance} PTS</span></p>

          <form onSubmit={handleAddPoints} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400">Importo speso (€)</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="es. 18.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-2xl font-bold text-yellow-400 text-center mt-1 focus:outline-none"
              />
            </div>
            
            <p className="text-xs text-center text-gray-400">
              Punti da accreditare: <strong className="text-white">{amount ? Math.floor(parseFloat(amount) || 0) : 0} PTS</strong>
            </p>

            <button type="submit" className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-3 rounded-lg">
              Conferma e Accredita Punti
            </button>
          </form>

          {message && <p className="text-sm text-green-400 font-semibold text-center mt-4">{message}</p>}

          <button 
            onClick={() => { setCustomer(null); setMessage(''); }}
            className="w-full mt-4 bg-neutral-700 text-xs py-2 rounded-lg text-gray-300"
          >
            Scansiona altro cliente
          </button>
        </div>
      )}
    </div>
  );
}