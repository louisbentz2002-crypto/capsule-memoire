# Capsule Mémoire

Site statique et fonctions Vercel pour les demandes de guide, les questionnaires et la vérification des paiements Stripe. Les médias et les identifiants publics des boutons Stripe existants sont conservés.

## Vérification locale

Node 22 ou supérieur :

```sh
npm ci --ignore-scripts
npm test
npm run check
```

Les tests utilisent des données fictives, un DOM simulé et des réponses réseau simulées. Ils n’envoient pas de demande réelle à Make, Stripe ou Formspree. Le contrôle des liens attend les médias du dépôt complet. Un navigateur réel reste nécessaire pour valider l’apparence mobile et le comportement de lecture sur les appareils ciblés.

## Configuration indispensable avant mise en ligne

Dans les variables serveur Vercel, jamais dans les fichiers HTML :

| Variable | Usage |
|---|---|
| `GUIDE_WEBHOOK_URL` | Webhook du scénario Make qui envoie le PDF du guide. Sans cette variable, le formulaire affiche un échec explicite. L’ancien webhook exposé dans le dépôt doit être remplacé ou régénéré dans Make. |
| `STRIPE_SECRET_KEY` | Clé serveur permettant de lire les Checkout Sessions du compte Stripe. Sans elle, la page reste neutre et le dossier porte la mention « à vérifier manuellement ». Utiliser le mode test en préproduction. |
| `FORMSPREE_URL` | Facultative : endpoint de réception. Par défaut, celui déjà utilisé par le site. Vérifier l’acceptation des requêtes serveur et les limites du forfait. |

Dans **chaque Payment Link Stripe**, régler « After payment » sur :

```text
https://www.capsulememoire.fr/confirmation.html?session_id={CHECKOUT_SESSION_ID}
```

Le composant Stripe utilise `client-reference-id` pour le rapprochement. L’ancien attribut `success-url` est supprimé : la redirection se configure dans Stripe. Activer la collecte de l’acceptation des CGV dans Stripe et y associer l’URL `/cgv.html`. Vérifier également prix, fiscalité, reçu et compte de destination. Les options demandées dans le questionnaire ne sont **pas** prélevées par le bouton de la formule de base : confirmation écrite et paiement séparé avant production.

Héritage, Pack Duo et plaque additionnelle sont demandés sur devis. Ne pas lancer leur encaissement avant vérification du fournisseur, du coût complet et du délai. Une transaction qui ne correspond pas exactement aux formules Photo ou Souvenir standard est orientée vers un contrôle manuel ; le tarif d’essai existant n’est pas inventé ni modifié.

## Recette après configuration

1. Utiliser une préproduction Vercel et une transaction Stripe **test**. Vérifier le retour, la référence du dossier et le questionnaire.
2. Tester un paiement en attente, un lien sans session, un email invalide et un refus Make/Formspree : aucune fausse confirmation.
3. Envoyer un dossier fictif Photo sans voix, Photo avec option vocale, Souvenir avec texte vocal et une demande Héritage. Vérifier réception, total, consentements et statut du paiement dans Formspree.
4. Vérifier le PDF effectivement reçu via Make. Un HTTP 200 du scénario confirme sa réception, pas la remise du mail au destinataire.
5. Reprendre un brouillon, vérifier son expiration et son effacement ; tester au clavier et sur mobile les comparateurs et lecteurs.

Le serveur revalide les champs obligatoires, recalcule les montants, contrôle l’origine des requêtes navigateur, limite la taille du JSON et ignore les statuts de paiement fournis par le client. Ces contrôles ne remplacent pas une protection contre le spam au niveau Vercel/Formspree.

## Traitement des dossiers

Voir [docs/exploitation.md](docs/exploitation.md). Le dépôt ne contient ni espace client de stockage ni base de données de production. Formspree sert de boîte de réception et le suivi reste humain. Les accès privés, sauvegardes, factures, autorisations, suppressions et paiements des options doivent être réalisés dans les outils de production. Les essais réseau de bout en bout, les réglages de comptes et l’adhésion au médiateur ne peuvent pas être prouvés par le seul code.

## Références

- [Stripe : Buy Button](https://docs.stripe.com/payment-links/buy-button)
- [Stripe : après paiement](https://docs.stripe.com/payment-links/post-payment)
- [Vercel : fonctions Node.js](https://vercel.com/docs/functions/runtimes/node-js)
- [Code de la consommation, L.221-25](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179) et [L.221-28](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563170)
