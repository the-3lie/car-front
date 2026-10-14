import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ajouterControle, listePrete, verifierLocal } from '../store.js';
import Scanner from '../components/Scanner.jsx';

// Ce que le contrôleur voit : Accepté (vert) ou Il n'existe pas (rouge)
const STYLES = {
  EN_REGLE: { fond: 'bg-vert', titre: 'Accepté', icone: '✓', note: null },
  RECU_MANQUANT: { fond: 'bg-vert', titre: 'Accepté', icone: '✓', note: 'Attention : reçu manquant' },
  CARTE_MANQUANTE: { fond: 'bg-vert', titre: 'Accepté', icone: '✓', note: 'Attention : carte manquante' },
  NON_INSCRIT: { fond: 'bg-rouge', titre: "Il n'existe pas", icone: '✕', note: null },
  DOUBLON: { fond: 'bg-rouge', titre: 'Doublon / fraude', icone: '✕', note: null },
};

export default function Controle({ surChangement }) {
  const [identifiant, setIdentifiant] = useState('');
  const [recu, setRecu] = useState('');
  const [car, setCar] = useState(localStorage.getItem('car') || '');
  const [resultat, setResultat] = useState(null);
  const [erreur, setErreur] = useState('');
  const [camera, setCamera] = useState(false);
  const champId = useRef(null);

  useEffect(() => { localStorage.setItem('car', car); }, [car]);

  async function controler(idSaisi = identifiant) {
    setErreur('');
    if (!idSaisi.trim() && !recu.trim()) return;
    if (!car.trim()) return setErreur('Indique le numéro ou le nom du car avant de contrôler.');

    const donnees = { identifiant: idSaisi.trim(), recu: recu.trim(), car: car.trim() };
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
      setResultat({ ...rep, saisie: donnees.identifiant || donnees.recu });
      if (rep.resultat !== 'PLUSIEURS') {
        setIdentifiant('');
        setRecu('');
        champId.current?.focus();
      }
    } catch (e) {
      setErreur(e.horsLigne ? 'Pas de réseau et liste non téléchargée. Télécharge la liste avant le trajet.' : e.message);
    }
  }

  const st = resultat && STYLES[resultat.resultat];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-stone-700">Ton car / ta ligne</span>
        <input className="champ" value={car} onChange={(e) => setCar(e.target.value)} placeholder="Ex. Car 3, ligne Cocody" />
      </label>

      {camera && (
        <Scanner
          onScan={(t) => { setCamera(false); setIdentifiant(t); controler(t); }}
          onClose={(msg) => { setCamera(false); if (msg) setErreur(msg); }}
        />
      )}

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
          <button type="button" className="btn-secondaire" onClick={() => setCamera(true)}>Scanner</button>
        </div>
      </form>

      {erreur && <p role="alert" className="rounded-lg bg-rouge-clair p-3 text-rouge">{erreur}</p>}

      {resultat?.resultat === 'PLUSIEURS' && (
        <section className="rounded-2xl border border-stone-300 bg-white p-4" aria-live="polite">
          <p className="mb-3 text-lg font-semibold">{resultat.message}</p>
          <ul className="space-y-2">
            {resultat.candidats.map((c) => (
              <li key={c.matricule}>
                <button type="button" className="btn-secondaire w-full text-left" onClick={() => { setIdentifiant(c.matricule); controler(c.matricule); }}>
                  <span className="block">{c.nom} {c.prenom}</span>
                  <span className="block text-base font-normal text-stone-600">{c.matricule}{c.filiere ? ` · ${c.filiere}` : ''}{c.car ? ` · Car ${c.car}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resultat && st && (
        <section className={`${st.fond} rounded-2xl p-6 text-white`} aria-live="assertive">
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
              {st.note && <p className="mt-3 rounded-lg bg-black/25 px-3 py-2 text-lg">{st.note}</p>}
              {resultat.resultat === 'DOUBLON' && <p className="mt-3 text-lg">{resultat.message}</p>}
            </div>
          ) : (
            <p className="mt-4 border-t border-white/30 pt-3 text-lg opacity-95">Saisi : {resultat.saisie}. Enregistré dans le rapport.</p>
          )}
        </section>
      )}
    </div>
  );
}
