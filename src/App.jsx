import { useCallback, useEffect, useState } from 'react';
import { getSession, setSession } from './api.js';
import { chargerListe, fileAttente, synchroniser, telechargerListe } from './store.js';
import Login from './pages/Login.jsx';
import Controle from './pages/Controle.jsx';
import Rapports from './pages/Rapports.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const [session, setSess] = useState(getSession());
  const [onglet, setOnglet] = useState('controle');
  const [enLigne, setEnLigne] = useState(navigator.onLine);
  const [liste, setListe] = useState(null);
  const [enAttente, setEnAttente] = useState(0);
  const [message, setMessage] = useState('');

  const rafraichirFile = useCallback(async () => setEnAttente((await fileAttente()).length), []);

  const envoyer = useCallback(async () => {
    try {
      const n = await synchroniser();
      if (n) setMessage(`${n} contrôle(s) envoyé(s) au serveur.`);
    } catch { /* on réessaiera plus tard */ }
    rafraichirFile();
  }, [rafraichirFile]);

  const majListe = useCallback(async () => {
    setMessage('Téléchargement de la liste…');
    try {
      setListe(await telechargerListe());
      setMessage('Liste à jour.');
    } catch (e) {
      setMessage(e.horsLigne ? 'Pas de réseau : la liste actuelle est conservée.' : e.message);
    }
  }, []);

  // Au démarrage : charger la liste locale, puis la mettre à jour si on a du réseau
  useEffect(() => {
    if (!session) return;
    chargerListe().then((l) => { setListe(l); if (navigator.onLine) majListe(); });
    rafraichirFile();
    if (navigator.onLine) envoyer();
  }, [session]);

  useEffect(() => {
    const on = () => { setEnLigne(true); envoyer(); };
    const off = () => setEnLigne(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    const t = setInterval(() => navigator.onLine && envoyer(), 30000);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t); };
  }, [envoyer]);

  if (!session) return <Login onConnecte={setSess} />;

  const admin = session.user.role === 'ADMIN';
  const onglets = [['controle', 'Contrôle'], ...(admin ? [['rapports', 'Rapports'], ['admin', 'Admin']] : [])];

  return (
    <div className="mx-auto max-w-2xl pb-12">
      <header className="sticky top-0 z-10 bg-vert-fonce px-4 pb-3 pt-4 text-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Contrôle du car</h1>
          <button className="text-sm underline" onClick={() => { setSession(null); setSess(null); }}>Quitter ({session.user.nom})</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>{enLigne ? 'En ligne' : 'Hors ligne'}</span>
          <span>{liste ? `${liste.total} étudiants en mémoire` : 'Liste non téléchargée'}</span>
          <span>{enAttente > 0 ? `${enAttente} à envoyer` : 'Tout est envoyé'}</span>
        </div>
        <div className="mt-2 flex gap-2">
          <button className="rounded-md bg-white/15 px-3 py-1 text-sm disabled:opacity-50" onClick={majListe} disabled={!enLigne}>Mettre à jour la liste</button>
          <button className="rounded-md bg-white/15 px-3 py-1 text-sm disabled:opacity-50" onClick={envoyer} disabled={!enLigne || enAttente === 0}>Envoyer maintenant</button>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-stone-200 bg-white px-2" aria-label="Sections">
        {onglets.map(([id, nom]) => (
          <button key={id} onClick={() => setOnglet(id)} aria-current={onglet === id ? 'page' : undefined}
            className={`px-4 py-3 text-lg ${onglet === id ? 'border-b-4 border-vert-fonce font-bold text-vert-fonce' : 'text-stone-600'}`}>
            {nom}
          </button>
        ))}
      </nav>

      {message && <p className="mx-4 mt-3 rounded-lg bg-stone-100 p-3 text-stone-700" role="status">{message}</p>}

      <main className="px-4 pt-4">
        {onglet === 'controle' && <Controle surChangement={rafraichirFile} />}
        {onglet === 'rapports' && admin && <Rapports />}
        {onglet === 'admin' && admin && <Admin />}
      </main>
    </div>
  );
}
