# Extension Chrome — Kadlio Ajout rapide

Ajoute le produit de la page ouverte à une liste Kadlio, en lisant la page
dans le navigateur — là où les boutiques qui refusent les lectures serveur
(403, captcha) se laissent lire normalement.

## Charger en développement

1. `chrome://extensions` → activer le « Mode développeur ».
2. « Charger l'extension non empaquetée » → choisir ce dossier `extension/`.
3. Être connecté à Kadlio dans le même navigateur ; ouvrir une page produit,
   cliquer l'icône.

Pour viser un serveur local, remplacer `BASE` dans `popup.js` et ajouter
`http://localhost:3000/*` aux `host_permissions` du manifest — ne pas
committer ces deux changements.

## Publier

Compte développeur Chrome Web Store (5 $ une fois), puis zipper le dossier et
le soumettre. La fiche exige une politique de confidentialité : celle du site
convient (l'extension ne lit la page qu'au clic — permission `activeTab` — et
n'envoie ses données qu'à kadlio.com).

## Ce que le serveur accepte de l'extension

Le nom et le prix remplissent le CADEAU (la personne peut déjà écrire ce
qu'elle veut sur sa propre liste). Le CATALOGUE partagé, lui, ne provient que
de la lecture faite par le serveur ; l'image est retéléchargée côté serveur
sous la garde SSRF habituelle. Voir `src/app/api/extension/`.
