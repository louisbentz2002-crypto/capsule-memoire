import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function motion({ reduced = false, saveData = false, loaded = true } = {}) {
  const dom = new JSDOM(source('index.html'), { runScripts: 'outside-only' });
  const w = dom.window, d = w.document;
  const root = d.getElementById('restauration-dommages');
  const pending = new Map();
  let id = 0, now = 0, hidden = false, observer, preferenceChanged;
  Object.defineProperty(d, 'hidden', { get: () => hidden });
  Object.defineProperty(w.navigator, 'connection', { value: { saveData } });
  const preference = { matches: reduced, addEventListener: (_, fn) => { preferenceChanged = fn; } };
  w.matchMedia = () => preference;
  w.IntersectionObserver = class { constructor(callback) { observer = callback; } observe(target) { assert.equal(target, root); } };
  for (const img of root.querySelectorAll('img')) {
    Object.defineProperty(img, 'complete', { get: () => loaded });
    Object.defineProperty(img, 'naturalWidth', { get: () => loaded ? 1120 : 0 });
  }
  w.requestAnimationFrame = fn => { const token = ++id; pending.set(token, fn); return token; };
  w.cancelAnimationFrame = token => pending.delete(token);
  w.eval(source('assets/js/restauration-motion.js'));
  return {
    dom, root, pending,
    intersect: visible => observer([{ isIntersecting: visible }]),
    hide(value) { hidden = value; d.dispatchEvent(new w.Event('visibilitychange')); },
    reduce(value) { preference.matches = value; preferenceChanged(); },
    load(value = true) { loaded = value; root.querySelector('img').dispatchEvent(new w.Event('load')); },
    frame(ms = 16) { now += ms; const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(fn => fn(now)); }
  };
}

test('les sept paires fournies existent et le premier exemple est visible sans JavaScript', () => {
  const dom = new JSDOM(source('index.html'));
  const root = dom.window.document.getElementById('restauration-dommages');
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  assert.equal(tabs.length, 7);
  const assets = tabs.flatMap(tab => [tab.dataset.original, tab.dataset.restored]);
  assert.equal(new Set(assets).size, 14);
  for (const asset of assets) assert.ok(existsSync(new URL('../' + asset, import.meta.url)), asset);
  assert.equal(root.querySelector('.o').getAttribute('src'), tabs[0].dataset.original);
  assert.equal(root.querySelector('.cmd-controls').hidden, true);
  assert.equal(root.querySelector('.cmd-note'), null);
  dom.window.close();
});

test('la lecture attend les images et garde un seul RAF au fil des sept exemples', () => {
  const m = motion({ loaded: false });
  m.intersect(true); assert.equal(m.pending.size, 0);
  assert.ok([...m.root.querySelectorAll('img')].every(img => img.loading === 'eager'));
  m.load(); assert.equal(m.pending.size, 1);
  m.frame(); m.frame(2400);
  assert.equal(m.root.querySelector('input').value, '100');
  m.frame(2000);
  assert.equal(m.root.querySelector('.cmd-cap .c').textContent, '02 / 07');
  for (let i = 0; i < 100; i++) { m.frame(); m.frame(4400); assert.equal(m.pending.size, 1); }
  assert.equal(m.root.querySelectorAll('[aria-selected="true"]').length, 1);
  m.dom.window.close();
});

test('sortir de l’écran ou masquer l’onglet suspend la lecture sans perdre sa progression', () => {
  const m = motion(); m.intersect(true); m.frame(); m.frame(1300);
  const value = m.root.querySelector('input').value;
  m.intersect(false); assert.equal(m.pending.size, 0);
  m.hide(true); m.hide(false); assert.equal(m.pending.size, 0);
  m.intersect(true); m.frame(100000);
  assert.equal(m.root.querySelector('input').value, value);
  m.hide(true); assert.equal(m.pending.size, 0);
  m.hide(false); assert.equal(m.pending.size, 1);
  m.dom.window.close();
});

test('changer de photo relance le balayage et le défilement même si le bouton garde le focus', () => {
  const m = motion(); m.intersect(true); m.frame(); m.frame(1600);
  const tabs = m.root.querySelectorAll('[role="tab"]');
  const pause = m.root.querySelector('.cmd-pause');
  pause.click(); assert.equal(m.pending.size, 0);
  tabs[1].focus(); tabs[1].click();
  assert.equal(m.dom.window.document.activeElement, tabs[1]);
  assert.equal(pause.getAttribute('aria-pressed'), 'false');
  assert.equal(m.root.querySelector('input').value, '0');
  assert.equal(m.pending.size, 1);
  m.frame(); m.frame(1300);
  assert.ok(Number(m.root.querySelector('input').value) > 0);
  m.frame(3100);
  assert.equal(m.root.querySelector('.cmd-cap .c').textContent, '03 / 07');
  assert.equal(m.pending.size, 1);
  m.dom.window.close();
});

test('choix au clavier relance la lecture, comparaison manuelle reste en pause après changements de visibilité', () => {
  const m = motion(); m.intersect(true);
  const tabs = m.root.querySelectorAll('[role="tab"]');
  tabs[0].dispatchEvent(new m.dom.window.KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  assert.equal(m.root.querySelector('.cmd-stage').getAttribute('aria-labelledby'), 'cmd-tab-7');
  assert.equal(m.dom.window.document.activeElement, tabs[6]);
  assert.equal(tabs[6].tabIndex, 0);
  assert.equal(m.pending.size, 1);
  const range = m.root.querySelector('input'); range.value = '40'; range.dispatchEvent(new m.dom.window.Event('input'));
  assert.equal(m.root.querySelector('.cmd-ph .r').style.clipPath, 'none');
  assert.equal(m.root.querySelector('.cmd-ph .r').style.opacity, '0.4');
  assert.equal(m.root.querySelector('.ln').style.opacity, '0');
  m.hide(true); m.hide(false); m.intersect(false); m.intersect(true);
  assert.equal(m.pending.size, 0);
  assert.equal(m.root.querySelector('.cmd-pause').getAttribute('aria-pressed'), 'true');
  tabs[0].click(); range.value = '50'; range.dispatchEvent(new m.dom.window.Event('input'));
  assert.equal(m.root.querySelector('.cmd-ph .r').style.clipPath, 'inset(0 50.00% 0 0)');
  m.dom.window.close();
});

test('pause explicite, survol et erreur de chargement arrêtent la lecture', () => {
  const m = motion(); m.intersect(true);
  const pause = m.root.querySelector('.cmd-pause'); pause.focus(); pause.click();
  assert.equal(m.pending.size, 0); pause.click(); assert.equal(m.pending.size, 1);
  const stage = m.root.querySelector('.cmd-stage');
  stage.dispatchEvent(new m.dom.window.Event('mouseenter')); assert.equal(m.pending.size, 0);
  stage.dispatchEvent(new m.dom.window.Event('mouseleave')); assert.equal(m.pending.size, 1);
  m.load(false); m.root.querySelector('img').dispatchEvent(new m.dom.window.Event('error'));
  assert.equal(m.pending.size, 0);
  assert.match(m.root.querySelector('.cmd-status').textContent, /sélectionner un autre/);
  m.root.querySelectorAll('[role="tab"]')[1].click(); m.load();
  assert.equal(m.root.querySelector('.cmd-status').textContent, '');
  m.dom.window.close();
});

test('mouvement réduit ou économie de données : pas d’animation, choix et comparaison disponibles', () => {
  for (const options of [{ reduced: true }, { saveData: true }]) {
    const m = motion(options); m.intersect(true);
    assert.equal(m.pending.size, 0);
    assert.equal(m.root.querySelector('.cmd-pause').hidden, true);
    assert.equal(m.root.querySelector('input').value, '100');
    m.root.querySelectorAll('[role="tab"]')[6].click();
    assert.equal(m.root.querySelector('input').value, '100');
    assert.equal(m.root.querySelector('.fl').style.opacity, '0');
    const range = m.root.querySelector('input'); range.value = '0'; range.dispatchEvent(new m.dom.window.Event('input'));
    assert.equal(m.root.querySelector('.cmd-ph .r').style.opacity, '0');
    m.dom.window.close();
  }
  const m = motion(); m.intersect(true); m.reduce(true); assert.equal(m.pending.size, 0);
  m.reduce(false); assert.equal(m.pending.size, 1);
  m.dom.window.close();
});
