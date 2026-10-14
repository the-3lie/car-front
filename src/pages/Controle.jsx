import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { ajouterControle, listePrete, verifierLocal } from '../store.js';
import Scanner from '../components/Scanner.jsx';

const STYLES = {
  EN_REGLE: { fond: 'bg-vert', titre: 'En règle', icone: '✓' },
  RECU_MANQUANT: { fond: 'bg-orange', titre: 'Reçu manquant', icone: '!' },
  CARTE_MANQUANTE: { fond: 'bg-orange', titre: 'Carte manquante', icone: '!' },
  NON_INSCRIT: { fond: 'bg-rouge', titre: 'Non inscrit', icone: '✕' },
  DOUBLON: { fond: 'bg-rouge', titre: 'Doublon / fraude', icone: '✕' },
};

export default function Controle({ surChangement }) {
  const [identifiant, setIdentifiant] = useState('');
  const [recu, setRecu] = useState('');
  const [nomSaisi, setNomSaisi] = useState('');
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

    const donnees = { identifiant: idSaisi.trim(), recu: recu.trim(), nomSaisi: nomSaisi.trim(), car: car.trim() };
    try {
      let rep;
      if (listePrete()) {
        rep = verifierLocal(donnees);
        await ajouterControle({
          car: donnees.car,
          identifiantSaisi: donnees.identifiant || donnees.recu,
          recuSaisi: donnees.recu || null,
          nomSaisi: donnees.nomSaisi || null,
          resultat: rep.resultat,
        });
        surChangement();
      } else {
        // Liste pas encore téléchargée : on interroge le serveur directement
        rep = await api.verifier(donnees);
      }
      setResultat({ ...rep, saisie: donnees.identifiant || donnees.recu });
      setIdentifiant('');
      setRecu('');
      setNomSaisi('');
      champId.current?.focus();
    } catch (e) {
      setErreur(e.horsLigne ? 'Pas de réseau et liste non téléchargée. Télécharge la liste avant le trajet.' : e.message);
    }
  }

  const st = resultat && STYLES[resultat.resultat];

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-stone-700">Car / ligne</span>
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
          <span className="mb-1 block text-stone-700">Matricule ou numéro de carte</span>
          <input ref={champId} className="champ" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoFocus autoCapitalize="characters" autoComplete="off" inputMode="text" />
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-700">Numéro de reçu (si présenté)</span>
          <input className="champ" value={recu} onChange={(e) => setRecu(e.target.value)} autoCapitalize="characters" autoComplete="off" />
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-700">Nom de l'étudiant (utile s'il n'est pas inscrit)</span>
          <input className="champ" value={nomSaisi} onChange={(e) => setNomSaisi(e.target.value)} autoComplete="off" />
        </label>
        <div className="flex gap-3">
          <button className="btn-principal flex-1">Contrôler</button>
          <button type="button" className="btn-secondaire" onClick={() => setCamera(true)}>Scanner</button>
        </div>
      </form>

      {erreur && <p role="alert" className="rounded-lg bg-rouge-clair p-3 text-rouge">{erreur}</p>}

      {resultat && (
        <section className={`${st.fond} rounded-2xl p-6 text-white`} aria-live="assertive">
          <div className="flex items-center gap-4">
            <span className="text-5xl font-bold leading-none" aria-hidden="true">{st.icone}</span>
            <div>
              <p className="text-3xl font-bold">{st.titre}</p>
              <p className="text-lg opacity-95">{resultat.message}</p>
            </div>
          </div>
          <div className="mt-4 border-t border-white/30 pt-3 text-lg">
            {resultat.etudiant ? (
              <>
                <p className="font-semibold">{resultat.etudiant.nom} {resultat.etudiant.prenom}</p>
                <p className="opacity-90">{resultat.etudiant.matricule}{resultat.etudiant.filiere ? ` · ${resultat.etudiant.filiere}` : ''}</p>
              </>
            ) : (
              <p className="opacity-90">Saisi : {resultat.saisie}. Enregistré dans le rapport.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
