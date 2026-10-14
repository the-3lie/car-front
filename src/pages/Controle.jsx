import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ajouterControle, extraireMatricule, listePrete, verifierLocal } from '../store.js';
import Scanner from '../components/Scanner.jsx';

// Ce que le contrôleur voit : vert = accepté, orange = autre car, rouge = n'existe pas
const STYLES = {
  EN_REGLE: { fond: 'bg-vert', titre: 'Accepté', icone: '✓' },
  RECU_MANQUANT: { fond: 'bg-vert', titre: 'Accepté', icone: '✓' },
  CARTE_MANQUANTE: { fond: 'bg-vert', titre: 'Accepté', icone: '✓' },
  AUTRE_CAR: { fond: 'bg-orange', titre: 'Pas dans ce car', icone: '!' },
  NON_INSCRIT: { fond: 'bg-rouge', titre: "Il n'existe pas", icone: '✕' },
  DOUBLON: { fond: 'bg-rouge', titre: 'Doublon / fraude', icone: '✕' },
};
const NOTES = { RECU_MANQUANT: 'Attention : reçu manquant', CARTE_MANQUANTE: 'Attention : carte manquante' };

export default function Controle({ surChangement }) {
  const [identifiant, setIdentifiant] = useState('');
  const [recu, setRecu] = useState('');
  const [car, setCar] = useState(localStorage.getItem('car') || '');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');
  // La caméra s'ouvre toute seule : le QR code est lu et vérifié sans rien toucher
  const [camera, setCamera] = useState(() => localStorage.getItem('modeSaisie') !== '1');
  const [compteur, setCompteur] = useState(0);
  const champId = useRef(null);

  const enCours = useRef(false);
  const [cleScanner, setCleScanner] = useState(0); // change à chaque rafraîchissement : la caméra redémarre à neuf

  useEffect(() => { localStorage.setItem('car', car); }, [car]);
  // Après un scan, le résultat reste 5 secondes puis l'écran se remet à zéro, prêt pour le suivant
  useEffect(() => {
    if (!camera || !resultat || resultat.resultat === 'PLUSIEURS') return;
    const t = setTimeout(() => {
      setResultat(null);
      setErreur('');
      setCleScanner((n) => n + 1); // rafraîchit le scanner : caméra relancée, prête pour la personne suivante
    }, 5000);
    return () => clearTimeout(t);
  }, [resultat, camera]);
  useEffect(() => { localStorage.setItem('modeSaisie', camera ? '0' : '1'); }, [camera]);

  // depuisScan : la vérification se fait même sans numéro de car (le car n'est alors pas comparé)
  async function controler(idSaisi = identifiant, recuSaisi = recu, depuisScan = false) {
    setErreur('');
    if (!idSaisi.trim() && !recuSaisi.trim()) return;
    if (!depuisScan && !car.trim()) return setErreur('Indique le numéro du car avant de contrôler.');
    if (enCours.current) return;
    enCours.current = true;

    const donnees = { identifiant: idSaisi.trim(), recu: recuSaisi.trim(), car: car.trim() };
    try {
      let rep;
      if (listePrete()) {
        rep = verifierLocal(donnees);
        // Plusieurs noms possibles : rien n'est enregistré tant que le bon n'est pas choisi
        if (rep.resultat !== 'PLUSIEURS') {
          await ajouterControle({
            car: donnees.car,
            identifiantSaisi: donnees.identifiant || donnees.recu,
            recuSaisi: donnees.recu || null,
            nomSaisi: null,
            resultat: rep.resultat,
          });
          surChangement();
        }
      } else {
        // Liste pas encore téléchargée : on interroge le serveur directement
        rep = await api.verifier(donnees);
      }
      setResultat({ ...rep, saisie: donnees.identifiant || donnees.recu, horodatage: Date.now() });
      if (rep.resultat !== 'PLUSIEURS') {
        setCompteur((n) => n + 1);
        navigator.vibrate?.(rep.resultat === 'NON_INSCRIT' || rep.resultat === 'DOUBLON' || rep.resultat === 'AUTRE_CAR' ? [200, 100, 200] : 120);
        setIdentifiant('');
        setRecu('');
        if (!camera) champId.current?.focus();
      }
    } catch (e) {
      setErreur(e.horsLigne ? 'Pas de réseau et liste non téléchargée. Télécharge la liste avant le trajet.' : e.message);
    } finally {
      enCours.current = false;
    }
  }

  const st = resultat && STYLES[resultat.resultat];
  const note = resultat && NOTES[resultat.paiement || resultat.resultat];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-stone-700">Numéro de ton car</span>
        <input className="champ" value={car} onChange={(e) => setCar(e.target.value)} placeholder="Ex. 3" inputMode="text" />
      </label>

      {erreur && <p role="alert" className="rounded-lg bg-rouge-clair p-3 text-rouge">{erreur}</p>}

      {resultat?.resultat === 'PLUSIEURS' && (
        <section className="rounded-2xl border border-stone-300 bg-white p-4" aria-live="polite">
          <p className="mb-3 text-lg font-semibold">{resultat.message}</p>
          <ul className="space-y-2">
            {resultat.candidats.map((c) => (
              <li key={c.matricule}>
                <button type="button" className="btn-secondaire w-full text-left" onClick={() => controler(c.matricule, '')}>
                  <span className="block">{c.nom} {c.prenom}</span>
                  <span className="block text-base font-normal text-stone-600">{c.matricule}{c.filiere ? ` · ${c.filiere}` : ''}{c.car ? ` · Car ${c.car}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resultat && st && (
        <section key={resultat.horodatage} className={`${st.fond} relative overflow-hidden rounded-2xl p-6 text-white`} aria-live="assertive">
          {camera && <div className="barre-5s absolute inset-x-0 top-0 h-1.5 bg-white/70" />}
          <div className="flex items-center gap-4">
            <span className="text-5xl font-bold leading-none" aria-hidden="true">{st.icone}</span>
            <p className="text-3xl font-bold">{st.titre}</p>
          </div>

          {resultat.etudiant ? (
            <div className="mt-4 border-t border-white/30 pt-3">
              <p className="text-2xl font-semibold">{resultat.etudiant.nom} {resultat.etudiant.prenom}</p>
              <p className="text-lg opacity-90">{resultat.etudiant.matricule}{resultat.etudiant.filiere ? ` · ${resultat.etudiant.filiere}` : ''}</p>
              <p className="mt-3 text-4xl font-bold">
                {resultat.etudiant.car ? `Car n° ${resultat.etudiant.car}` : 'Car non indiqué'}
              </p>
              {resultat.resultat !== 'AUTRE_CAR' && resultat.resultat !== 'DOUBLON' && resultat.etudiant.car && (
                <p className="mt-1 text-lg">Il est bien dans ce car</p>
              )}
              {resultat.resultat === 'AUTRE_CAR' && <p className="mt-1 text-lg">Il n'est pas dans le car n° {car}</p>}
              {resultat.resultat === 'DOUBLON' && <p className="mt-3 text-lg">{resultat.message}</p>}
              {note && <p className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-lg">{note}</p>}
            </div>
          ) : (
            <p className="mt-4 border-t border-white/30 pt-3 text-lg opacity-95">Saisi : {resultat.saisie}. Enregistré dans le rapport.</p>
          )}
        </section>
      )}
      {camera ? (
        <>
          <Scanner
            key={cleScanner}
            onScan={(t) => controler(extraireMatricule(t), '', true)}
            onClose={(msg) => { setCamera(false); if (msg) setErreur(msg); }}
          />
          <p className="text-center text-stone-600">
            Présente le QR code devant la caméra : il est lu et vérifié automatiquement. {compteur > 0 && `${compteur} vérifié(s).`}
          </p>
          {!car.trim() && <p className="text-center text-orange">Sans numéro de car, le car de l'étudiant n'est pas comparé.</p>}
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); controler(); }} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-stone-700">Nom, matricule ou numéro de carte</span>
            <input ref={champId} className="champ" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoFocus autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1 block text-stone-700">Numéro de reçu (si présenté)</span>
            <input className="champ" value={recu} onChange={(e) => setRecu(e.target.value)} autoCapitalize="characters" autoComplete="off" />
          </label>
          <div className="flex gap-3">
            <button className="btn-principal flex-1">Vérifier</button>
            <button type="button" className="btn-secondaire" onClick={() => { setCompteur(0); setCamera(true); }}>Scanner un QR code</button>
          </div>
        </form>
      )}

    </div>
  );
}
