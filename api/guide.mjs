import { payload, json, forward, failure } from '../lib/http.mjs';
export async function handle(request, fetcher = globalThis.fetch) {
  try {
    const data = await payload(request);
    if (typeof data.prenom !== 'string' || !data.prenom.trim() || data.prenom.length > 100 ||
      typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.consentement !== 'true') return json({ error: 'Prénom, email et consentement requis' }, 400);
    const endpoint = process.env.GUIDE_WEBHOOK_URL;
    if (!endpoint) return json({ error: 'Envoi du guide indisponible. Contactez-nous par email.' }, 503);
    await forward(endpoint, { prenom: data.prenom.trim(), email: data.email.trim(), consentement: 'true', source: 'guide-souvenirs', date: new Date().toISOString() }, fetcher);
    return json({ accepted: true });
  } catch (error) { return failure(error); }
}
export default { fetch(request) { return handle(request); } };
