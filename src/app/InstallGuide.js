"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function InstallGuide() {
  const pathname = usePathname();
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIos(/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true);
    setDismissed(sessionStorage.getItem("mucho_install_guide_dismissed") === "1");
  }, []);

  if (pathname !== "/" || !ios || installed || dismissed) return null;
  return (
    <aside aria-label="Come aggiungere la tessera alla Home" className="w-full max-w-sm mx-auto mb-4 rounded-xl border border-yellow-500/40 bg-neutral-800 p-4 text-white">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-sm text-yellow-400">Aggiungi la carta punti al tuo iPhone</strong>
        <button type="button" aria-label="Chiudi istruzioni" className="text-gray-300 text-lg" onClick={() => { sessionStorage.setItem("mucho_install_guide_dismissed", "1"); setDismissed(true); }}>×</button>
      </div>
      <p className="mt-2 text-sm leading-relaxed">
        Apri questo sito in <strong>Safari</strong>, tocca <strong>Condividi</strong> (il quadrato con la freccia), poi scegli <strong>Aggiungi alla schermata Home</strong> e conferma.
      </p>
      <p className="mt-1 text-xs text-gray-300">Se sei su WhatsApp o Instagram, apri prima il link in Safari. Non è necessario l’App Store.</p>
    </aside>
  );
}
