import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

// Lecture sur TOUTE l'image de la caméra, en haute résolution, avec mise au point continue.
// Le QR code n'a pas besoin d'être placé dans un carré : il est trouvé n'importe où dans l'image,
// même petit ou dense. Détecteur natif du navigateur si disponible (très rapide), sinon jsQR.
export default function Scanner({ onScan, onClose }) {
  const rappel = useRef(onScan);
  rappel.current = onScan; // toujours la dernière version (car, reçu…)
  const fermer = useRef(onClose);
  fermer.current = onClose;
  const video = useRef(null);
  const piste = useRef(null);
  const [zoom, setZoom] = useState(null); // { min, max, step, valeur } si la caméra sait zoomer

  useEffect(() => {
    let actif = true;
    let flux = null;
    let minuteur = null;
    const dernier = { texte: '', t: 0 };

    function trouve(texte) {
      const now = Date.now();
      if (texte === dernier.texte && now - dernier.t < 4000) { dernier.t = now; return; } // même code toujours devant la caméra
      if (now - dernier.t < 1200) return; // laisse le temps de voir le résultat
      dernier.texte = texte;
      dernier.t = now;
      rappel.current(texte);
    }

    async function demarrer() {
      try {
        flux = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        });
      } catch {
        return fermer.current("Caméra indisponible : autorise l'accès à la caméra dans le navigateur, ou saisis à la main.");
      }
      if (!actif) { flux.getTracks().forEach((t) => t.stop()); return; }

      const p = flux.getVideoTracks()[0];
      piste.current = p;
      // Mise au point automatique continue + zoom léger (utile pour les petits QR codes)
      try {
        const caps = p.getCapabilities?.() || {};
        const avance = {};
        if (caps.focusMode?.includes('continuous')) avance.focusMode = 'continuous';
        if (caps.zoom) {
          const depart = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2));
          avance.zoom = depart;
          setZoom({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1, valeur: depart });
        }
        if (Object.keys(avance).length) await p.applyConstraints({ advanced: [avance] });
      } catch { /* réglages non supportés : on continue sans */ }

      const v = video.current;
      v.srcObject = flux;
      try { await v.play(); } catch { /* lecture auto bloquée */ }

      const natif = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      let occupe = false;

      async function lire() {
        if (!actif) return;
        if (!occupe && v.readyState >= 2 && v.videoWidth) {
          occupe = true;
          try {
            if (natif) {
              const codes = await natif.detect(v);
              if (codes.length) trouve(codes[0].rawValue);
            } else {
              // Image entière, 1280 px de large maximum : assez fin pour un petit QR code
              const echelle = Math.min(1, 1280 / v.videoWidth);
              canvas.width = Math.round(v.videoWidth * echelle);
              canvas.height = Math.round(v.videoHeight * echelle);
              ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (code?.data) trouve(code.data);
            }
          } catch { /* image pas prête : on réessaie */ }
          occupe = false;
        }
        minuteur = setTimeout(lire, natif ? 30 : 60);
      }
      lire();
    }

    demarrer();
    return () => {
      actif = false;
      clearTimeout(minuteur);
      flux?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function changerZoom(valeur) {
    setZoom((z) => ({ ...z, valeur }));
    piste.current?.applyConstraints({ advanced: [{ zoom: valeur }] }).catch(() => {});
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-300 bg-black">
      <video ref={video} playsInline muted autoPlay className="block w-full" />
      {zoom && (
        <label className="flex items-center gap-3 bg-stone-900 px-4 py-2 text-white">
          <span>Zoom</span>
          <input
            type="range" className="flex-1" min={zoom.min} max={zoom.max} step={zoom.step} value={zoom.valeur}
            onChange={(e) => changerZoom(Number(e.target.value))}
          />
        </label>
      )}
      <button type="button" className="w-full bg-stone-800 py-3 text-white" onClick={() => onClose()}>
        Fermer la caméra
      </button>
    </div>
  );
}
