/* Bloc Dommages fourni : sept paires, balayage ou fondu, un seul RAF actif. */
(function () {
  const root = document.getElementById('restauration-dommages');
  if (!root) return;
  const tabs = [...root.querySelectorAll('.cmd-it')];
  const stage = root.querySelector('.cmd-stage');
  const ph = root.querySelector('.cmd-ph');
  const card = root.querySelector('.cmd-card');
  const original = ph.querySelector('.o'), restored = ph.querySelector('.r');
  const line = ph.querySelector('.ln'), glow = ph.querySelector('.gl'), flash = ph.querySelector('.fl');
  const labels = root.querySelector('.cmd-lbl');
  const range = root.querySelector('input[type="range"]');
  const pause = root.querySelector('.cmd-pause');
  const status = root.querySelector('.cmd-status');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = window.navigator.connection;
  const HOLD = 700, SWEEP = 1700, TOTAL = 4300;
  let index = 0, elapsed = 0, frame = null, last = null;
  let visible = false, userPaused = false, hovered = false, focused = false, dragging = false;
  let staticMode = reduced.matches || !!connection?.saveData;
  const ease = x => x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
  const ready = () => [original, restored].every(img => img.complete && img.naturalWidth > 0);

  function wipe(p) {
    p = Math.max(0, Math.min(1, p));
    const fade = tabs[index].dataset.fade === 'true';
    restored.style.clipPath = fade ? 'none' : `inset(0 ${(100 - p * 100).toFixed(2)}% 0 0)`;
    restored.style.opacity = fade ? String(p) : '1';
    line.style.left = glow.style.left = `${p * 100}%`;
    line.style.opacity = glow.style.opacity = !fade && p > .002 && p < .998 ? '1' : '0';
    flash.style.opacity = !staticMode && fade ? String(Math.sin(Math.PI * p) * .5) : '0';
    labels.classList.toggle('rev', p > .5);
    range.value = String(Math.round(p * 100));
    range.setAttribute('aria-valuetext', p === 0 ? 'Photo originale' : p === 1 ? 'Photo restaurée' : `${Math.round(p * 100)} % de la photo restaurée`);
  }
  function stop() {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    last = null;
    card.getAnimations?.().forEach(animation => animation.cancel());
  }
  function update() {
    pause.hidden = staticMode;
    pause.textContent = userPaused ? 'Reprendre' : 'Pause';
    pause.setAttribute('aria-pressed', String(userPaused));
    pause.setAttribute('aria-label', userPaused ? 'Reprendre l’animation' : 'Mettre l’animation en pause');
    root.classList.toggle('cmd-static', staticMode);
    if (staticMode || !visible || document.hidden || userPaused || hovered || focused || dragging || !ready()) { stop(); return; }
    if (frame === null) frame = window.requestAnimationFrame(tick);
  }
  function select(i, manual = false) {
    stop();
    index = (i + tabs.length) % tabs.length;
    elapsed = 0;
    status.textContent = '';
    const tab = tabs[index];
    tabs.forEach((b, k) => {
      b.classList.toggle('on', k === index);
      b.setAttribute('aria-selected', String(k === index));
      b.tabIndex = k === index ? 0 : -1;
      b.querySelector('.p').style.transform = 'scaleX(0)';
    });
    stage.setAttribute('aria-labelledby', tab.id);
    ph.style.aspectRatio = `${tab.dataset.width} / ${tab.dataset.height}`;
    [original, restored].forEach((img, k) => {
      // Seule la paire active est chargée : le résultat masqué doit aussi être prêt.
      img.loading = 'eager';
      img.width = Number(tab.dataset.width); img.height = Number(tab.dataset.height);
      img.alt = `${tab.dataset.alt} : photo ${k ? 'restaurée' : 'originale abîmée'}`;
      img.src = k ? tab.dataset.restored : tab.dataset.original;
      img.style.transform = 'scale(1)';
    });
    root.querySelector('.cmd-cap .c').textContent = `${String(index + 1).padStart(2, '0')} / ${String(tabs.length).padStart(2, '0')}`;
    root.querySelector('.cmd-cap .k').textContent = tab.querySelector('.t').textContent;
    card.style.setProperty('--rot', `${index % 2 ? 1.2 : -1.2}deg`);
    wipe(staticMode ? 1 : 0);
    if (manual) userPaused = true;
    if (visible && !staticMode && !manual && !userPaused && !hovered && !focused) card.animate?.([
      { transform: 'translateX(28px) rotate(4deg) scale(.96)' },
      { transform: `rotate(${index % 2 ? 1.2 : -1.2}deg)` }
    ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    update();
  }
  function tick(now) {
    frame = null;
    if (last !== null) elapsed += Math.max(0, now - last);
    last = now;
    if (elapsed >= TOTAL) { select(index + 1); return; }
    wipe(ease(Math.max(0, Math.min(1, (elapsed - HOLD) / SWEEP))));
    const zoom = `scale(${(1.035 - .035 * Math.min(1, elapsed / TOTAL)).toFixed(4)})`;
    original.style.transform = restored.style.transform = zoom;
    tabs[index].querySelector('.p').style.transform = `scaleX(${elapsed / TOTAL})`;
    update();
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, true));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = i + 1;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = i - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault(); select(next, true); tabs[index].focus();
    });
  });
  pause.addEventListener('click', () => { userPaused = !userPaused; update(); });
  function compare(p) {
    userPaused = true;
    original.style.transform = restored.style.transform = 'scale(1)';
    wipe(p); update();
  }
  range.addEventListener('input', () => compare(Number(range.value) / 100));
  const position = event => {
    const bounds = ph.getBoundingClientRect();
    return bounds.width ? (event.clientX - bounds.left) / bounds.width : 0;
  };
  ph.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !ready()) return;
    dragging = true; ph.setPointerCapture?.(event.pointerId); compare(position(event));
  });
  ph.addEventListener('pointermove', event => { if (dragging) compare(position(event)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => ph.addEventListener(name, () => { dragging = false; update(); }));
  stage.addEventListener('mouseenter', () => { hovered = true; update(); });
  stage.addEventListener('mouseleave', () => { hovered = false; update(); });
  root.addEventListener('focusin', () => { focused = true; update(); });
  root.addEventListener('focusout', event => { focused = !!event.relatedTarget && root.contains(event.relatedTarget); update(); });
  [original, restored].forEach(img => {
    img.addEventListener('load', () => { if (ready()) status.textContent = ''; update(); });
    img.addEventListener('error', () => { status.textContent = 'Cet exemple ne se charge pas. Vous pouvez en sélectionner un autre.'; stop(); });
  });
  function preference() {
    staticMode = reduced.matches || !!connection?.saveData;
    stop(); elapsed = 0;
    card.getAnimations?.().forEach(animation => animation.cancel());
    original.style.transform = restored.style.transform = 'scale(1)';
    wipe(staticMode ? 1 : 0); update();
  }
  reduced.addEventListener?.('change', preference);
  connection?.addEventListener?.('change', preference);
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; update(); }, { threshold: .15 }).observe(root);
  } else {
    const measure = () => { const r = root.getBoundingClientRect(); visible = r.top < window.innerHeight && r.bottom > 0; update(); };
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true }); measure();
  }
  root.querySelector('.cmd-controls').hidden = false;
  select(0);
})();
