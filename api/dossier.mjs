import { dossierErrors, offerId, quote, REFERENCE_RE } from '../assets/js/core.mjs';
import { payload, json, forward, failure } from '../lib/http.mjs';
import { verifyPayment } from '../lib/payment.mjs';
const FIELDS = new Set(('offre client_nom client_email lien prenom statut_personne consent_vivant naissance deces trois_mots caractere caractere_autre profession passions expressions souvenir type_msg message_libre destinataire ton a_voix type_enregistrement qualite_enregistrement desc_voix accent voix_texte_type voix_texte photos_description nombre_photos photo_principale ambiance musique legendes_photos description histoire moments personnes_importantes lieux_importants valeurs rituels heritage anecdote_drole_tendre sujets_a_eviter docs_description dedicace date_souhaitee remarques consent_proche consent_fichiers consent_ia consent_usage consent_qualite consent_cgv demarrage_anticipe option_voix_photo option_portrait_photo option_duo option_plaque').split(' '));
export async function handle(request, fetcher = globalThis.fetch, secret = process.env.STRIPE_SECRET_KEY) {
  try {
    const input = await payload(request);
    const data = {};
    for (const [key, value] of Object.entries(input)) {
      if (!FIELDS.has(key)) continue;
      if (typeof value !== 'string' || value.length > 12000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return json({ error: 'Réponse invalide ou trop longue.', fields: [key] }, 400);
      data[key] = value.trim();
    }
    const errors = dossierErrors(data);
    if (errors.length) return json({ error: 'Merci de compléter les réponses et consentements requis.', fields: errors }, 400);
    if (typeof input._dossier_id !== 'string' || !REFERENCE_RE.test(input._dossier_id)) return json({ error: 'Référence de dossier invalide' }, 400);
    const offer = offerId(data.offre);
    const total = quote(offer, { voice: data.option_voix_photo === 'oui', portrait: data.option_portrait_photo === 'oui', duo: data.option_duo === 'oui', plaque: data.option_plaque === 'oui' });
    let payment = null;
    if (input._session_id) payment = await verifyPayment(input._session_id, fetcher, secret);
    if (payment && (payment.reference !== input._dossier_id || payment.offer !== offer)) return json({ error: 'Le paiement et le dossier ne correspondent pas. Contactez-nous avec votre référence.' }, 409);
    if (payment && (!payment.buyerEmail || payment.buyerEmail !== data.client_email.toLowerCase())) return json({ error: 'Utilisez l’adresse email du reçu Stripe, ou contactez-nous pour rattacher votre dossier.', fields: ['client_email'] }, 409);
    // Ne pas transmettre les anciennes réponses devenues inutiles après un changement de formule.
    if (data.statut_personne !== 'vivante') delete data.consent_vivant;
    else delete data.deces;
    if (data.type_msg !== "Je l'écris moi-même") delete data.message_libre;
    if (offer !== 'photo') { delete data.option_voix_photo; delete data.option_portrait_photo; }
    if (offer !== 'heritage') for (const key of ['option_duo', 'option_plaque', 'description', 'histoire', 'moments', 'personnes_importantes', 'lieux_importants', 'valeurs', 'rituels', 'heritage', 'anecdote_drole_tendre', 'sujets_a_eviter', 'docs_description', 'dedicace']) delete data[key];
    if (offer === 'photo' && data.option_voix_photo !== 'oui' && data.option_portrait_photo !== 'oui') {
      for (const key of ['a_voix', 'type_enregistrement', 'qualite_enregistrement', 'desc_voix', 'accent', 'voix_texte_type', 'voix_texte']) delete data[key];
    } else {
      if (data.a_voix !== 'Oui') { delete data.type_enregistrement; delete data.qualite_enregistrement; }
      else { delete data.desc_voix; delete data.accent; }
      if (data.voix_texte_type !== "Je l'écris moi-même") delete data.voix_texte;
    }
    data._dossier_id = payment?.reference || input._dossier_id;
    if (payment) data._stripe_session_id = input._session_id;
    data._type = offer === 'heritage' ? 'demande_devis' : 'questionnaire';
    data._paiement = payment ? 'base vérifiée — options à confirmer et facturer séparément' : 'À VÉRIFIER MANUELLEMENT AVANT PRODUCTION';
    data._offre = offer;
    data._date_envoi = new Date().toISOString();
    data._cgv_version = '2026-09-30';
    data._base_eur = String(total.base);
    data._options_eur = String(total.extra);
    data._total_indicatif_eur = String(total.total);
    data._options = total.options.map(([label, price]) => label + ' : ' + price + ' €').join(', ');
    await forward(process.env.FORMSPREE_URL || 'https://formspree.io/f/mykowvda', data, fetcher);
    return json({ accepted: true, reference: data._dossier_id });
  } catch (error) { return failure(error); }
}
export default { fetch(request) { return handle(request); } };
