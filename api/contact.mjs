import { payload, json, forward, failure } from '../lib/http.mjs';
export async function handle(request, fetcher = globalThis.fetch) {
  try {
    const input = await payload(request), data = {};
    const limits = { prenom: 100, nom: 100, email: 254, telephone: 40, message: 6000 };
    for (const [key, limit] of Object.entries(limits)) {
      const value = input[key] ?? '';
      if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return json({ error: 'Message invalide ou trop long.' }, 400);
      data[key] = value.trim();
    }
    if (!data.prenom || !data.nom || !data.message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return json({ error: 'Prénom, nom, email et message requis.' }, 400);
    await forward(process.env.FORMSPREE_URL || 'https://formspree.io/f/mykowvda', { ...data, _type: 'contact', _date_envoi: new Date().toISOString() }, fetcher);
    return json({ accepted: true });
  } catch (error) { return failure(error); }
}
export default { fetch(request) { return handle(request); } };
