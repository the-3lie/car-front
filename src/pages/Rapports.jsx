import { useEffect, useState } from 'react';
import { api } from '../api.js';

const LIBELLES = {
  EN_REGLE: 'En règle',
  RECU_MANQUANT: 'Reçu manquant',
  CARTE_MANQUANTE: 'Carte manquante',
  NON_INSCRIT: 'Non inscrit',
  DOUBLON: 'Doublon / fraude',
};
const COULEURS = {
  EN_REGLE: 'bg-vert-clair text-vert-fonce',
  RECU_MANQUANT: 'bg-orange-clair text-orange',
  CARTE_MANQUANTE: 'bg-orange-clair text-orange',
  NON_INSCRIT: 'bg-rouge-clair text-rouge',
  DOUBLON: 'bg-rouge-clair text-rouge',
};

export default function Rapports() {
  const [filtres, setFiltres] = useState({ from: '', to: '', car: '', problemes: '1' });
  const [lignes, setLignes] = useState([]);
  const [cars, setCars] = useState([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  const propres = () => Object.fromEntries(Object.entries(filtres).filter(([, v]) => v));

  async function charger() {
    setErreur('');
    setChargement(true);
    try {
      setLignes(await api.controles(propres()));
      setCars(await api.cars());
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }
  useEffect(() => { charger(); }, []);

  async function exporter() {
    try {
      const blob = await api.exporter(propres());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rapport-controles.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErreur(e.message);
    }
  }

  const compte = lignes.reduce((m, l) => ({ ...m, [l.resultat]: (m[l.resultat] || 0) + 1 }), {});
  const maj = (k) => (e) => setFiltres({ ...filtres, [k]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="mb-1 block text-stone-700">Du</span><input type="date" className="champ" value={filtres.from} onChange={maj('from')} /></label>
        <label className="block"><span className="mb-1 block text-stone-700">Au</span><input type="date" className="champ" value={filtres.to} onChange={maj('to')} /></label>
      </div>
      <label className="block">
        <span className="mb-1 block text-stone-700">Car</span>
        <select className="champ" value={filtres.car} onChange={maj('car')}>
          <option value="">Tous les cars</option>
          {cars.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-3 text-lg">
        <input type="checkbox" className="h-5 w-5" checked={filtres.problemes === '1'} onChange={maj('problemes')} />
        Seulement les cas pas en règle
      </label>
      <div className="flex gap-3">
        <button className="btn-principal flex-1" onClick={charger} disabled={chargement}>{chargement ? 'Chargement…' : 'Afficher'}</button>
        <button className="btn-secondaire" onClick={exporter}>Exporter Excel</button>
      </div>

      {erreur && <p role="alert" className="rounded-lg bg-rouge-clair p-3 text-rouge">{erreur}</p>}

      <div className="flex flex-wrap gap-2">
        {Object.entries(compte).map(([k, n]) => (
          <span key={k} className={`rounded-full px-3 py-1 font-semibold ${COULEURS[k]}`}>{LIBELLES[k]} : {n}</span>
        ))}
      </div>

      {!chargement && lignes.length === 0 && <p className="text-stone-600">Aucun contrôle pour ces filtres.</p>}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full min-w-[640px] text-left">
          <thead className="bg-stone-100 text-stone-700">
            <tr><th className="p-3">Date</th><th className="p-3">Car</th><th className="p-3">Saisi</th><th className="p-3">Nom saisi</th><th className="p-3">Contrôleur</th><th className="p-3">Statut</th></tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.id} className="border-t border-stone-100">
                <td className="p-3 whitespace-nowrap">{new Date(l.date).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td className="p-3">{l.car}</td>
                <td className="p-3">{l.identifiantSaisi}{l.recuSaisi ? ` / ${l.recuSaisi}` : ''}</td>
                <td className="p-3">{l.nomSaisi || '-'}</td>
                <td className="p-3">{l.controleur}</td>
                <td className="p-3"><span className={`rounded-full px-2 py-1 text-sm font-semibold ${COULEURS[l.resultat]}`}>{LIBELLES[l.resultat]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
