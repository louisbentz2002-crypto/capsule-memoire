

/* NAV SCROLL */
const nav=document.getElementById('nav');
if(nav) window.addEventListener('scroll',()=>nav.classList.toggle('on',window.scrollY>60),{passive:true});

/* REVEAL */
const obs = 'IntersectionObserver' in window ? new IntersectionObserver(en=>{en.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in');});},{threshold:.1}) : null;
document.querySelectorAll('.rv:not(#hero .rv)').forEach(el=> obs ? obs.observe(el) : el.classList.add('in'));

/* LAZY VIDEOS */
function loadVideo(video){
  const source = video.querySelector('source[data-src]');
  if(source){ source.src = source.dataset.src; source.removeAttribute('data-src'); video.load(); }
  video.play?.().catch(()=>{});
}
const lazyVideos = document.querySelectorAll('video.lazy-video');
if('IntersectionObserver' in window){
  const videoObs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target;
      if(entry.isIntersecting){ loadVideo(video); }
      else { video.pause?.(); }
    });
  }, { rootMargin: '200px 0px', threshold: .1 });
  lazyVideos.forEach(video => videoObs.observe(video));
} else {
  lazyVideos.forEach(loadVideo);
}

/* FAQ */
document.querySelectorAll('.faq-q').forEach((q, index)=>{
  const answer = q.nextElementSibling;
  if(answer && !answer.id) answer.id = `faq-answer-${index + 1}`;
  q.setAttribute('role','button');
  q.setAttribute('tabindex','0');
  q.setAttribute('aria-expanded','false');
  if(answer) q.setAttribute('aria-controls', answer.id);
  const toggleFaq = () => {
    const item=q.closest('.faq-item');
    const isOpen=item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i=>{
      i.classList.remove('open');
      i.querySelector('.faq-q')?.setAttribute('aria-expanded','false');
    });
    if(!isOpen){ item.classList.add('open'); q.setAttribute('aria-expanded','true'); }
  };
  q.addEventListener('click', toggleFaq);
  q.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggleFaq(); } });
});

// ── SLIDERS AVANT/APRÈS ──


/* HAMBURGER MENU */
const mobMenu = document.getElementById('mobMenu');
const burgerBtn = document.getElementById('burgerBtn');
const mobClose = document.getElementById('mobClose');
var _scrollY = 0;
function openMobMenu(){
  _scrollY = window.scrollY;
  document.body.style.top = '-' + _scrollY + 'px';
  if(mobMenu){ mobMenu.inert=false; mobMenu.classList.add('open'); mobMenu.setAttribute('aria-hidden','false'); }
  if(burgerBtn) burgerBtn.setAttribute('aria-expanded','true');
  document.body.classList.add('mob-open');
  mobClose?.focus();
}
function closeMobMenu(){
  if(mobMenu){ mobMenu.classList.remove('open'); mobMenu.setAttribute('aria-hidden','true'); mobMenu.inert=true; }
  if(burgerBtn) burgerBtn.setAttribute('aria-expanded','false');
  document.body.classList.remove('mob-open');
  document.body.style.top = '';
  window.scrollTo(0, _scrollY);
}
if(burgerBtn) burgerBtn.addEventListener('click', openMobMenu);
if(mobClose) mobClose.addEventListener('click', closeMobMenu);
document.addEventListener('keydown', e => { if(e.key==='Escape' && mobMenu?.classList.contains('open')) { closeMobMenu(); burgerBtn?.focus(); } });
if(mobMenu) mobMenu.addEventListener('click', e => { if(e.target === mobMenu) closeMobMenu(); });

/* STICKY CTA */
const stickyCta = document.getElementById('stickyCta');
const heroEl = document.getElementById('hero');
stickyCta?.querySelector('a')?.addEventListener('click', () => stickyCta.classList.add('hidden'));
window.addEventListener('scroll',()=>{
  if(stickyCta && heroEl){
    const heroH = heroEl.offsetHeight;
    stickyCta.classList.toggle('hidden', window.scrollY < heroH - 100);
  }
},{passive:true});

/* CONTACT FORM */
const contactForm = document.getElementById('contactForm');
const cfSuccess = document.getElementById('cfSuccess');
if(contactForm){
  contactForm.addEventListener('submit', async function(e){
    e.preventDefault();
    if (!contactForm.reportValidity()) return;
    const btn = contactForm.querySelector('button[type="submit"]');
    document.getElementById('cfError').textContent = '';
    btn.textContent = 'Envoi en cours…';
    btn.disabled = true;
    try {
      const data = new FormData(contactForm);
      const res = await fetch('https://formspree.io/f/mykowvda',{
        method:'POST', body: data, headers:{'Accept':'application/json'}, signal: AbortSignal.timeout(15000)
      });
      if(res.ok){
        contactForm.style.display='none';
        if(cfSuccess) cfSuccess.style.display='block';
      } else { throw new Error('error'); }
    } catch(err){
      btn.textContent = 'Envoyer le message';
      btn.disabled = false;
      document.getElementById('cfError').textContent = 'Envoi non confirmé. Réessayez ou écrivez à contact.capsulememoire@gmail.com.';
    }
  });
}

      function initSlider(id) {
    const wrap = document.getElementById(id); if (!wrap) return;
    const after = wrap.querySelector('.sl-after');
    const line = wrap.querySelector('.sl-line');
    const btn = wrap.querySelector('.sl-btn');
    let active = false;
    function setPos(x) {
      const r = wrap.getBoundingClientRect();
      const p = Math.min(Math.max((x - r.left) / r.width, 0.02), 0.98) * 100;
      after.style.clipPath = `inset(0 ${(100-p).toFixed(1)}% 0 0)`;
      line.style.left = btn.style.left = p + '%';
      wrap.setAttribute('aria-valuenow', String(Math.round(p)));
    }
    wrap.addEventListener('mousedown', e => { active = true; setPos(e.clientX); });
    wrap.addEventListener('touchstart', e => { active = true; setPos(e.touches[0].clientX); }, {passive:true});
    window.addEventListener('mousemove', e => { if (active) setPos(e.clientX); });
    window.addEventListener('touchmove', e => { if (active) setPos(e.touches[0].clientX); }, {passive:true});
    wrap.setAttribute('role', 'slider'); wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('aria-label', 'Comparer la photo avant et après restauration');
    wrap.setAttribute('aria-valuemin', '2'); wrap.setAttribute('aria-valuemax', '98'); wrap.setAttribute('aria-valuenow', '50');
    wrap.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const r = wrap.getBoundingClientRect();
      const value = Number(wrap.getAttribute('aria-valuenow'));
      const next = e.key === 'Home' ? 2 : e.key === 'End' ? 98 : value + (e.key === 'ArrowRight' ? 5 : -5);
      setPos(r.left + next / 100 * r.width);
    });
    window.addEventListener('mouseup', () => active = false);
    window.addEventListener('touchend', () => active = false);
  }
  ['s1','s2','s3','s4','s5','s6','s7','s8'].forEach(initSlider);


  // ── CURSEUR PREMIUM DESKTOP ──
  (function(){
    var supportsCursor = window.matchMedia(
      '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
    ).matches;
    if (!supportsCursor) return;

    var dot = document.getElementById('cm-cursor-dot');
    var ring = document.getElementById('cm-cursor-ring');
    if (!dot || !ring) return;

    var mouseX = -100, mouseY = -100;
    var ringX = -100, ringY = -100;

    function animateRing(){
      ringX += (mouseX - ringX) * 0.2;
      ringY += (mouseY - ringY) * 0.2;
      ring.style.left = ringX + 'px';
      ring.style.top = ringY + 'px';
      window.requestAnimationFrame(animateRing);
    }

    document.addEventListener('pointermove', function(event){
      mouseX = event.clientX;
      mouseY = event.clientY;
      dot.style.left = mouseX + 'px';
      dot.style.top = mouseY + 'px';
      document.body.classList.add('cm-cursor-ready');
      document.body.classList.remove('cm-cursor-hidden');
    }, { passive: true });

    document.addEventListener('pointerover', function(event){
      if (event.target.closest('a, button')) ring.classList.add('cm-hover');
    });
    document.addEventListener('pointerout', function(event){
      if (event.target.closest('a, button')) ring.classList.remove('cm-hover');
    });
    document.documentElement.addEventListener('mouseleave', function(){
      document.body.classList.add('cm-cursor-hidden');
    });
    document.documentElement.addEventListener('mouseenter', function(){
      document.body.classList.remove('cm-cursor-hidden');
    });

    animateRing();
  })();
