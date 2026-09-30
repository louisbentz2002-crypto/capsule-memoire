import test from 'node:test';
import assert from 'node:assert/strict';
import { offerId, quote, dossierErrors, validDate } from '../assets/js/core.mjs';
import { payload, forward } from '../lib/http.mjs';
import { verifyPayment } from '../lib/payment.mjs';
import { handle as dossier } from '../api/dossier.mjs';
import { handle as commande } from '../api/commande.mjs';
import { handle as contact } from '../api/contact.mjs';
import { validDossier } from './fixtures.mjs';
const session = 'cs_test_123456789abcdefghijk';
const paid = (overrides = {}) => new Response(JSON.stringify({ id: session, livemode: false, status: 'complete', payment_status: 'paid', currency: 'eur', amount_total: 69000, client_reference_id: validDossier()._dossier_id, customer_details: { email: 'client@example.com' }, ...overrides }));
const request = (data, headers = {}) => new Request('https://www.capsulememoire.fr/api/dossier', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data) });

test('les noms de prototype et les libellés inventés ne deviennent pas des offres', () => {
  for (const value of ['__proto__', 'constructor', 'toString', 'Fausse Capsule Photo', null, {}]) {
    assert.equal(offerId(value), ''); assert.throws(() => quote(value));
  }
});
test('les dates impossibles et les choix inconnus ne contournent pas les champs requis', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-02-31', '0000-01-01', 'hier']) assert.equal(validDate(date), false);
  const data = validDossier(); data.type_msg = 'inconnu'; data.voix_texte_type = 'inconnu'; data.deces = '2026-02-31';
  assert.deepEqual(dossierErrors(data).sort(), ['deces', 'type_msg', 'voix_texte_type']);
});
test('une réponse non textuelle ou trop longue est refusée sans troncature ni transfert', async () => {
  for (const value of [null, {}, ['test'], 'x'.repeat(12001), 'bonjour\u0000']) {
    let called = false;
    const res = await dossier(request({ ...validDossier(), souvenir: value }), async () => { called = true; });
    assert.equal(res.status, 400); assert.equal(called, false);
  }
});
test('le lecteur JSON arrête et annule un flux au-delà de 64 Kio', async () => {
  let cancelled = false;
  const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(40000)); }, cancel() { cancelled = true; } });
  const req = new Request('https://www.capsulememoire.fr/api/dossier', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, duplex: 'half' });
  await assert.rejects(payload(req), error => error.status === 413); assert.equal(cancelled, true);
});
test('les requêtes cross-site et les faux types JSON sont refusés', async () => {
  await assert.rejects(payload(request({}, { 'Sec-Fetch-Site': 'cross-site' })), error => error.status === 403);
  await assert.rejects(payload(request({}, { 'Content-Type': 'text/plain; application/json' })), error => error.status === 415);
});
test('les transferts de souvenirs ne suivent pas de redirection et exigent HTTPS', async () => {
  await forward('https://example.com/mock', {}, async (url, options) => { assert.equal(options.redirect, 'error'); return new Response('{}'); });
  await assert.rejects(forward('http://example.com', {}, () => { throw new Error('appel interdit'); }), error => error.status === 503);
});
test('un paiement garde une référence stable et deux paiements ont deux références', async () => {
  const a = await verifyPayment(session, async () => paid(), 'test-secret');
  const b = await verifyPayment(session, async () => paid({ client_reference_id: 'CM-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }), 'test-secret');
  assert.equal(a.reference, b.reference); assert.notEqual(a.reference, a.checkoutReference);
  const other = session + '2';
  const c = await verifyPayment(other, async () => paid({ id: other }), 'test-secret');
  assert.notEqual(c.reference, a.reference);
});
test('la vérification refuse la mauvaise session, les montants invalides et les tests en production', async () => {
  for (const override of [{ id: session + '2' }, { amount_total: -1 }, { amount_total: '69000' }, { currency: 'usd' }]) await assert.rejects(verifyPayment(session, async () => paid(override), 'test-secret'), error => error.status === 409);
  const previous = process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV = 'production';
    await assert.rejects(verifyPayment(session, async () => paid(), 'test-secret'), error => error.status === 409);
    const live = session.replace('cs_test_', 'cs_live_');
    assert.equal((await verifyPayment(live, async () => paid({ id: live, livemode: true }), 'test-secret')).paid, true);
  } finally { if (previous === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = previous; }
});
test('l’API publique de confirmation ne révèle jamais l’email du payeur', async () => {
  const res = await commande(new Request('https://www.capsulememoire.fr/api/commande?session_id=' + session), async () => paid(), 'test-secret');
  const text = await res.text(); assert.equal(res.status, 200); assert.doesNotMatch(text, /client@example|buyerEmail|customer_details/);
});
test('un dossier ne consomme pas le paiement d’un autre email', async () => {
  const payment = await verifyPayment(session, async () => paid(), 'test-secret');
  let forwarded = false;
  const res = await dossier(request({ ...validDossier(), _dossier_id: payment.reference, _session_id: session, client_email: 'other@example.com' }), async url => {
    if (url.startsWith('https://api.stripe.com/')) return paid(); forwarded = true; return new Response('{}');
  }, 'test-secret');
  assert.equal(res.status, 409); assert.equal(forwarded, false);
});
test('le serveur supprime les anciens champs vocaux, de livre et de message devenus inutiles', async () => {
  let sent;
  const data = { ...validDossier(), offre: 'Capsule Photo — 290€', voix_texte: 'ancien texte', histoire: 'ancienne histoire', message_libre: 'ancien message', option_duo: 'oui' };
  const res = await dossier(request(data), async (url, options) => { sent = JSON.parse(options.body); return new Response('{}'); }, '');
  assert.equal(res.status, 200);
  for (const key of ['a_voix', 'voix_texte', 'histoire', 'message_libre', 'option_duo']) assert.equal(Object.hasOwn(sent, key), false);
});
test('un identifiant de session présent sans clé serveur reste un échec explicite', async () => {
  assert.equal((await dossier(request({ ...validDossier(), _session_id: session }), async () => { throw new Error('appel interdit'); }, '')).status, 503);
});
test('le contact filtre le spam, les valeurs invalides et les statuts falsifiés', async () => {
  const data = { prenom: 'Test', nom: 'Client', email: 'test@example.com', message: 'Bonjour' };
  for (const override of [{ website: 'spam' }, { email: 'invalid' }, { message: 'x'.repeat(6001) }]) assert.equal((await contact(request({ ...data, ...override }))).status, 400);
  let sent;
  const res = await contact(request({ ...data, _type: 'payé', _paiement: 'validé' }), async (url, options) => { sent = JSON.parse(options.body); return new Response('{}'); });
  assert.equal(res.status, 200); assert.equal(sent._type, 'contact'); assert.equal(sent._paiement, undefined);
  assert.equal((await contact(request(data), async () => new Response('{}', { status: 500 }))).status, 502);
});
