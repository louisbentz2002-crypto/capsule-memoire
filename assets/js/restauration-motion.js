/* Animation du bloc fourni : un seul minuteur, arrêt hors écran et pause explicite. */
(function () {
  const root = document.getElementById('restauration-motion');
  if (!root) return;
  const stage = root.querySelector('.cmr-stage');
  const counter = root.querySelector('.cmr-n');
  const state = root.querySelector('.cmr-state');
  const bar = root.querySelector('.cmr-bar i');
  const pause = root.querySelector('.cmr-pause');
  const order = [...stage.querySelectorAll('.cmr-card')];
  if (!order.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let timer = null;
  let running = false;
  let visible = false;
  let userPaused = false;
  let index = 0;

  function still() {
    return reduced.matches || !!window.navigator.connection?.saveData;
  }
  function animations() {
    return root.getAnimations?.({ subtree: true }) || [];
  }
  function stop() {
    window.clearTimeout(timer);
    timer = null;
    running = false;
    animations().forEach(animation => animation.pause());
  }
  function later(fn, delay) {
    timer = window.setTimeout(() => {
      timer = null;
      if (running) fn();
    }, delay);
  }
  function arrange(restored = false) {
    animations().forEach(animation => animation.cancel());
    order.forEach((card, position) => {
      card.classList.add('reset');
      card.classList.remove('leave', 'sweep', 'done');
      card.dataset.p = position;
      card.setAttribute('aria-hidden', String(position !== 0));
    });
    if (restored) order[0].classList.add('sweep', 'done');
    counter.textContent = String(index % order.length + 1).padStart(2, '0') + ' / ' + String(order.length).padStart(2, '0');
    state.textContent = restored ? 'Photo restaurée' : 'Photo originale';
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(0)';
    void stage.offsetWidth;
    order.forEach(card => card.classList.remove('reset'));
  }
  function ready() {
    return [...order[0].querySelectorAll('img')].every(img => img.complete && img.naturalWidth > 0);
  }
  function cycle() {
    if (!ready()) { stop(); return; }
    arrange();
    const front = order[0];
    bar.style.transition = 'transform 5600ms linear';
    bar.style.transform = 'scaleX(1)';
    later(() => {
      front.classList.add('sweep');
      state.textContent = 'Restauration…';
      later(() => {
        front.classList.add('done');
        state.textContent = 'Photo restaurée';
        later(() => {
          front.classList.add('leave');
          order.push(order.shift());
          order.forEach((card, position) => {
            if (card !== front) card.dataset.p = position;
            card.setAttribute('aria-hidden', String(position !== 0));
          });
          index++;
          later(cycle, 1100);
        }, 2200);
      }, 2500);
    }, 900);
  }
  function update() {
    const staticMode = still();
    root.classList.toggle('cmr-static', staticMode);
    pause.hidden = staticMode;
    if (staticMode) { stop(); arrange(true); return; }
    if (!visible || document.hidden || userPaused || !ready()) { stop(); return; }
    if (!running) { running = true; cycle(); }
  }
  pause.addEventListener('click', () => {
    userPaused = !userPaused;
    pause.setAttribute('aria-pressed', String(userPaused));
    pause.setAttribute('aria-label', userPaused ? 'Reprendre l’animation' : 'Mettre l’animation en pause');
    pause.textContent = userPaused ? 'Reprendre' : 'Pause';
    update();
  });
  stage.querySelectorAll('img').forEach(img => img.addEventListener('load', update));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      update();
    }, { threshold: .25 }).observe(root);
  } else {
    const measure = () => {
      const bounds = root.getBoundingClientRect();
      visible = bounds.top < window.innerHeight && bounds.bottom > 0;
      update();
    };
    window.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    measure();
  }
  document.addEventListener('visibilitychange', update);
  reduced.addEventListener?.('change', update);
  window.navigator.connection?.addEventListener?.('change', update);
  update();
})();
