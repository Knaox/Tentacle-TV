# Tentacle TV — client LG webOS

Neuvième cible du dépôt. Elle ne contient **aucun composant d'interface** : le
client est celui de `apps/web`, recompilé pour le moteur d'un téléviseur.

## Deux morceaux qui ne voyagent pas ensemble

**La coquille** (`shell/`) est le paquet IPK installé sur le téléviseur. Une
page en JavaScript ES5, sans build. Elle affiche un code de jumelage à quatre
caractères obtenu du relais Cloudflare, attend qu'un appareil déjà connecté le
valide, puis navigue vers le serveur dont le relais lui a rendu l'adresse.

**Il n'y a rien à saisir sur le téléviseur.** C'est tout l'intérêt du relais :
il rend l'adresse du serveur en même temps que le jeton. C'est aussi pourquoi
l'écran de jumelage vit dans la coquille et non dans le client — celui-ci est
servi par le serveur qu'il s'agit précisément de trouver.

Le jeton est transmis au client par le **fragment** d'URL, jamais par la chaîne
de requête : c'est un JWT sans expiration, donc un secret de longue durée, et
un fragment n'atteint ni les journaux d'accès ni les en-têtes `Referer`.

**Le client** (`client/`) est une variante de build de `apps/web`. Il n'est
**pas** dans le paquet : le serveur Tentacle le sert sur `/tv`.

C'est le modèle du client webOS de Jellyfin, à une différence près : Jellyfin
charge un serveur tiers dans une `<iframe>`, nous naviguons en top-level vers
notre propre serveur. Le cookie de session du backend étant `sameSite: "strict"`
et helmet posant `X-Frame-Options: SAMEORIGIN`, un cadre dont le document racine
est `file://` ne pourrait de toute façon pas s'authentifier.

**Conséquence pratique : mettre à jour le serveur met à jour le téléviseur.** Un
IPK n'est à re-soumettre au Content Store que pour l'icône, le titre, le splash,
l'identifiant, ou le comportement de la coquille.

## Socle

Chrome 53 — webOS 4.0, téléviseurs 2018 et plus. Ce n'est pas la cible par
défaut de Vite, et rien dans `apps/web` n'a été écrit pour elle : l'écart est
comblé mécaniquement, par `@vitejs/plugin-legacy` côté JavaScript et par le
plugin PostCSS de `config/postcss/` côté CSS. Aucun composant partagé n'est
forké, et `config/postcss/gardeCompat.ts` fait échouer le build si une primitive
trop récente réapparaît dans la feuille finale.

## Commandes

```bash
pnpm --filter @tentacle-tv/tv-webos build       # la variante servie par le serveur
pnpm --filter @tentacle-tv/tv-webos ipk         # le paquet de la coquille
pnpm --filter @tentacle-tv/tv-webos emu:install # ares-install sur l'émulateur
pnpm --filter @tentacle-tv/tv-webos emu:launch
```

La version du paquet vient de `versions.json` (champ `webos`) ; `scripts/ipk.mjs`
la reporte dans `appinfo.json` pour que les deux ne puissent pas diverger.

## La sonde

`/tv/sonde.html` est servie par le backend **avant même le premier build** — le
serveur bascule sur `client/public` tant que `client/dist` n'existe pas. Elle
relève ce que le moteur du téléviseur sait réellement faire : API JavaScript
présentes, primitives CSS acceptées, codecs déclarés par `canPlayType` et par
`MediaSource`, capacités remontées par `deviceInfo`, et les `keyCode` de la
télécommande.

C'est le premier endroit où regarder quand un modèle se comporte autrement que
les autres.

## webOSTV.js

La bibliothèque du SDK LG n'est pas versionnée ici. Déposez-la dans
`shell/js/webOSTV.js` pour activer l'API officielle. En son absence, la coquille
lit directement `window.PalmSystem`, que le gestionnaire d'applications injecte
de toute façon — `deviceInfo` et `platformBack` fonctionnent dans les deux cas.

## Ce qui ne va pas sur un téléviseur

Sont exclus du bundle, pas masqués : l'administration, Watch Together, les
téléchargements et le mode hors-ligne, le partage, les tickets, et le système
de plugins. Les routes correspondantes existent toujours — `App.tsx` n'est pas
touché — mais mènent à un écran d'explication, et le code des écrans concernés
n'est jamais compilé. Vérifiable dans `client/dist/assets` : aucun fragment
`Admin*`, `Downloads*`, `Offline*`, `Shared*`.

## Saisie de texte

Rien n'est codé pour le clavier virtuel, et rien ne doit l'être : webOS
l'affiche de lui-même dès qu'un `<input>` reçoit le focus, et le referme à la
validation. Les champs du client web fonctionnent donc tels quels.

Le moteur de focus laisse gauche et droite au curseur de saisie tant qu'un
champ est actif, et garde haut et bas — c'est par eux qu'on en sort. Sans
cette distinction, entrer dans un formulaire à la télécommande serait un aller
sans retour.
