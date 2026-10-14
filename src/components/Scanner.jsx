import { useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Caméra en continu : on passe les QR codes un par un, sans rouvrir la caméra.
// Un même code tenu devant l'objectif n'est lu qu'une fois.
export default function Scanner({ onScan, onClose }) {
  const rappel = useRef(onScan);
  rappel.current = onScan; // toujours la dernière version (car, reçu…)
  const dernier = useRef({ texte: '', t: 0 });

  useEffect(() => {
    const lecteur = new Html5Qrcode('lecteur', { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false, useBarcodeDetector: true });
    lecteur
      .start(
        { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        {
          fps: 20,
          // Petite zone = moins de pixels à analyser = lecture plus rapide
          qrbox: (w, h) => { const c = Math.max(120, Math.floor(Math.min(w, h) * 0.5)); return { width: c, height: c }; },
          disableFlip: true,
        },
        (texte) => {
          const now = Date.now();
          const d = dernier.current;
          if (texte === d.texte && now - d.t < 4000) { d.t = now; return; } // même code toujours devant la caméra
          if (now - d.t < 1200) return; // laisse le temps de voir le résultat
          dernier.current = { texte, t: now };
          rappel.current(texte);
        },
        () => {},
      )
      .catch(() => onClose("Caméra indisponible : autorise l'accès à la caméra dans le navigateur, ou saisis à la main."));
    return () => {
      if (lecteur.isScanning) lecteur.stop().then(() => lecteur.clear()).catch(() => {});
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-stone-300 bg-black">
      <div id="lecteur" />
      <button type="button" className="w-full bg-stone-800 py-3 text-white" onClick={() => onClose()}>
        Fermer la caméra
      </button>
    </div>
  );
}
