'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl || '', supabaseKey || '');

export default function Home() {
  const [customer, setCustomer] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

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
    setLoading(true);
    setErrorMsg('');

    if (!supabaseUrl || !supabaseKey) {
      setErrorMsg('Errore: Variabili d\'ambiente Supabase mancanti su Vercel!');
      setLoading(false);
      return;
    }

    const qrId = 'MS-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    
    const { data, error } = await supabase
      .from('customers')
      .insert([{ full_name: name, phone: phone, qr_code_id: qrId }])
      .select()
      .single();

    if (error) {
      console.error(error);
      setErrorMsg('Errore Supabase: ' + error.message);
    } else if (data) {
      localStorage.setItem('mucho_svapo_user_id', data.id);
      setCustomer(data);
    }
    setLoading(false);
  }

  if (customer) {
    return (