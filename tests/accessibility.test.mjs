import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
function homepage({ reduced = false, saveData = false, width = 1363, touch = false } = {}) {
  const dom = new JSDOM(source('index.html'), { url: 'https://www.capsulememoire.fr/', runScripts: 'outside-only' });
  const w = dom.window; let loads = 0, plays = 0;
  w.innerWidth = width;
  Object.defineProperty(w.document.getElementById('hero'), 'offsetHeight', { value: 600, configurable: true });
  w.matchMedia = query => ({ get matches() {
    if (query.includes('max-width: 640px')) return w.innerWidth <= 640 && touch;
    return query === '(prefers-reduced-motion: reduce)' && reduced;
  } });
  w.scrollTo = () => {};
  w.HTMLMediaElement.prototype.load = () => { loads++; };
  w.HTMLMediaElement.prototype.play = async () => { plays++; };
  w.HTMLMediaElement.prototype.pause = () => {};
  Object.defineProperty(w.navigator, 'connection', { value: { saveData } });
  w.eval(source('assets/js/site.js'));
  return { dom, w, d: w.document, loads: () => loads, plays: () => plays };
}
test('le menu garde le focus, désactive le fond et rend le focus après Échap', () => {
  const { w, d, dom } = homepage();
  d.getElementById('burgerBtn').click();
  assert.equal(d.getElementById('nav').inert, true);
  const menu = d.getElementById('mobMenu');
  const focusable = [...menu.querySelectorAll('a[href], button')];
  assert.equal(d.activeElement, focusable[0]);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
  assert.equal(d.activeElement, focusable.at(-1));
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
  assert.equal(d.activeElement, focusable[0]);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
  assert.equal(menu.getAttribute('aria-hidden'), 'true'); assert.equal(d.getElementById('nav').inert, false);
  assert.equal(d.activeElement, d.getElementById('burgerBtn')); dom.window.close();
});
test('un lien du menu ferme le dialogue sans gestionnaire inline', () => {
  const { d, dom } = homepage(); d.getElementById('burgerBtn').click();
  d.querySelector('#mobMenu a').click();
  assert.equal(d.getElementById('mobMenu').classList.contains('open'), false); dom.window.close();
});
test('le bandeau mobile reste masqué sur PC, quelle que soit la largeur de la fenêtre', () => {
  for (const width of [1848, 1280, 960, 640, 390]) {
    const { w, d, dom } = homepage({ width });
    w.scrollY = 1200; w.dispatchEvent(new w.Event('scroll'));
    assert.equal(d.getElementById('stickyCta').classList.contains('hidden'), true, 'PC largeur ' + width);
    dom.window.close();
  }
});
test('sur téléphone, le bandeau apparaît après le hero et laisse libres les tarifs, le contact et le menu', () => {
  const { w, d, dom } = homepage({ width: 390, touch: true });
  const bar = d.getElementById('stickyCta');
  Object.defineProperty(d.getElementById('hero'), 'offsetHeight', { value: 600 });
  assert.equal(bar.classList.contains('hidden'), true);
  w.scrollY = 800; w.dispatchEvent(new w.Event('scroll'));
  assert.equal(bar.classList.contains('hidden'), false);
  for (const el of [d.getElementById('tarifs'), d.getElementById('contact'), d.querySelector('footer')]) {
    el.getBoundingClientRect = () => ({ top: 100, bottom: 500 }); w.dispatchEvent(new w.Event('scroll'));
    assert.equal(bar.classList.contains('hidden'), true);
    el.getBoundingClientRect = () => ({ top: 2000, bottom: 2500 }); w.dispatchEvent(new w.Event('scroll'));
    assert.equal(bar.classList.contains('hidden'), false);
  }
  d.getElementById('burgerBtn').click(); assert.equal(bar.classList.contains('hidden'), true);
  d.getElementById('mobClose').click(); assert.equal(bar.classList.contains('hidden'), false);
  w.innerWidth = 800; w.dispatchEvent(new w.Event('resize'));
  assert.equal(bar.classList.contains('hidden'), true); dom.window.close();
});
test('mouvement réduit et économie de données : aucun chargement vidéo avant un clic', () => {
  for (const preferences of [{ reduced: true }, { saveData: true }]) {
    const { d, dom, loads, plays } = homepage(preferences);
    assert.equal(loads(), 0); assert.equal(plays(), 0);
    assert.equal(d.querySelectorAll('.video-load-btn').length, 5);
    d.querySelector('.video-load-btn').click();
    assert.equal(loads(), 1); assert.equal(plays(), 1);
    assert.equal(d.querySelectorAll('.video-load-btn').length, 4); dom.window.close();
  }
});
test('Stripe est chargé après les références et ne peut plus initialiser un bouton sans référence', async () => {
  const dom = new JSDOM(source('index.html'), { url: 'https://www.capsulememoire.fr/', runScripts: 'outside-only' });
  const d = dom.window.document; let checked = false;
  assert.equal(d.querySelector('script[src*="stripe.com"]'), null);
  const append = d.head.append.bind(d.head);
  d.head.append = script => {
    assert.equal(script.src, 'https://js.stripe.com/v3/buy-button.js');
    const refs = [...d.querySelectorAll('stripe-buy-button')].map(button => button.getAttribute('client-reference-id'));
    assert.equal(refs.length, 3); assert.ok(refs.every(ref => /^CM-[\da-f-]{36}$/i.test(ref)));
    assert.equal(new Set(refs).size, 1); checked = true; append(script);
  };
  Object.assign(globalThis, { document: d, localStorage: dom.window.localStorage });
  await import('../assets/js/checkout.mjs?ordering-test');
  assert.equal(checked, true); dom.window.close();
});
test('le contact ne confirme pas un HTTP 200 sans accusé et évite deux envois simultanés', async () => {
  const { w, d, dom } = homepage(); w.AbortSignal = AbortSignal;
  let resolve, calls = 0;
  w.fetch = async (url, options) => {
    assert.equal(url, '/api/contact'); assert.equal(options.headers['Content-Type'], 'application/json');
    calls++; return new Promise(done => { resolve = done; });
  };
  for (const el of d.querySelectorAll('#contactForm [required]')) el.value = el.type === 'email' ? 'client@example.com' : 'Test';
  const form = d.getElementById('contactForm');
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); form.dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal(calls, 1); resolve(new Response('{}'));
  await new Promise(done => setTimeout(done, 0));
  assert.notEqual(d.getElementById('cfSuccess').style.display, 'block');
  assert.equal(form.querySelector('button[type="submit"]').disabled, false); dom.window.close();
});
