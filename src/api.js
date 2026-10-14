const BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export const getSession = () => {
  try { return JSON.parse(localStorage.getItem('session')); } catch { return null; }
};
export const setSession = (s) =>
  s ? localStorage.setItem('session', JSON.stringify(s)) : localStorage.removeItem('session');

async function appel(chemin, { method = 'GET', body, form, blob } = {}) {
  const s = getSession();
  const headers = {};
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let rep;
  try {
    rep = await fetch(`${BASE}/api${chemin}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  } catch {
    const e = new Error('Pas de connexion au serveur');
    e.horsLigne = true;
    throw e;
  }
  if (rep.status === 401 && chemin !== '/auth/login') {
    setSession(null);
    window.location.reload();
  }
  if (!rep.ok) {
    const j = await rep.json().catch(() => ({}));
    throw new Error(j.error || `Erreur ${rep.status}`);
  }
  return blob ? rep.blob() : rep.json();
}

export const api = {
  login: (nom, motDePasse) => appel('/auth/login', { method: 'POST', body: { nom, motDePasse } }),
  snapshot: () => appel('/controles/snapshot'),
  verifier: (d) => appel('/controles/verifier', { method: 'POST', body: d }),
  sync: (controles) => appel('/controles/sync', { method: 'POST', body: { controles } }),
  importer: (fichier) => {
    const f = new FormData();
    f.append('fichier', fichier);
    return appel('/import', { method: 'POST', form: f });
  },
  utilisateurs: () => appel('/auth/utilisateurs'),
  creerUtilisateur: (d) => appel('/auth/utilisateurs', { method: 'POST', body: d }),
  controles: (q) => appel(`/rapports/controles?${new URLSearchParams(q)}`),
  cars: () => appel('/rapports/cars'),
  exporter: (q) => appel(`/rapports/export.xlsx?${new URLSearchParams(q)}`, { blob: true }),
};
