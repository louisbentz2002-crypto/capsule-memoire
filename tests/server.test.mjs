import test from 'node:test';
import assert from 'node:assert/strict';
import { handle as dossier } from '../api/dossier.mjs';
import { handle as commande } from '../api/commande.mjs';
import { handle as guide } from '../api/guide.mjs';
import { verifyPayment } from '../lib/payment.mjs';
import { validDossier } from './fixtures.mjs';
const request = data => new Request('https://www.capsulememoire.fr/api/dossier', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://www.capsulememoire.fr' }, body: JSON.stringify(data) });
const session = 'cs_test_123456789abcdefghijk';
const paid = () => new Response(JSON.stringify({ id: session, livemode: false, customer_details: { email: 'client@example.com' }, status: 'complete', payment_status: 'paid', currency: 'eur', amount_total: 69000, client_reference_id: validDossier()._dossier_id }));
test('un dossier sans accord IA, CGV ou consentement vivant ne sort pas du serveur', async () => {
  for (const key of ['consent_ia', 'consent_cgv', 'consent_proche']) {
    const data = validDossier(); delete data[key];
    const res = await dossier(request(data), () => { throw new Error('ne doit pas appeler Formspree'); });
    assert.equal(res.status, 400);
  }
  const data = validDossier(); data.statut_personne = 'vivante';
  assert.equal((await dossier(request(data))).status, 400);
});
test('les montants et le statut de paiement sont recalculés côté serveur', async () => {
  let sent;
  const data = { ...validDossier(), _paiement: 'payé', _total_indicatif_eur: '1', option_duo: 'oui' };
  const res = await dossier(request(data), async (url, options) => { sent = JSON.parse(options.body); return new Response('{}'); }, '');
  assert.equal(res.status, 200); assert.equal(sent._total_indicatif_eur, '690');
  assert.match(sent._paiement, /MANUELLEMENT/); assert.equal(sent._options_eur, '0');
});
test('Formspree en échec ne valide pas le dossier', async () => {
  assert.equal((await dossier(request(validDossier()), async () => new Response('{}', { status: 500 }), '')).status, 502);
});
test('paiement absent ou en attente : pas de confirmation', async () => {
  assert.equal((await commande(new Request('https://www.capsulememoire.fr/api/commande'))).status, 400);
  assert.equal((await commande(new Request('https://www.capsulememoire.fr/api/commande?session_id=' + session), null, '')).status, 503);
  await assert.rejects(verifyPayment(session, async () => new Response('{"payment_status":"unpaid","status":"open"}'), 'test-secret'));
});
test('Stripe vérifie le montant et la référence, jamais le navigateur', async () => {
  const result = await verifyPayment(session, async (url, opts) => { assert.equal(opts.headers.Authorization, 'Bearer test-secret'); return paid(); }, 'test-secret');
  assert.equal(result.paid, true); assert.equal(result.offer, 'souvenir');
  const data = { ...validDossier(), _session_id: session, _dossier_id: result.reference }; let forwarded = false;
  const res = await dossier(request(data), async url => {
    if (url.startsWith('https://api.stripe.com/')) return paid(); forwarded = true; return new Response('{}');
  }, 'test-secret');
  assert.equal(res.status, 200); assert.equal(forwarded, true);
  data.offre = 'Capsule Photo — 290€';
  assert.equal((await dossier(request(data), async () => paid(), 'test-secret')).status, 409);
});
test('anti-abus : autres origines, JSON invalide et taille excessive sont refusés', async () => {
  const foreign = new Request('https://www.capsulememoire.fr/api/dossier', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: '{}' });
  assert.equal((await dossier(foreign)).status, 403);
  assert.equal((await dossier(request({ website: 'spam' }))).status, 400);
  assert.equal((await dossier(request({ content: 'x'.repeat(70000) }))).status, 413);
});
test('le guide exige une configuration et un vrai accusé de réception', async () => {
  const data = { prenom: 'Test', email: 'test@example.com', consentement: 'true' };
  const previous = process.env.GUIDE_WEBHOOK_URL;
  try {
    delete process.env.GUIDE_WEBHOOK_URL; assert.equal((await guide(request(data))).status, 503);
    process.env.GUIDE_WEBHOOK_URL = 'https://example.com/mock';
    assert.equal((await guide(request(data), async () => new Response('error', { status: 500 }))).status, 502);
    assert.equal((await guide(request(data), async () => new Response('Accepted'))).status, 200);
  } finally { if (previous === undefined) delete process.env.GUIDE_WEBHOOK_URL; else process.env.GUIDE_WEBHOOK_URL = previous; }
});
