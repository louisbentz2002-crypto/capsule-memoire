
  /* ══ WEBHOOK — remplir ici pour connecter Make / n8n / Brevo ══ */
  const WEBHOOK_URL = '/api/guide';

  /* ══ REVEAL AU SCROLL ══ */
  const obs = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.08 }) : null;
  document.querySelectorAll('.rv').forEach(el => obs ? obs.observe(el) : el.classList.add('in'));

  /* ══ ACCORDÉON QUESTIONS ══ */
  document.querySelectorAll('.q-header').forEach(h => {
    h.addEventListener('click', () => {
      const item = h.closest('.q-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.q-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
      document.querySelectorAll('.q-header').forEach(header => header.setAttribute('aria-expanded', String(header.closest('.q-item').classList.contains('open'))));
    });
    h.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.click(); }
    });
    h.setAttribute('role', 'button'); h.setAttribute('tabindex', '0'); h.setAttribute('aria-expanded', 'false');
  });

  /* ══ SCROLL FLUIDE vers ancre ══ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
    });
  });

  /* ══ FORMULAIRE ══ */
  const form = document.getElementById('guideForm');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.querySelector('.f-submit').disabled) return;
    let valid = true;

    /* Validation prénom */
    const prenom = document.getElementById('f-prenom');
    const errPrenom = document.getElementById('err-prenom');
    if (!prenom.value.trim()) {
      prenom.classList.add('error'); errPrenom.classList.add('show'); valid = false;
    } else { prenom.classList.remove('error'); errPrenom.classList.remove('show'); }

    /* Validation email */
    const email = document.getElementById('f-email');
    const errEmail = document.getElementById('err-email');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim());
    if (!emailOk) {
      email.classList.add('error'); errEmail.classList.add('show'); valid = false;
    } else { email.classList.remove('error'); errEmail.classList.remove('show'); }

    /* Validation consentement */
    const consent = document.getElementById('f-consent');
    const errConsent = document.getElementById('err-consent');
    if (!consent.checked) {
      errConsent.classList.add('show'); valid = false;
    } else { errConsent.classList.remove('show'); }

    if (!valid) return;

    document.getElementById('guideError').textContent = '';
    /* ══ ENVOI ══ */
    const btn = form.querySelector('.f-submit');
    btn.textContent = 'Envoi…'; btn.disabled = true;

    const payload = {
      website: form.querySelector('[name="website"]').value,
      prenom: prenom.value.trim(),
      email: email.value.trim(),
      consentement: "true",
      source: 'guide-souvenirs',
      date: new Date().toISOString()
    };

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15000)
      });
      if (!response.ok || !(await response.json()).accepted) throw new Error('Réception non confirmée');
      /* Succès */
      form.style.display = 'none';
      document.getElementById('formSuccess').classList.add('show');
    } catch {
      btn.textContent = 'Recevoir le guide'; btn.disabled = false;
      document.getElementById('guideError').textContent = 'Envoi non confirmé. Réessayez ou contactez contact.capsulememoire@gmail.com. En cas de délai réseau, vérifiez aussi votre boîte mail.';
    }
  });

  /* Suppression erreur au remplissage */
  document.querySelectorAll('.f-input').forEach(inp => {
    inp.addEventListener('input', () => {
      inp.classList.remove('error');
      const errId = 'err-' + inp.id.replace('f-','');
      document.getElementById(errId)?.classList.remove('show');
    });
  });
