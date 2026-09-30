import { reference, readStored } from './core.mjs';
let storage; try { storage = localStorage; } catch { /* stockage bloqué */ }
let id = reference(storage);
if (readStored(storage, 'cm-complete', 30 * 86400000)?.reference === id) {
  try { storage.removeItem('cm-reference'); } catch { /* stockage bloqué */ }
  id = reference(storage);
}
document.querySelectorAll('stripe-buy-button').forEach(button => button.setAttribute('client-reference-id', id));
