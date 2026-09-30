import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function motion({ reduced = false, saveData = false, loaded = true } = {}) {
  const dom = new JSDOM(source('index.html'), { runScripts: 'outside-only' });
  const w = dom.window, d = w.document;
  const root = d.getElementById('restauration-motion');
  const pending = new Map();
  let id = 0, now = 0, hidden = false, observer, preferenceChanged;
  Object.defineProperty(d, 'hidden', { get: () => hidden });
  Object.defineProperty(w.navigator, 'connection', { value: { saveData } });
  const preference = { matches: reduced, addEventListener: (_, fn) => { preferenceChanged = fn; } };
  w.matchMedia = () => preference;
  w.IntersectionObserver = class {
    constructor(callback) { observer = callback; }
    observe(target) { assert.equal(target, root); }
  };
  for (const img of root.querySelectorAll('img')) {
    Object.defineProperty(img, 'complete', { get: () => loaded });
    Object.defineProperty(img, 'naturalWidth', { get: () => loaded ? 1122 : 0 });
  }
  w.setTimeout = (fn, delay) => { const token = ++id; pending.set(token, { fn, at: now + delay }); return token; };
  w.clearTimeout = token => pending.delete(token);
  w.eval(source('assets/js/restauration-motion.js'));
  return {
    dom, root, pending,
    intersect: visible => observer([{ isIntersecting: visible }]),
    hide(value) { hidden = value; d.dispatchEvent(new w.Event('visibilitychange')); },
    reduce(value) { preference.matches = value; preferenceChanged(); },
    load() { loaded = true; root.querySelector('img').dispatchEvent(new w.Event('load')); },
    advance(ms) {
      const until = now + ms;
      while (pending.size) {
        const [token, next] = [...pending.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (next.at > until) break;
        pending.delete(token); now = next.at; next.fn();
      }
      now = until;
    }
  };
}

test('le diaporama attend les images, puis conserve un seul minuteur après de nombreux cycles', () => {
  const m = motion({ loaded: false });
  m.intersect(true); assert.equal(m.pending.size, 0);
  m.load(); assert.equal(m.pending.size, 1);
  m.advance(900);
  assert.equal(m.root.querySelector('.cmr-state').textContent, 'Restauration…');
  m.advance(2500);
  assert.equal(m.root.querySelector('.cmr-state').textContent, 'Photo restaurée');
  m.advance(100 * 6700);
  assert.equal(m.pending.size, 1);
  assert.equal(m.root.querySelectorAll('.cmr-card[aria-hidden="false"]').length, 1);
  m.dom.window.close();
});

test('sortir de l’écran coupe la lecture et revenir sur l’onglet ne la relance pas hors écran', () => {
  const m = motion();
  m.intersect(true); m.advance(5600);
  m.intersect(false); assert.equal(m.pending.size, 0);
  m.hide(true); m.hide(false); assert.equal(m.pending.size, 0);
  m.intersect(true); assert.equal(m.pending.size, 1);
  assert.equal(m.root.querySelector('.cmr-n').textContent, '02 / 04');
  assert.equal(m.root.querySelectorAll('.cmr-card.leave').length, 0);
  m.hide(true); assert.equal(m.pending.size, 0);
  m.hide(false); assert.equal(m.pending.size, 1);
  m.dom.window.close();
});

test('la pause choisie au clavier reste active après un changement d’onglet ou de visibilité', () => {
  const m = motion();
  m.intersect(true);
  const button = m.root.querySelector('button');
  button.focus(); button.click();
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.equal(m.pending.size, 0);
  m.hide(true); m.hide(false); m.intersect(false); m.intersect(true);
  assert.equal(m.pending.size, 0);
  button.click(); assert.equal(m.pending.size, 1);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  m.dom.window.close();
});

test('mouvement réduit ou économie de données : résultat statique sans minuteur, y compris après changement de préférence', () => {
  for (const options of [{ reduced: true }, { saveData: true }]) {
    const m = motion(options); m.intersect(true);
    assert.equal(m.pending.size, 0);
    assert.equal(m.root.querySelector('.cmr-pause').hidden, true);
    assert.equal(m.root.querySelector('.cmr-card[data-p="0"]').classList.contains('sweep'), true);
    assert.equal(m.root.querySelector('.cmr-card[data-p="0"]').classList.contains('reset'), false);
    assert.equal(m.root.querySelector('.cmr-state').textContent, 'Photo restaurée');
    m.dom.window.close();
  }
  const m = motion(); m.intersect(true); m.reduce(true);
  assert.equal(m.pending.size, 0);
  m.reduce(false); assert.equal(m.pending.size, 1);
  m.dom.window.close();
});
