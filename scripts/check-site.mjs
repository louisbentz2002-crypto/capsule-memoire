import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const problems = [];
const csp = JSON.parse(readFileSync('vercel.json', 'utf8')).headers.find(rule => rule.source === '/(.*)').headers.find(header => header.key === 'Content-Security-Policy')?.value || '';
if (!csp.includes("script-src-attr 'none'") || !csp.includes("object-src 'none'") || !csp.includes("frame-ancestors 'none'")) problems.push('Protections CSP absentes');
for (const file of readdirSync('.').filter(name => name.endsWith('.html'))) {
  const source = readFileSync(file, 'utf8');
  if (source.split('</html>')[1]?.trim()) problems.push(file + ' : contenu après </html>');
  const dom = new JSDOM(source, { url: 'https://www.capsulememoire.fr/' + file });
  const document = dom.window.document, ids = new Set();
  for (const el of document.querySelectorAll('[id]')) {
    if (ids.has(el.id)) problems.push(file + ' : ID en double ' + el.id); ids.add(el.id);
  }
  for (const el of document.querySelectorAll('*')) for (const attribute of el.attributes) {
    if (/^on/i.test(attribute.name)) problems.push(file + ' : gestionnaire inline interdit ' + attribute.name);
    if (/^(href|src|action)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value)) problems.push(file + ' : URL JavaScript interdite');
  }
  for (const el of document.querySelectorAll('[src], [href], [data-src]')) {
    const path = el.getAttribute('src') || el.getAttribute('href') || el.getAttribute('data-src');
    if (!path || /^(https?:|mailto:|tel:|data:)/.test(path)) continue;
    if (path.startsWith('#')) { if (path.length > 1 && !document.getElementById(path.slice(1))) problems.push(file + ' : ancre absente ' + path); continue; }
    const local = path.split(/[?#]/)[0].replace(/^\//, '') || 'index.html';
    if (!existsSync(local)) {
      // Le contrôle complet s’effectue en CI, avec les médias présents dans le dépôt.
      if (process.env.CM_TEXT_MIRROR === '1' && /\.(png|ico|webp|mp[34])$/.test(local)) continue;
      problems.push(file + ' : fichier absent ' + local);
    }
  }
  for (const script of document.querySelectorAll('script:not([src])')) {
    if (script.type === 'application/ld+json') {
      try { JSON.parse(script.textContent); } catch { problems.push(file + ' : JSON-LD invalide'); }
      const hash = "'sha256-" + createHash('sha256').update(script.textContent).digest('base64') + "'";
      if (!csp.includes(hash)) problems.push(file + ' : empreinte JSON-LD absente de la CSP');
    } else problems.push(file + ' : script inline interdit');
  }
  dom.window.close();
}
function syntax(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const path = dir + '/' + item.name;
    if (item.isDirectory()) syntax(path);
    else if (/\.(mjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
      if (result.status !== 0) problems.push(result.stderr);
    }
  }
}
for (const dir of ['assets/js', 'api', 'lib']) syntax(dir);
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Pages, ancres, fichiers, JSON-LD et syntaxe JavaScript : OK');
