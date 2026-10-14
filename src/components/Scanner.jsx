import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

// Caméra pour lire un QR code ou un code-barres
export default function Scanner({ onScan, onClose }) {
  const lecteur = useRef(null);

  useEffect(() => {
    const h = new Html5Qrcode('lecteur');
    lecteur.current = h;
    let fini = false;
    h.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      (texte) => {
        if (fini) return;
        fini = true;
        onScan(texte);
      },
      () => {},
    ).catch(() => onClose('Caméra indisponible : autorise l\'accès ou saisis à la main.'));
    return () => {
      if (h.isScanning) h.stop().then(() => h.clear()).catch(() => {});
    };
  }, []);

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-stone-300 bg-black">
      <div id="lecteur" />
      <button type="button" className="w-full bg-stone-800 py-3 text-white" onClick={() => onClose()}>
        Fermer la caméra
      </button>
    </div>
  );
}
