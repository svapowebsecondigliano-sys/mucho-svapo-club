'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Cassa() {
  const [customer, setCustomer] = useState(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let scannerInstance = null;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
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
    }).catch((err) => console.error('Errore scanner:', err));

    return () => {
      if (scannerInstance) {
        scannerInstance.clear().catch(() => {});
      }
    };
  }, []);

  async function loadCustomer(id) {
    try {
      const { data } = await supabase.from('customers').select('*').eq('id', id).single();
      if (data) setCustomer(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleAddPoints(e) {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    const pointsToEarn = Math.floor(parsedAmount);

    if (pointsToEarn <= 0) return;

    try {
      const { error } = await supabase.rpc('add_points', {
        cust_id: customer.id,
        pts: pointsToEarn,
        amount: parsedAmount
      });

      if (!error) {
        setMessage(`Accreditati +${pointsToEarn} Punti con successo!`);
        setCustomer(prev => ({ ...prev, points_balance: (prev.points_balance || 0) + pointsToEarn }));
        setAmount('');
      } else {
        setMessage('Errore durante l\'accredito: ' + error.message);
      }
    } catch (err) {
      setMessage('Errore di connessione');
    }
  }

  return (