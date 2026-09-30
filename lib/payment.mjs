import { createHash } from 'node:crypto';
import { REFERENCE_RE } from '../assets/js/core.mjs';
export const SESSION_RE = /^cs_(?:test|live)_[A-Za-z0-9]{10,200}$/;
export async function verifyPayment(sessionId, fetcher = globalThis.fetch, secret = process.env.STRIPE_SECRET_KEY) {
  if (typeof sessionId !== 'string' || !SESSION_RE.test(sessionId)) throw Object.assign(new Error('Référence de paiement invalide'), { status: 400 });
  if (!secret) throw Object.assign(new Error('Vérification automatique indisponible. Le paiement sera contrôlé manuellement avant production.'), { status: 503 });
  const response = await fetcher('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
    headers: { Authorization: 'Bearer ' + secret }, signal: AbortSignal.timeout(10000), redirect: 'error'
  });
  if (!response.ok) throw Object.assign(new Error('Paiement non vérifiable'), { status: 502 });
  const session = await response.json();
  if (session.id !== sessionId || session.status !== 'complete' || session.payment_status !== 'paid' || session.currency !== 'eur' ||
      !Number.isSafeInteger(session.amount_total) || session.amount_total <= 0 ||
      session.livemode !== sessionId.startsWith('cs_live_') ||
      (process.env.VERCEL_ENV === 'production' && session.livemode !== true)) {
    throw Object.assign(new Error('Paiement non confirmé. Attendez sa confirmation avant de poursuivre.'), { status: 409 });
  }
  const hash = createHash('sha256').update(sessionId).digest('hex');
  const fallback = 'CM-' + [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join('-');
  // Une référence par paiement : client_reference_id est un repère fourni par le navigateur, pas une preuve.
  return { paid: true, reference: fallback,
    checkoutReference: REFERENCE_RE.test(session.client_reference_id || '') ? session.client_reference_id : null,
    buyerEmail: typeof session.customer_details?.email === 'string' ? session.customer_details.email.trim().toLowerCase() : '',
    amount: session.amount_total, offer: session.amount_total === 29000 ? 'photo' : session.amount_total === 69000 ? 'souvenir' : null };
}
