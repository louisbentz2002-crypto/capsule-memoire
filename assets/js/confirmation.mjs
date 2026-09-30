import { reference, writeStored, REFERENCE_RE } from './core.mjs';
const status = document.getElementById('paymentStatus');
const link = document.getElementById('questionnaireLink');
const sessionId = new URL(location.href).searchParams.get('session_id');
if (sessionId) {
  status.textContent = 'Vérification du paiement en cours…';
  try {
    const response = await fetch('/api/commande?session_id=' + encodeURIComponent(sessionId), { signal: AbortSignal.timeout(10000), cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Paiement non vérifiable');
    if (result.paid !== true || !REFERENCE_RE.test(result.reference || '')) throw new Error('Paiement non vérifiable');
    try {
      const previous = JSON.parse(sessionStorage.getItem('cm-draft'));
      if (previous?.value?.reference !== result.reference) { sessionStorage.removeItem('cm-draft'); localStorage.removeItem('cm-draft'); }
      writeStored(localStorage, 'cm-reference', result.reference);
      writeStored(sessionStorage, 'cm-payment', { sessionId, reference: result.reference, offer: result.offer });
    } catch { /* Le contrôle manuel reste possible si le stockage est bloqué. */ }
    if (!result.offer) {
      link.href = 'mailto:contact.capsulememoire@gmail.com?subject=' + encodeURIComponent('Commande ' + result.reference);
      link.textContent = 'Transmettre mon reçu et mon fichier par email →';
      status.textContent = 'Paiement reçu. Cette transaction ne correspond pas à une formule Photo ou Souvenir standard. Envoyez-nous votre reçu et votre fichier avec la référence ' + result.reference + ' pour confirmer la prestation.';
    } else status.textContent = 'Paiement de la formule confirmé. Référence : ' + result.reference + '. Les options éventuelles sont à confirmer séparément.';
  } catch (error) { status.textContent = error.message + ' Vous pouvez remplir le questionnaire ; nous contrôlerons votre reçu avant toute production.'; }
  history.replaceState(null, '', location.pathname);
} else {
  try { reference(localStorage); } catch { /* stockage indisponible */ }
  status.textContent = 'Cette page ne constitue pas une confirmation de paiement. Retrouvez votre reçu Stripe ; nous le contrôlerons avant toute production.';
}
if (!link.href.startsWith('mailto:')) link.href = 'questionnaire.html';
