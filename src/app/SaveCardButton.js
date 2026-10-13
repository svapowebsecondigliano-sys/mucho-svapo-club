"use client";

import { useEffect, useState } from "react";

function getDevice() {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

function isInstalled() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export default function SaveCardButton() {
  const [device, setDevice] = useState("other");
  const [installed, setInstalled] = useState(false);
  const [installEvent, setInstallEvent] = useState(null);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    setDevice(getDevice());
    setInstalled(isInstalled());

    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallEvent(event);
    }
    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      setShowGuide(false);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const media = window.matchMedia?.("(display-mode: standalone)");
    function onDisplayModeChange() { setInstalled(isInstalled()); }
    media?.addEventListener?.("change", onDisplayModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener?.("change", onDisplayModeChange);
    };
  }, []);

  async function saveCard() {
    if (installEvent) {
      const event = installEvent;
      setInstallEvent(null);
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice?.outcome === "accepted") {
          setShowGuide(false);
        } else {
          setShowGuide(true);
        }
      } catch {
        setShowGuide(true);
      }
    } else {
      setShowGuide((value) => !value);
    }
  }

  return (
    <div className="mb-5 text-left">
      {installed ? (
        <div role="status" className="rounded-xl border border-green-800 bg-green-950/30 px-4 py-3 text-center text-sm text-green-300">
          ✓ Tessera già aggiunta alla schermata Home
        </div>
      ) : (
        <button
          type="button"
          onClick={saveCard}
          aria-expanded={showGuide}
          aria-controls="save-card-instructions"
          className="w-full rounded-xl bg-yellow-500 px-4 py-4 text-center font-extrabold text-black shadow-md transition hover:bg-yellow-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"
        >
          📲 Salva la tessera sul telefono
        </button>
      )}
      {!installed && (
        <p className="mt-2 text-center text-xs text-gray-400">Gratis · Non serve scaricare un'app dallo store</p>
      )}
      {!installed && showGuide && (
        <div id="save-card-instructions" className="mt-3 rounded-xl border border-yellow-500/40 bg-neutral-900 p-4 text-sm text-gray-200">
          <div className="flex items-center justify-between gap-3">
            <strong className="text-yellow-400">Come salvare la tessera</strong>
            <button type="button" onClick={() => setShowGuide(false)} aria-label="Chiudi istruzioni" className="rounded px-2 text-lg text-white">×</button>
          </div>
          {device === "ios" ? (
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Apri questa pagina in <strong>Safari</strong> (non nel browser interno di WhatsApp o Instagram).</li>
              <li>Tocca <strong>Condividi</strong>, l'icona con il quadrato e la freccia.</li>
              <li>Scegli <strong>Aggiungi alla schermata Home</strong> e conferma con <strong>Aggiungi</strong>.</li>
            </ol>
          ) : device === "android" ? (
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Apri questa pagina con <strong>Chrome</strong> (non nel browser interno di WhatsApp o Instagram).</li>
              <li>Apri il menu <strong>⋮</strong> in alto a destra.</li>
              <li>Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong> e conferma.</li>
            </ol>
          ) : (
            <p className="mt-3">Da smartphone, apri questa pagina in Safari (iPhone) o Chrome (Android), poi usa il menu del browser per aggiungerla alla schermata Home.</p>
          )}
          <p className="mt-3 text-xs text-gray-400">La tessera rimane collegata al tuo account. Non viene aggiunta ad Apple Wallet o Google Wallet.</p>
        </div>
      )}
    </div>
  );
}
