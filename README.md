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

Le composant Stripe reçoit `client-reference-id` avant le chargement du script Stripe. Ce repère navigateur sert au rapprochement des brouillons ; le serveur attribue ensuite une référence stable propre à chaque Checkout Session. Un dossier automatiquement rapproché doit employer l’email du reçu Stripe. L’API publique de confirmation ne révèle pas cet email. En production Vercel, les paiements test sont refusés. L’ancien attribut `success-url` est supprimé : la redirection se configure dans Stripe. Activer la collecte de l’acceptation des CGV dans Stripe et y associer l’URL `/cgv.html`. Vérifier également prix, fiscalité, reçu et compte de destination. Les options demandées dans le questionnaire ne sont **pas** prélevées par le bouton de la formule de base : confirmation écrite et paiement séparé avant production.

Héritage, Pack Duo et plaque additionnelle sont demandés sur devis. Ne pas lancer leur encaissement avant vérification du fournisseur, du coût complet et du délai. Une transaction qui ne correspond pas exactement aux formules Photo ou Souvenir standard est orientée vers un contrôle manuel ; le tarif d’essai existant n’est pas inventé ni modifié.

## Recette après configuration

1. Utiliser une préproduction Vercel et une transaction Stripe **test**. Vérifier le retour, la référence du dossier et le questionnaire.
2. Tester un paiement en attente, un lien sans session, un email invalide et un refus Make/Formspree : aucune fausse confirmation.
3. Envoyer un dossier fictif Photo sans voix, Photo avec option vocale, Souvenir avec texte vocal et une demande Héritage. Vérifier réception, total, consentements et statut du paiement dans Formspree.
4. Vérifier le PDF effectivement reçu via Make. Un HTTP 200 du scénario confirme sa réception, pas la remise du mail au destinataire.
5. Reprendre un brouillon, vérifier son expiration et son effacement ; tester au clavier et sur mobile les comparateurs et lecteurs.

Le serveur revalide les champs obligatoires, les choix autorisés et les dates, recalcule les montants, contrôle l’origine des requêtes navigateur, arrête la lecture du JSON à 64 Kio et ignore les statuts de paiement fournis par le client. Les transferts serveur exigent HTTPS et refusent les redirections. Le contact passe également par une route serveur avec validation, limite de taille et piège à robots. Ces contrôles ne remplacent pas une protection contre le spam au niveau Vercel/Formspree.

## Sécurité et performances du site public

`vercel.json` impose une Content Security Policy qui refuse les scripts inline et les gestionnaires HTML, les objets intégrés et l’affichage du site dans une frame. Les scripts autorisés proviennent du site et de Stripe ; les fontes Google restent autorisées. Les styles inline existants sont conservés pour maintenir le design, donc `style-src` autorise encore `unsafe-inline`. Les données structurées JSON-LD ont une empreinte autorisée ; `npm run check` détecte une empreinte manquante après modification. Ne pas ajouter `unsafe-inline` ou `unsafe-eval` aux scripts pour contourner un échec.

Les médias restent différés. Avec mouvement réduit ou économie de données, les vidéos attendent un clic explicite. Le curseur conserve son apparence et son animation d’origine sur les appareils avec souris. Les fichiers sous `/assets/` sont mis en cache une heure avec revalidation, sans cache immuable sur des noms réutilisés. Les contrastes et le clavier ont été améliorés sans changer l’identité visuelle. Le menu enferme le focus et désactive le fond pendant son ouverture.

Après déploiement, vérifier les en-têtes HTTP réellement reçus, les trois boutons Stripe, les lecteurs, les formulaires et l’absence d’erreurs CSP sur ordinateur et téléphone. La configuration du dépôt seule ne prouve pas que Vercel a appliqué ces en-têtes. Les tests DOM n’évaluent pas le rendu ni les Core Web Vitals d’un navigateur réel.

La section animée de restauration sous le hero utilise `assets/css/restauration-motion.css` et `assets/js/restauration-motion.js`, sans script inline. Elle propose une pause, attend les images et suspend la lecture hors écran ou lorsque l’onglet est masqué. Avec mouvement réduit ou économie de données, elle affiche une photo restaurée fixe ; les photos restent visibles sans JavaScript. Le bouton mène à l’offre découverte existante. Attention au nom des fichiers hérités : pour les exemples 04, 08, 07 et 01, `apres.webp` contient la photo originale et `avant.webp` la photo restaurée, vérifiées visuellement. Ne pas inverser leur rôle sur la seule base du nom.

Dans Vercel, activer une protection WAF et une limite de débit adaptées aux routes `/api/contact`, `/api/guide`, `/api/dossier` et `/api/commande`, puis tester une demande légitime. Le dépôt ne possède pas de limite de débit distribuée ni de registre durable des paiements consommés. Jusqu’à cette évolution, regrouper les envois par référence et vérifier dans Stripe la prestation, le client et l’unicité du paiement avant production. Le simple rapprochement d’un montant avec une formule ne vérifie pas le produit Stripe : ce contrôle reste humain.

## Traitement des dossiers

Voir [docs/exploitation.md](docs/exploitation.md). Le dépôt ne contient ni espace client de stockage ni base de données de production. Formspree sert de boîte de réception et le suivi reste humain. Les accès privés, sauvegardes, factures, autorisations, suppressions et paiements des options doivent être réalisés dans les outils de production. Les essais réseau de bout en bout, les réglages de comptes et l’adhésion au médiateur ne peuvent pas être prouvés par le seul code.

## Références

- [Stripe : Buy Button](https://docs.stripe.com/payment-links/buy-button)
- [Stripe : après paiement](https://docs.stripe.com/payment-links/post-payment)
- [Vercel : fonctions Node.js](https://vercel.com/docs/functions/runtimes/node-js)
- [Code de la consommation, L.221-25](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563179) et [L.221-28](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563170)
