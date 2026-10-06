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
    let scannerInstance = null;

    // Carica lo scanner solo sul browser del client per non bloccare la build Next.js
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      scannerInstance = new Html5QrcodeScanner('reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      
      scannerInstance.render((decodedText) => {
        loadCustomer(decodedText);
        scannerInstance.clear();
      }, () => {});
    }).catch(err => console.error('Errore scanner:', err));

    return () => {
      if (scannerInstance) {
        scannerInstance.clear().catch(() => {});
      }
    };
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