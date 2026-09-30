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
  if (!request.headers.get('content-type')?.includes('application/json')) throw Object.assign(new Error('JSON attendu'), { status: 415 });
  if (Number(request.headers.get('content-length')) > 65536) throw Object.assign(new Error('Dossier trop volumineux'), { status: 413 });
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 65536) throw Object.assign(new Error('Dossier trop volumineux'), { status: 413 });
  let data;
  try { data = JSON.parse(text); } catch { throw Object.assign(new Error('JSON invalide'), { status: 400 }); }
  if (!data || Array.isArray(data) || typeof data !== 'object') throw Object.assign(new Error('Dossier invalide'), { status: 400 });
  if (data.website) throw Object.assign(new Error('Envoi refusé'), { status: 400 });
  return data;
}
export async function forward(url, data, fetcher) {
  const response = await fetcher(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', Accept: 'application/json'
  }, body: JSON.stringify(data), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Object.assign(new Error('Réception non confirmée. Réessayez avec la même référence.'), { status: 502 });
}
export function failure(error) {
  return json({ error: error.status ? error.message : 'Réception non confirmée. Réessayez avec la même référence.' }, error.status || 502);
}
