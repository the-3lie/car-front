import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Admin() {
  const [fichier, setFichier] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [users, setUsers] = useState([]);
  const [nouveau, setNouveau] = useState({ nom: '', motDePasse: '' });
  const [info, setInfo] = useState('');

  const chargerUsers = () => api.utilisateurs().then(setUsers).catch(() => {});
  useEffect(() => { chargerUsers(); }, []);

  async function importer() {
    setErreur(''); setBilan(null); setEnvoi(true);
    try { setBilan(await api.importer(fichier)); }
    catch (e) { setErreur(e.message); }
    finally { setEnvoi(false); }
  }

  async function creer(e) {
    e.preventDefault();
    setErreur(''); setInfo('');
    try {
      await api.creerUtilisateur(nouveau);
      setInfo(`Compte « ${nouveau.nom} » créé.`);
      setNouveau({ nom: '', motDePasse: '' });
      chargerUsers();
    } catch (err) { setErreur(err.message); }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Importer les listes</h2>
        <p className="text-stone-600">
          Fichier Excel ou CSV avec les colonnes : matricule, nom, prénom, filière, car (numéro du car de l'étudiant), carte, reçu, montant, période.
          Seul le matricule est obligatoire. Importer deux fois le même fichier ne crée pas de doublons.
        </p>
        <input type="file" accept=".xlsx,.xls,.csv" className="champ" onChange={(e) => setFichier(e.target.files[0] || null)} />
        <button className="btn-principal w-full" disabled={!fichier || envoi} onClick={importer}>{envoi ? 'Import en cours…' : 'Importer'}</button>

        {bilan && (
          <div className="rounded-xl bg-vert-clair p-4 text-vert-fonce">
            <p className="font-semibold">Import terminé</p>
            <p>{bilan.lignesLues} lignes lues · {bilan.etudiants} étudiants · {bilan.cartes} cartes · {bilan.recus} reçus</p>
            {bilan.ignorees.length > 0 && <p className="mt-2">{bilan.ignorees.length} ligne(s) ignorée(s) : matricule manquant (ex. ligne {bilan.ignorees[0].ligne}).</p>}
            {bilan.conflits.length > 0 && (
              <div className="mt-2 rounded-lg bg-rouge-clair p-3 text-rouge">
                <p className="font-semibold">{bilan.conflits.length} conflit(s) : numéro déjà rattaché à un autre étudiant</p>
                <ul className="mt-1 list-disc pl-5">
                  {bilan.conflits.slice(0, 20).map((c, i) => <li key={i}>{c.type} {c.numero} (matricule {c.matricule})</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Comptes contrôleurs</h2>
        <form onSubmit={creer} className="space-y-3">
          <input className="champ" placeholder="Nom d'utilisateur" value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} autoCapitalize="none" required />
          <input className="champ" type="password" placeholder="Mot de passe (6 caractères minimum)" value={nouveau.motDePasse} onChange={(e) => setNouveau({ ...nouveau, motDePasse: e.target.value })} required />
          <button className="btn-secondaire w-full">Créer le compte</button>
        </form>
        {info && <p className="rounded-lg bg-vert-clair p-3 text-vert-fonce">{info}</p>}
        <ul className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
          {users.map((u) => (
            <li key={u.id} className="flex justify-between p-3"><span>{u.nom}</span><span className="text-stone-500">{u.role === 'ADMIN' ? 'Admin' : 'Contrôleur'}</span></li>
          ))}
        </ul>
      </section>

      {erreur && <p role="alert" className="rounded-lg bg-rouge-clair p-3 text-rouge">{erreur}</p>}
    </div>
  );
}
