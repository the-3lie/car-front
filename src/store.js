// Stockage local (IndexedDB) : liste des étudiants + contrôles en attente d'envoi
import { get, set } from 'idb-keyval';
import { api } from './api.js';

let index = null; // index en mémoire pour des recherches instantanées

export async function chargerListe() {
  const snap = await get('snapshot');
  index = snap ? construire(snap) : null;
  return snap ? { date: snap.date, total: snap.etudiants.length } : null;
}

export async function telechargerListe() {
  const snap = await api.snapshot();
  await set('snapshot', snap);
  index = construire(snap);
  return { date: snap.date, total: snap.etudiants.length };
}

function construire(snap) {
  const parMatricule = new Map();
  const parCarte = new Map();
  const parRecu = new Map();
  for (const e of snap.etudiants) {
    parMatricule.set(e.matricule, e);
    e.cartes.forEach((c) => parCarte.set(c, e));
    e.recus.forEach((r) => parRecu.set(r, e));
  }
  const tous = snap.etudiants.map((e) => ({ e, cle: sansAccent(`${e.nom} ${e.prenom}`) }));
  return { parMatricule, parCarte, parRecu, tous };
}

export const listePrete = () => index !== null;

const norm = (s) => String(s ?? '').trim().toUpperCase();
const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
const infos = (e) => ({ matricule: e.matricule, nom: e.nom, prenom: e.prenom, filiere: e.filiere, car: e.car || null });

// Recherche par nom ou prénom (accents et majuscules ignorés, ordre des mots libre)
function parNom(texte) {
  const mots = sansAccent(texte).split(/\s+/).filter((m) => m.length >= 2);
  if (!mots.length) return [];
  return index.tous.filter((x) => mots.every((m) => x.cle.includes(m))).slice(0, 10).map((x) => x.e);
}

// Même logique que le serveur, mais sur la liste locale
// Compare le car de l'étudiant avec celui où se trouve le contrôleur ("Car 3" = "3" = "n° 3")
const cleCar = (s) => {
  const chiffres = String(s ?? '').match(/\d+/g);
  return chiffres ? chiffres.join('-') : String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
};
const memeCar = (a, b) => cleCar(a) !== '' && cleCar(a) === cleCar(b);

function conclure(etu, car) {
  const aCarte = etu.cartes.length > 0;
  const aRecu = etu.recus.length > 0;
  let base;
  if (aCarte && aRecu) base = { resultat: 'EN_REGLE', message: 'Accepté' };
  else if (aCarte) base = { resultat: 'RECU_MANQUANT', message: 'Reçu manquant, à vérifier' };
  else if (aRecu) base = { resultat: 'CARTE_MANQUANTE', message: 'Carte manquante, à vérifier' };
  else base = { resultat: 'RECU_MANQUANT', message: 'Ni carte ni reçu, à vérifier' };

  if (etu.car && String(car ?? '').trim() && !memeCar(etu.car, car)) {
    return { resultat: 'AUTRE_CAR', message: `Pas dans ce car : son car est le n° ${etu.car}`, etudiant: infos(etu), paiement: base.resultat };
  }
  return { ...base, etudiant: infos(etu), paiement: base.resultat };
}

// Le contenu d'un QR code peut être le matricule seul, "matricule=XXX" ou un lien contenant le matricule
export function extraireMatricule(texte) {
  let t = String(texte || '').trim();
  try {
    const u = new URL(t);
    t = u.searchParams.get('matricule') || u.searchParams.get('id') || u.pathname.split('/').filter(Boolean).pop() || t;
  } catch { /* pas un lien */ }
  const m = t.match(/matricule\s*[:=]\s*([A-Za-z0-9._\-/]+)/i);
  if (m) t = m[1];
  return t.trim();
}

export function verifierLocal({ identifiant, recu, car }) {
  const id = norm(identifiant);
  const r = norm(recu);
  let etu = index.parMatricule.get(id) || index.parCarte.get(id) || index.parRecu.get(id) || null;

  // Pas un matricule ni un numéro connu : on cherche par nom
  if (!etu && id) {
    const trouves = parNom(identifiant);
    if (trouves.length > 1) {
      return { resultat: 'PLUSIEURS', message: 'Plusieurs étudiants correspondent, choisis le bon', etudiant: null, candidats: trouves.map(infos) };
    }
    if (trouves.length === 1) etu = trouves[0];
  }

  if (r) {
    const proprio = index.parRecu.get(r);
    if (proprio && etu && proprio.matricule !== etu.matricule) {
      return { resultat: 'DOUBLON', message: 'Ce reçu appartient à un autre étudiant', etudiant: infos(etu) };
    }
    if (proprio && !etu) etu = proprio;
  }
  if (!etu) return { resultat: 'NON_INSCRIT', message: "Il n'existe pas dans la liste", etudiant: null };

  return conclure(etu, car);
}

// File d'attente des contrôles à envoyer
export const fileAttente = async () => (await get('queue')) || [];

export async function ajouterControle(c) {
  const q = await fileAttente();
  q.push({ uuid: crypto.randomUUID(), date: new Date().toISOString(), ...c });
  await set('queue', q);
  return q.length;
}

let synchroEnCours = false;
export async function synchroniser() {
  if (synchroEnCours) return 0;
  const q = await fileAttente();
  if (!q.length) return 0;
  synchroEnCours = true;
  try {
    await api.sync(q);
    // On retire seulement ce qui vient d'être envoyé (d'autres contrôles ont pu être ajoutés entre-temps)
    const envoyes = new Set(q.map((c) => c.uuid));
    const reste = (await fileAttente()).filter((c) => !envoyes.has(c.uuid));
    await set('queue', reste);
    return q.length;
  } finally {
    synchroEnCours = false;
  }
}
