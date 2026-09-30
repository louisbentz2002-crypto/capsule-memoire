import { OFFERS, offerId, quote, reference, readStored, writeStored, postJson, REFERENCE_RE } from './core.mjs';
const form = document.getElementById('form');
const local = (() => { try { return window.localStorage; } catch { return null; } })();
const session = (() => { try { return window.sessionStorage; } catch { return null; } })();
let DOSSIER_ID = reference(local);
let cur = 0, isOffre2 = false, submitted = false, sessionId = '';
const DRAFT_KEY = 'cm-draft';
const persistent = document.getElementById('saveDraft');
const status = document.getElementById('draftStatus');
function data() {
  const result = {};
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== 'string') continue;
    result[name] = result[name] ? result[name] + ', ' + value.trim() : value.trim();
  }
  return result;
}
function snapshot() {
  const values = {};
  for (const el of form.elements) {
    if (!el.name || (el.name.startsWith('consent_') || el.name === 'demarrage_anticipe')) continue;
    if (el.type === 'radio' || el.type === 'checkbox') values[el.name + ':' + el.value] = el.checked;
    else values[el.name] = el.value;
  }
  return { values, reference: DOSSIER_ID, page: cur, persistent: persistent.checked };
}
function save() {
  if (submitted) return;
  const draft = snapshot();
  const ok = writeStored(session, DRAFT_KEY, draft);
  if (persistent.checked) {
    const saved = writeStored(local, DRAFT_KEY, draft);
    status.textContent = saved ? 'Brouillon sauvegardé sur cet appareil pour 7 jours. Les consentements seront à confirmer.' : 'La sauvegarde sur cet appareil est indisponible. Gardez cet onglet ouvert.';
  } else {
    try { local?.removeItem(DRAFT_KEY); } catch { /* stockage bloqué */ }
    status.textContent = ok ? 'Brouillon sauvegardé dans cet onglet. Pour le retrouver après fermeture, activez la sauvegarde sur cet appareil.' : 'Stockage indisponible. Gardez cet onglet ouvert jusqu’à l’envoi.';
  }
}
function removeDraft() { for (const storage of [local, session]) try { storage?.removeItem(DRAFT_KEY); } catch { /* stockage bloqué */ } }
function syncLabels() {
  form.querySelectorAll('.r-item, .c-item').forEach(label => label.classList.toggle('sel', !!label.querySelector('input')?.checked));
}
function conditional(id, active) {
  const block = document.getElementById(id);
  if (!block) return;
  block.classList.toggle('on', active);
  block.querySelectorAll('input, textarea, select').forEach(el => {
    el.disabled = !active;
    if (el.dataset.required === 'true') el.required = active;
  });
}
function onMsg() {
  conditional('msgLibre', !!form.querySelector('[name="type_msg"]:checked')?.value.includes('moi-même'));
}
function onVoixTexte() {
  const active = document.getElementById('voiceFields').classList.contains('on');
  conditional('voixTexteLibre', active && !!form.querySelector('[name="voix_texte_type"]:checked')?.value.includes('moi-même'));
}
function onVoix() {
  const active = document.getElementById('voiceFields').classList.contains('on');
  const selected = form.querySelector('[name="a_voix"]:checked')?.value;
  conditional('voixOui', active && selected === 'Oui');
  conditional('voixNon', active && selected === 'Non');
}
function onOffre() {
  const offer = offerId(form.querySelector('[name="offre"]:checked')?.value);
  isOffre2 = offer === 'heritage';
  conditional('optionVocaleBlock', offer === 'photo');
  conditional('heritageOptions', isOffre2);
  document.getElementById('p6').querySelectorAll('input, select, textarea').forEach(el => el.disabled = !isOffre2);
  const voice = form.querySelector('[name="option_voix_photo"]');
  const portrait = form.querySelector('[name="option_portrait_photo"]');
  if (portrait.checked) voice.checked = false;
  const voiceActive = !!offer && (offer !== 'photo' || voice.checked || portrait.checked);
  conditional('voiceFields', voiceActive);
  document.getElementById('maxPhotos').textContent = (OFFERS[offer]?.photos || 3) + ' photos';
  const total = offer ? quote(offer, { voice: voice.checked, portrait: portrait.checked,
    duo: form.querySelector('[name="option_duo"]').checked, plaque: form.querySelector('[name="option_plaque"]').checked }) : null;
  document.getElementById('orderSummary').textContent = total ?
    `${OFFERS[offer].label} : ${total.base} € + options ${total.extra} € = ${total.total} € indicatifs. ${isOffre2 ? 'Disponibilité, prix final et délai à confirmer par devis.' : 'Les options seront confirmées et facturées séparément avant production.'}` : 'Choisissez votre formule. Ce questionnaire ne déclenche aucun paiement.';
  onVoix(); onVoixTexte(); syncLabels(); updateUI();
}
function onPerson() {
  const living = form.querySelector('[name="statut_personne"]')?.value === 'vivante';
  conditional('livingConsent', living);
  const death = document.getElementById('f-deces');
  death.disabled = living;
  if (living) death.value = '';
}
function updateUI() {
  const steps = isOffre2 ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 7];
  const percent = cur === 8 ? 100 : cur === 0 ? 0 : Math.round((steps.indexOf(cur) + 1) / steps.length * 100);
  document.getElementById('pBar').style.width = percent + '%';
  document.querySelector('[role="progressbar"]').setAttribute('aria-valuenow', percent);
  const labels = ['Questionnaire', 'Commande', 'Votre proche', 'Son histoire', 'Message & voix', 'Photos', 'Livre de vie', 'Pour finir', 'Dossier reçu'];
  document.getElementById('hStep').textContent = labels[cur];
  const dots = document.getElementById('hDots'); dots.replaceChildren();
  if (cur > 0 && cur < 8) steps.forEach(n => {
    const dot = document.createElement('div'); dot.className = 'dot' + (n < cur ? ' done' : n === cur ? ' active' : ''); dots.append(dot);
  });
}
function go(n) {
  if (!isOffre2 && n === 6) n = 7;
  document.querySelector('.page.active')?.classList.remove('active');
  document.getElementById('p' + n).classList.add('active'); cur = n; updateUI();
  window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  const title = document.querySelector('.page.active h1, .page.active h2');
  if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
  if (n === 8) ['confirmDossierId', 'wtDossierId', 'wtDossierIdDrive', 'wtDossierIdMail'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = DOSSIER_ID;
  });
  else save();
}
function validate(n) {
  const page = document.getElementById('p' + n);
  let first = null;
  page.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.disabled || !el.required) return;
    const blank = !['radio', 'checkbox'].includes(el.type) && !el.value.trim();
    const invalid = blank || !el.checkValidity();
    el.classList.toggle('field-error', invalid);
    el.setAttribute('aria-invalid', String(invalid));
    el.closest('.r-item, .c-item')?.classList.toggle('field-error-group', invalid);
    if (invalid && !first) first = el;
  });
  const birth = document.getElementById('f-naiss'), death = document.getElementById('f-deces');
  const datesWrong = n === 2 && !death.disabled && birth.value && death.value && birth.value > death.value;
  document.getElementById('date-error')?.classList.toggle('show', !!datesWrong);
  if (datesWrong && !first) first = death;
  document.getElementById('formError').textContent = first ? 'Merci de compléter les champs obligatoires et de vérifier les dates.' : '';
  if (first) { if (cur !== n) go(n); first.focus(); first.scrollIntoView({ block: 'center' }); }
  return !first;
}
Object.assign(window, { go, next: n => { if (validate(n)) go(n === 5 ? (isOffre2 ? 6 : 7) : n + 1); },
  goBack7: () => go(isOffre2 ? 6 : 5), onOffre, onVoix, onMsg, onVoixTexte });
form.addEventListener('change', event => {
  if (event.target.name === 'option_voix_photo' && event.target.checked) form.querySelector('[name="option_portrait_photo"]').checked = false;
  onOffre(); onMsg(); onPerson(); syncLabels(); save();
});
form.addEventListener('input', () => save());
persistent.addEventListener('change', save);
document.getElementById('restartDraft').addEventListener('click', () => {
  removeDraft(); form.reset(); persistent.checked = false; submitted = false;
  try { local?.removeItem('cm-reference'); session?.removeItem('cm-payment'); session?.removeItem('cm-receipt'); } catch { /* stockage bloqué */ }
  sessionId = ''; DOSSIER_ID = reference(local); onOffre(); onMsg(); onPerson(); go(0);
});
const saved = readStored(session, DRAFT_KEY, 7 * 86400000) || readStored(local, DRAFT_KEY, 7 * 86400000);
if (saved?.values && REFERENCE_RE.test(saved.reference || '')) {
  DOSSIER_ID = saved.reference; persistent.checked = !!saved.persistent;
  for (const el of form.elements) {
    if (!el.name || (el.name.startsWith('consent_') || el.name === 'demarrage_anticipe')) continue;
    const key = ['radio', 'checkbox'].includes(el.type) ? el.name + ':' + el.value : el.name;
    if (typeof saved.values[key] === 'boolean') el.checked = saved.values[key];
    else if (typeof saved.values[key] === 'string') el.value = saved.values[key];
  }
}
const payment = readStored(session, 'cm-payment', 86400000);
if (payment?.reference === DOSSIER_ID) {
  sessionId = payment.sessionId || '';
  if (payment.offer && !form.querySelector('[name="offre"]:checked')) {
    const selected = [...form.querySelectorAll('[name="offre"]')].find(el => offerId(el.value) === payment.offer);
    if (selected) selected.checked = true;
  }
}
onOffre(); onMsg(); onPerson(); syncLabels();
const receipt = readStored(session, 'cm-receipt', 86400000);
if (receipt?.reference === DOSSIER_ID) { submitted = true; go(8); }
else go(saved && Number.isInteger(saved.page) && saved.page >= 0 && saved.page <= 7 ? saved.page : 0);
form.addEventListener('submit', async event => {
  event.preventDefault(); if (submitted) return;
  for (const step of [1, 2, 3, 4, 5, ...(isOffre2 ? [6] : []), 7]) if (!validate(step)) return;
  const button = document.getElementById('submitBtn'); button.disabled = true; button.textContent = 'Envoi en cours…';
  document.getElementById('formError').textContent = '';
  try {
    const response = await postJson('/api/dossier', { ...data(), _dossier_id: DOSSIER_ID, _session_id: sessionId });
    if (!response.accepted || response.reference !== DOSSIER_ID) throw new Error('Réception non confirmée');
    submitted = true; removeDraft(); writeStored(session, 'cm-receipt', { reference: DOSSIER_ID }); writeStored(local, 'cm-complete', { reference: DOSSIER_ID }); go(8);
  } catch {
    document.getElementById('formError').textContent = 'Réception non confirmée. Vos réponses restent dans ce formulaire. Réessayez avec la même référence : ' + DOSSIER_ID + ', ou écrivez à contact.capsulememoire@gmail.com. En cas de délai réseau, une première copie a pu parvenir : nous regrouperons les envois portant cette référence.';
    button.disabled = false; button.textContent = 'Réessayer l’envoi →';
  }
});
