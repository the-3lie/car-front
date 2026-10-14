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
  return { parMatricule, parCarte, parRecu };
}

export const listePrete = () => index !== null;

const norm = (s) => String(s ?? '').trim().toUpperCase();
const infos = (e) => ({ matricule: e.matricule, nom: e.nom, prenom: e.prenom, filiere: e.filiere });

// Même logique que le serveur, mais sur la liste locale
export function verifierLocal({ identifiant, recu }) {
  const id = norm(identifiant);
  const r = norm(recu);
  let etu = index.parMatricule.get(id) || index.parCarte.get(id) || index.parRecu.get(id) || null;

  if (r) {
    const proprio = index.parRecu.get(r);
    if (proprio && etu && proprio.matricule !== etu.matricule) {
      return { resultat: 'DOUBLON', message: 'Ce reçu appartient à un autre étudiant', etudiant: infos(etu) };
    }
    if (proprio && !etu) etu = proprio;
  }
  if (!etu) return { resultat: 'NON_INSCRIT', message: 'Non inscrit : à signaler', etudiant: null };

  const aCarte = etu.cartes.length > 0;
  const aRecu = etu.recus.length > 0;
  if (aCarte && aRecu) return { resultat: 'EN_REGLE', message: 'En règle', etudiant: infos(etu) };
  if (aCarte) return { resultat: 'RECU_MANQUANT', message: 'Reçu manquant, à vérifier', etudiant: infos(etu) };
  if (aRecu) return { resultat: 'CARTE_MANQUANTE', message: 'Carte manquante, à vérifier', etudiant: infos(etu) };
  return { resultat: 'RECU_MANQUANT', message: 'Ni carte ni reçu, à vérifier', etudiant: infos(etu) };
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
