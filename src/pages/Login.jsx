import { useState } from 'react';
import { api, setSession } from '../api.js';

export default function Login({ onConnecte }) {
  const [nom, setNom] = useState('');
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState('');
  const [attente, setAttente] = useState(false);

  async function valider(e) {
    e.preventDefault();
    setErreur('');
    setAttente(true);
    try {
      const s = await api.login(nom, mdp);
      setSession(s);
      onConnecte(s);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setAttente(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-bold text-vert-fonce">Contrôle du car</h1>
      <p className="mb-8 text-stone-600">Connecte-toi pour contrôler les étudiants.</p>
      <form onSubmit={valider} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-stone-700">Nom d'utilisateur</span>
          <input className="champ" value={nom} onChange={(e) => setNom(e.target.value)} autoCapitalize="none" autoComplete="username" required />
        </label>
        <label className="block">
          <span className="mb-1 block text-stone-700">Mot de passe</span>
          <input className="champ" type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" required />
        </label>
        {erreur && <p role="alert" className="rounded-lg bg-rouge-clair p-3 text-rouge">{erreur}</p>}
        <button className="btn-principal w-full" disabled={attente}>{attente ? 'Connexion…' : 'Se connecter'}</button>
      </form>
    </main>
  );
}
