export function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer'
  } });
}
export async function payload(request) {
  if (request.method !== 'POST') throw Object.assign(new Error('Méthode non autorisée'), { status: 405 });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) throw Object.assign(new Error('Origine refusée'), { status: 403 });
  if (request.headers.get('sec-fetch-site') === 'cross-site') throw Object.assign(new Error('Origine refusée'), { status: 403 });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw Object.assign(new Error('JSON attendu'), { status: 415 });
  if (Number(request.headers.get('content-length')) > 65536) throw Object.assign(new Error('Dossier trop volumineux'), { status: 413 });
  const reader = request.body?.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', bytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 65536) { await reader.cancel(); throw Object.assign(new Error('Dossier trop volumineux'), { status: 413 }); }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (error.status) throw error;
      throw Object.assign(new Error('JSON invalide'), { status: 400 });
    } finally { reader.releaseLock(); }
  }
  let data;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }); }
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Object.assign(new Error('Dossier invalide'), { status: 400 });
  if (data.website) throw Object.assign(new Error('Envoi refusé'), { status: 400 });
  return data;
}
export async function forward(url, data, fetcher) {
  const destination = new URL(url);
  if (destination.protocol !== 'https:' || destination.username || destination.password) throw Object.assign(new Error('Réception indisponible. Contactez-nous par email.'), { status: 503 });
  const response = await fetcher(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', Accept: 'application/json'
  }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000), redirect: 'error' });
  if (!response.ok) throw Object.assign(new Error('Réception non confirmée. Réessayez avec la même référence.'), { status: 502 });
}
export function failure(error) {
  return json({ error: error.status ? error.message : 'Réception non confirmée. Réessayez avec la même référence.' }, error.status || 502);
}
