import { json, failure } from '../lib/http.mjs';
import { verifyPayment } from '../lib/payment.mjs';
export async function handle(request, fetcher = globalThis.fetch, secret = process.env.STRIPE_SECRET_KEY) {
  if (request.method !== 'GET') return json({ error: 'Méthode non autorisée' }, 405);
  try { return json(await verifyPayment(new URL(request.url).searchParams.get('session_id'), fetcher, secret)); }
  catch (error) { return failure(error); }
}
export default { fetch(request) { return handle(request); } };
