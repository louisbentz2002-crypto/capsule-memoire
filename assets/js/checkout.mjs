import { reference, readStored } from './core.mjs';
let storage; try { storage = localStorage; } catch { /* stockage bloqué */ }
let id = reference(storage);
if (readStored(storage, 'cm-complete', 30 * 86400000)?.reference === id) {
  try { storage.removeItem('cm-reference'); } catch { /* stockage bloqué */ }
  id = reference(storage);
}
const buttons = [...document.querySelectorAll('stripe-buy-button')];
buttons.forEach(button => button.setAttribute('client-reference-id', id));
// Le composant Stripe lit ses attributs lors de son initialisation.
// Charger son script seulement après avoir installé la référence sur tous les boutons.
if (buttons.length) {
  const script = document.createElement('script');
  script.src = 'https://js.stripe.com/v3/buy-button.js';
  script.async = true;
  script.addEventListener('error', () => {
    const status = document.getElementById('checkoutStatus');
    if (status) status.textContent = 'Le paiement ne peut pas se charger. Réessayez ou contactez-nous par email.';
  });
  document.head.append(script);
}
