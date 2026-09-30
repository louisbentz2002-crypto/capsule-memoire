export const OFFERS = Object.freeze({
  photo: { label: 'Capsule Photo', price: 290, photos: 3 },
  souvenir: { label: 'Capsule Souvenir', price: 690, photos: 5 },
  heritage: { label: 'Capsule Héritage — sur devis', price: 990, photos: 10 }
});
export const REFERENCE_RE = /^CM-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function offerId(value = '') {
  if (typeof value !== 'string') return '';
  if (Object.hasOwn(OFFERS, value)) return value;
  if (value === 'Capsule Photo — 290€') return 'photo';
  if (value === 'Capsule Souvenir — 690€') return 'souvenir';
  if (value === 'Capsule Héritage — 990€' || value === OFFERS.heritage.label) return 'heritage';
  return '';
}
export function quote(offer, { voice = false, portrait = false, duo = false, plaque = false } = {}) {
  if (!Object.hasOwn(OFFERS, offer)) throw new Error('Offre inconnue');
  const options = [];
  if (offer === 'photo' && portrait) options.push(['Portrait avec message vocal', 290]);
  else if (offer === 'photo' && voice) options.push(['Évocation vocale', 140]);
  if (offer === 'heritage' && duo) options.push(['Pack Duo', 240]);
  if (offer === 'heritage' && plaque) options.push(['Plaque additionnelle', 79]);
  const extra = options.reduce((sum, [, price]) => sum + price, 0);
  return { base: OFFERS[offer].price, extra, total: OFFERS[offer].price + extra, options };
}
export function readStored(storage, key, maxAge, now = Date.now()) {
  try {
    const item = JSON.parse(storage.getItem(key));
    if (item?.version === 1 && Number.isFinite(item.at) && item.at <= now && now - item.at <= maxAge) return item.value;
    storage.removeItem(key);
  } catch { /* Mode privé ou stockage indisponible : le formulaire reste utilisable. */ }
  return null;
}
export function writeStored(storage, key, value, now = Date.now()) {
  try { storage.setItem(key, JSON.stringify({ version: 1, at: now, value })); return true; }
  catch { return false; }
}
export function reference(storage, cryptoApi = globalThis.crypto) {
  const saved = readStored(storage, 'cm-reference', 30 * 86400000);
  if (typeof saved === 'string' && REFERENCE_RE.test(saved)) return saved;
  const id = 'CM-' + cryptoApi.randomUUID();
  writeStored(storage, 'cm-reference', id);
  return id;
}
export async function postJson(url, payload, fetcher = globalThis.fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Envoi non confirmé');
    return result;
  } finally { clearTimeout(timer); }
}
export function hasVoice(data) {
  return offerId(data.offre) !== 'photo' || data.option_voix_photo === 'oui' || data.option_portrait_photo === 'oui';
}
export const ENUMS = Object.freeze({
  lien: ['Enfant', 'Conjoint / Conjointe', 'Parent', 'Frère / Sœur', 'Petit-enfant', 'Ami(e) proche', 'Autre'],
  statut_personne: ['vivante', 'decedee'],
  type_msg: ["Je l'écris moi-même", "Vous l'écrivez à partir de mes réponses", 'Une histoire de vie racontée'],
  ton: ['Apaisant', 'Joyeux', 'Solennel', 'Mélange'],
  ambiance: ['Douce et apaisante', 'Joyeuse et lumineuse', 'Sobre et recueillie'],
  a_voix: ['Oui', 'Non'],
  desc_voix: ['Grave', 'Douce', 'Énergique', 'Posée'],
  voix_texte_type: ["Je l'écris moi-même", "Vous l'écrivez pour moi"],
  qualite_enregistrement: ['Bonne — voix claire et audible', 'Correcte — quelques bruits de fond', 'Faible — bruyant ou lointain', 'Je ne sais pas encore'],
  nombre_photos: ['1 à 3 photos', '4 à 10 photos', 'Plus de 10 photos', 'Je ne sais pas encore']
});
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.getUTCFullYear() > 0 && date.toISOString().slice(0, 10) === value;
}
export function dossierErrors(data) {
  const required = ['offre', 'client_nom', 'client_email', 'lien', 'prenom', 'statut_personne', 'trois_mots',
    'passions', 'expressions', 'souvenir', 'type_msg', 'destinataire', 'ton', 'ambiance',
    'consent_proche', 'consent_fichiers', 'consent_ia', 'consent_usage', 'consent_qualite', 'consent_cgv'];
  const errors = required.filter(key => !data[key]?.trim());
  for (const key of required.filter(key => key.startsWith('consent_'))) if (data[key] !== 'oui') errors.push(key);
  if (!offerId(data.offre)) errors.push('offre');
  if ((data.client_email || '').length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.client_email || '')) errors.push('client_email');
  for (const [key, allowed] of Object.entries(ENUMS)) if (data[key] && !allowed.includes(data[key])) errors.push(key);
  for (const key of Object.keys(data).filter(key => key.startsWith('consent_') || key.startsWith('option_') || key === 'demarrage_anticipe')) {
    if (data[key] && data[key] !== 'oui') errors.push(key);
  }
  for (const key of ['naissance', 'deces', 'date_souhaitee']) if (data[key] && !validDate(data[key])) errors.push(key);
  if (!['vivante', 'decedee'].includes(data.statut_personne)) errors.push('statut_personne');
  if (data.statut_personne === 'vivante' && data.consent_vivant !== 'oui') errors.push('consent_vivant');
  if (data.naissance && data.deces && data.naissance > data.deces) errors.push('deces');
  if (data.type_msg?.includes('moi-même') && !data.message_libre?.trim()) errors.push('message_libre');
  if (hasVoice(data)) {
    if (!['Oui', 'Non'].includes(data.a_voix)) errors.push('a_voix');
    if (!data.voix_texte_type) errors.push('voix_texte_type');
    if (data.voix_texte_type?.includes('moi-même') && !data.voix_texte?.trim()) errors.push('voix_texte');
  }
  return [...new Set(errors)];
}
