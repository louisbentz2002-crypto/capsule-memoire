import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, readStored, writeStored, reference, dossierErrors, postJson } from '../assets/js/core.mjs';
import { validDossier } from './fixtures.mjs';

const storage = () => {
  const values = new Map(); return { getItem: key => values.get(key) || null, setItem: (key, val) => values.set(key, val), removeItem: key => values.delete(key) };
};
test('le portrait vocal ne facture pas une deuxième fois la voix', () => {
  assert.equal(quote('photo', { voice: true }).total, 430);
  assert.equal(quote('photo', { voice: true, portrait: true }).total, 580);
  assert.equal(quote('heritage', { duo: true, plaque: true }).total, 1309);
  assert.equal(quote('souvenir', { voice: true, duo: true }).total, 690);
});
test('brouillons expirés, corrompus ou stockage interdit', () => {
  const s = storage(); writeStored(s, 'draft', { text: 'privé' }, 1000);
  assert.deepEqual(readStored(s, 'draft', 100, 1050), { text: 'privé' });
  assert.equal(readStored(s, 'draft', 100, 1101), null); assert.equal(s.getItem('draft'), null);
  s.setItem('draft', 'not json'); assert.equal(readStored(s, 'draft', 100), null);
  assert.equal(writeStored(null, 'draft', {}), false);
});
test('une référence stable persiste entre paiement et questionnaire', () => {
  const s = storage(); const id = reference(s); assert.equal(reference(s), id);
  assert.match(id, /^CM-[\da-f-]{36}$/);
});
test('les personnes vivantes et les textes rédigés exigent leurs champs', () => {
  const d = validDossier(); assert.deepEqual(dossierErrors(d), []);
  d.statut_personne = 'vivante'; assert.ok(dossierErrors(d).includes('consent_vivant'));
  d.consent_vivant = 'oui'; d.voix_texte_type = 'Je l’écris moi-même'; assert.ok(dossierErrors(d).includes('voix_texte'));
  d.voix_texte = 'Texte validé'; assert.deepEqual(dossierErrors(d), []);
  d.consent_ia = 'non'; assert.ok(dossierErrors(d).includes('consent_ia'));
});
test('un HTTP 500 ou une panne réseau ne deviennent pas un succès', async () => {
  await assert.rejects(postJson('/api', {}, async () => new Response('{}', { status: 500 })));
  await assert.rejects(postJson('/api', {}, async () => { throw new Error('offline'); }));
  assert.deepEqual(await postJson('/api', {}, async () => new Response('{"accepted":true}')), { accepted: true });
});
