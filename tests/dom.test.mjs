import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const root = new URL('../', import.meta.url);
let sequence = 0;
async function questionnaire(seed = null, fetcher = async () => new Response('{"accepted":true}')) {
  const dom = new JSDOM(readFileSync(new URL('questionnaire.html', root), 'utf8'), { url: 'https://www.capsulememoire.fr/questionnaire.html', runScripts: 'outside-only' });
  const w = dom.window; w.scrollTo = () => {}; w.matchMedia = () => ({ matches: false }); w.HTMLElement.prototype.scrollIntoView = () => {};
  if (seed) w.localStorage.setItem('cm-draft', JSON.stringify(seed));
  Object.assign(globalThis, { window: w, document: w.document, FormData: w.FormData, fetch: fetcher });
  await import('../assets/js/questionnaire.mjs?test=' + ++sequence);
  return { dom, w, d: w.document, form: w.document.getElementById('form') };
}
function choose(w, name, value) {
  const field = [...w.document.querySelectorAll(`[name="${name}"]`)].find(el => el.value === value);
  field.checked = true; field.dispatchEvent(new w.Event('change', { bubbles: true }));
}
function complete(w) {
  choose(w, 'offre', 'Capsule Souvenir — 690€');
  w.document.querySelector('[name="statut_personne"]').value = 'decedee';
  for (const el of w.document.querySelectorAll('[required]')) {
    if (el.disabled || el.type === 'radio') continue;
    if (el.type === 'checkbox') el.checked = true;
    else if (el.tagName === 'SELECT') el.selectedIndex = 1;
    else el.value = el.type === 'email' ? 'client@example.com' : 'Test';
  }
  w.document.querySelector('[name="statut_personne"]').value = 'decedee';
  w.document.querySelector('[name="statut_personne"]').dispatchEvent(new w.Event('change', { bubbles: true }));
  choose(w, 'type_msg', 'Je l\'écris moi-même'); w.document.querySelector('[name="message_libre"]').value = 'Message de test';
  choose(w, 'ton', 'Apaisant'); choose(w, 'a_voix', 'Oui'); choose(w, 'ambiance', 'Douce et apaisante');
  choose(w, 'voix_texte_type', 'Je l\'écris moi-même'); w.document.querySelector('[name="voix_texte"]').value = 'Texte vocal réellement transmis';
  w.document.querySelector('[name="statut_personne"]').value = 'decedee';
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test('Photo ignore les questions vocales ; options exclusives et clavier natif', async () => {
  const { w, d, dom } = await questionnaire();
  choose(w, 'offre', 'Capsule Photo — 290€');
  assert.equal(d.querySelector('[name="a_voix"]').disabled, true);
  d.querySelector('[name="option_voix_photo"]').click();
  assert.equal(d.querySelector('[name="a_voix"]').disabled, false); assert.match(d.getElementById('orderSummary').textContent, /430/);
  d.querySelector('[name="option_portrait_photo"]').click();
  assert.equal(d.querySelector('[name="option_voix_photo"]').checked, false); assert.match(d.getElementById('orderSummary').textContent, /580/);
  assert.equal(d.querySelector('[name="voix_texte"]').closest('form').id, 'form');
  dom.window.close();
});
test('le brouillon reprend les réponses mais pas les consentements', async () => {
  const id = 'CM-12345678-1234-1234-1234-123456789abc';
  const seed = { version: 1, at: Date.now(), value: { reference: id, page: 3, persistent: true,
    values: { client_nom: 'Brouillon test', 'offre:Capsule Souvenir — 690€': true, 'consent_ia:oui': true, 'demarrage_anticipe:oui': true } } };
  const { d, dom } = await questionnaire(seed);
  assert.equal(d.querySelector('[name="client_nom"]').value, 'Brouillon test');
  assert.equal(d.querySelector('[name="consent_ia"]').checked, false);
  assert.equal(d.querySelector('[name="demarrage_anticipe"]').checked, false);
  assert.equal(d.querySelector('.page.active').id, 'p3'); dom.window.close();
});
test('toutes les étapes sont validées avant envoi et le texte vocal est collecté', async () => {
  let body, calls = 0;
  const { w, d, form, dom } = await questionnaire(null, async (url, options) => {
    calls++; body = JSON.parse(options.body); return new Response(JSON.stringify({ accepted: true, reference: body._dossier_id }));
  });
  w.go(7); form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
  assert.equal(calls, 0); assert.equal(d.querySelector('.page.active').id, 'p1');
  complete(w); form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
  assert.equal(calls, 1); assert.equal(body.voix_texte, 'Texte vocal réellement transmis');
  assert.equal(d.querySelector('.page.active').id, 'p8');
  assert.equal(w.localStorage.getItem('cm-draft'), null); assert.equal(w.sessionStorage.getItem('cm-draft'), null);
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); assert.equal(calls, 1);
  dom.window.close();
});
test('une panne garde les réponses et permet de réessayer avec la même référence', async () => {
  let body; const { w, d, form, dom } = await questionnaire(null, async (url, options) => { body = JSON.parse(options.body); return new Response('{}', { status: 500 }); });
  complete(w); w.go(7); form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
  assert.equal(d.querySelector('.page.active').id, 'p7'); assert.equal(d.getElementById('submitBtn').disabled, false);
  assert.match(d.getElementById('formError').textContent, new RegExp(body._dossier_id));
  assert.equal(d.querySelector('[name="voix_texte"]').value, 'Texte vocal réellement transmis'); dom.window.close();
});
test('le guide attend l’accusé de réception ; HTTP 500 ne cache pas le formulaire', async () => {
  for (const accepted of [false, true]) {
    const dom = new JSDOM(readFileSync(new URL('guide-souvenirs.html', root), 'utf8'), { url: 'https://www.capsulememoire.fr', runScripts: 'outside-only' });
    const w = dom.window; w.AbortSignal = AbortSignal; w.fetch = async () => new Response('{"accepted":true}', { status: accepted ? 200 : 500 });
    w.eval(readFileSync(new URL('assets/js/guide.js', root), 'utf8'));
    w.document.getElementById('f-prenom').value = 'Test'; w.document.getElementById('f-email').value = 'test@example.com'; w.document.getElementById('f-consent').checked = true;
    const form = w.document.getElementById('guideForm'); form.dispatchEvent(new w.Event('submit', { cancelable: true }));
    assert.equal(w.document.getElementById('formSuccess').classList.contains('show'), false);
    await tick(); assert.equal(w.document.getElementById('formSuccess').classList.contains('show'), accepted);
    if (!accepted) assert.notEqual(form.style.display, 'none');
    dom.window.close();
  }
});
test('le contact refuse un email invalide avant tout appel réseau', async () => {
  const dom = new JSDOM(readFileSync(new URL('index.html', root), 'utf8'), { url: 'https://www.capsulememoire.fr', runScripts: 'outside-only' });
  const w = dom.window; let calls = 0;
  w.matchMedia = () => ({ matches: false }); w.HTMLMediaElement.prototype.load = () => {};
  w.HTMLMediaElement.prototype.play = async () => {}; w.HTMLMediaElement.prototype.pause = () => {};
  w.AbortSignal = AbortSignal; w.fetch = async () => { calls++; return new Response('{"accepted":true}'); };
  w.eval(readFileSync(new URL('assets/js/site.js', root), 'utf8'));
  const form = w.document.getElementById('contactForm');
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); assert.equal(calls, 0);
  for (const el of form.querySelectorAll('[required]')) el.value = el.type === 'email' ? 'invalid' : 'Test';
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); assert.equal(calls, 0);
  w.document.getElementById('cf-email').value = 'test@example.com';
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick(); assert.equal(calls, 1);
  assert.equal(w.document.getElementById('cfSuccess').style.display, 'block'); dom.window.close();
});
test('un seul jeu de barres audio et aucune icône inexistante en fin de lecture', async () => {
  const dom = new JSDOM(readFileSync(new URL('index.html', root), 'utf8'), { url: 'https://www.capsulememoire.fr', runScripts: 'outside-only' });
  const w = dom.window;
  w.HTMLMediaElement.prototype.play = async () => { throw new Error('Lecture bloquée'); };
  w.HTMLMediaElement.prototype.pause = () => {};
  w.eval(readFileSync(new URL('assets/js/media.js', root), 'utf8'));
  assert.equal(w.document.getElementById('vbars-orig').children.length, 36);
  assert.equal(w.document.getElementById('vbars-clone').children.length, 36);
  w.document.getElementById('vaudio-orig').dispatchEvent(new w.Event('ended'));
  assert.equal(w.document.querySelector('#vc-orig .cm-play-btn').getAttribute('aria-pressed'), 'false');
  await w.voiceToggle('orig'); assert.match(w.document.getElementById('mediaStatus').textContent, /indisponible/);
  dom.window.close();
});
test('la confirmation distingue accès direct, paiement vérifié et réponse invalide', async () => {
  const id = 'CM-12345678-1234-1234-1234-123456789abc';
  for (const mode of ['direct', 'paid', 'invalid']) {
    const dom = new JSDOM(readFileSync(new URL('confirmation.html', root), 'utf8'), {
      url: 'https://www.capsulememoire.fr/confirmation.html' + (mode === 'direct' ? '' : '?session_id=cs_test_123456789abcd'), runScripts: 'outside-only'
    });
    const w = dom.window;
    Object.assign(globalThis, { document: w.document, location: w.location, history: w.history, sessionStorage: w.sessionStorage, localStorage: w.localStorage,
      fetch: async () => new Response(JSON.stringify(mode === 'paid' ? { paid: true, reference: id, offer: 'souvenir' } : {})) });
    await import('../assets/js/confirmation.mjs?test=' + ++sequence);
    const status = w.document.getElementById('paymentStatus').textContent;
    if (mode === 'paid') { assert.match(status, /confirmé/); assert.equal(JSON.parse(w.sessionStorage.getItem('cm-payment')).value.reference, id); }
    else assert.doesNotMatch(status, /Paiement de la formule confirmé/);
    assert.equal(w.location.search, ''); dom.window.close();
  }
});
test('les boutons d’étape et les instructions de transfert fonctionnent sans JavaScript inline', async () => {
  const { w, d, dom } = await questionnaire();
  d.querySelector('[data-go="1"]').click(); assert.equal(d.querySelector('.page.active').id, 'p1');
  complete(w); d.querySelector('[data-next="1"]').click(); assert.equal(d.querySelector('.page.active').id, 'p2');
  const toggle = d.querySelector('[data-transfer-toggle]');
  toggle.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
  assert.equal(toggle.getAttribute('aria-expanded'), 'true'); assert.equal(toggle.nextElementSibling.style.display, 'block');
  dom.window.close();
});
test('un double envoi pendant la requête ne transmet qu’un dossier', async () => {
  let resolve, body, calls = 0;
  const { w, form, dom } = await questionnaire(null, async (url, options) => {
    calls++; body = JSON.parse(options.body); return new Promise(done => { resolve = done; });
  });
  complete(w); form.dispatchEvent(new w.Event('submit', { cancelable: true })); form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal(calls, 1); resolve(new Response(JSON.stringify({ accepted: true, reference: body._dossier_id })));
  await tick(); dom.window.close();
});
