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

## Ce que la dalle ne dit pas, et que rien ne signale

Trois défauts n'apparaissent qu'à l'exécution sur un vrai téléviseur, et aucun
n'est visible au navigateur ni au build. Ils sont corrigés, mais le motif se
répétera : **tout ce qui est écrit en style EN LIGNE échappe aux passes PostCSS
comme à la garde de compatibilité.**

- `IntersectionObserverEntry.isIntersecting` n'existe pas avant Chrome 58,
  quand l'observateur, lui, est là depuis Chrome 51. Toutes les gardes du dépôt
  testent le constructeur, qui répond oui. `amorce/polyfillObservateurs.ts` pose
  l'accesseur manquant sur le prototype — un geste qui répare les sept
  appelants, sans toucher `apps/web`.
- `LibraryGrid` pose ses colonnes en style en ligne. Le hook de mesure est
  substitué (`ui/grille/colonnesTv.ts`) et publie la largeur de carte en
  variable ; `styles/grille-tv.css` fait le reste.
- Les titres de bannière et de bibliothèque fixent leur taille en `clamp()`, en
  ligne. Le repli est dans `styles/tv.css`, sans `!important` : là où `clamp()`
  est compris, la déclaration en ligne l'emporte d'elle-même.

Une divergence de contrat est du même ordre : `tsc` ne connaît pas les
substitutions. Un remplaçant qui recopie les propriétés de son original à la
main est libre de diverger en silence — c'est arrivé à la jauge de bannière.
Importer le type de l'original (`import type`, effacé à la compilation, résolu
par `tsc`) ferme cette porte. `ui/heros/JaugeBanniereTv.tsx` et
`lecture/ControlesTv.tsx` le font.

## Le lecteur

`lecture/ControlesTv.tsx` remplace la barre de contrôle du web, et
`lecture/masquageAutoTv.ts` son auto-masquage — c'est la seule prise sur
l'enveloppe qui rend les commandes invisibles. Le reste du lecteur est celui
d'`apps/web` : le déplacement passe toujours par `useSmartSeek`, seul chemin
qui sache suivre un transcodage HLS.

**À qui appartient une touche se déduit de l'état, jamais de l'ordre des
écouteurs.** `stopPropagation` n'empêche pas les autres écouteurs du même nœud
de tirer dans la même phase : trois cohabitent, et c'est le mode du lecteur
(`lecture/etatLecteurTv.ts`) qui tranche. Commandes déployées, les flèches sont
au moteur de focus, qui parcourt des boutons comme partout ailleurs. Sinon
elles entrent dans le déplacement du flux.

Le curseur fantôme est le modèle d'`apps/tv`, transposé : la position avance
seule, la vidéo reste en pause, **aucun déplacement n'est appliqué avant
confirmation**. OK confirme, Retour annule, sept secondes d'inactivité annulent
aussi. `lecture/machineScrub.test.ts` vérifie ce qui ne se voit pas.

## Saisie de texte

Rien n'est codé pour le clavier virtuel, et rien ne doit l'être : webOS
l'affiche de lui-même dès qu'un `<input>` reçoit le focus, et le referme à la
validation. Les champs du client web fonctionnent donc tels quels.

Le moteur de focus laisse gauche et droite au curseur de saisie tant qu'un
champ est actif, et garde haut et bas — c'est par eux qu'on en sort. Sans
cette distinction, entrer dans un formulaire à la télécommande serait un aller
sans retour.

## Ce qui est atteignable, et pourquoi

Sur l'accueil, le D-pad ne rencontre que trois familles de cibles : les entrées
du rail, les deux appels à l'action de la bannière avec ses trois actions
rapides, et les cartes. Rien d'autre.

Ce qui a été retiré du parcours l'a été pour une raison précise, pas par
principe. Les pastilles d'indicateur de la bannière étaient cinq boutons de
quatre pixels de haut posés entre elle et la première rangée : il fallait les
traverser une par une pour descendre, et les viser n'apportait rien qu'un appui
sur gauche ou droite ne fasse déjà. Les actions rapides d'une carte
demanderaient un niveau de navigation à l'intérieur de la carte, ce qui rendrait
chaque déplacement horizontal ambigu — elles restent sur la fiche. Et la
`<section>` de rangée, focusable sur le web pour y capter les flèches, était un
rectangle pleine largeur qui remportait systématiquement le score « vers le
bas » : un trou noir sans anneau pour le signaler.

Le rail montre **tout** par défaut — recherche, accueil, listes, toutes les
bibliothèques, réglages — et l'on retire ce dont on ne veut pas, par un maintien
de OK. C'est l'inverse de `usePinnedNav`, dont le défaut vide convient à une
barre horizontale où la place manque, et qui laissait un téléviseur neuf devant
trois entrées. La liste d'exclusion vit dans `ui/nav/epinglageTv.ts` ; « Tout
afficher » n'apparaît qu'une fois quelque chose masqué, pour que le geste ne
soit pas une porte à sens unique.

La recherche est une **surcouche**, pas une route : `App.tsx` n'est pas
modifié, et le client web ne fait pas autrement — la sienne est un portail
ouvert par un raccourci. La touche Retour la referme avant de reculer d'un
écran, par la pile de consommateurs de `focus/retour.ts`.

Trois règles gouvernent les déplacements. Un mouvement horizontal reste dans sa
rangée tant qu'il y a une carte à atteindre, et cède au bout de la piste pour
qu'on puisse rejoindre la navigation. Le rail ne s'atteint que par la gauche —
il couvre toute la hauteur, et sans cela « bas » y remonterait au lieu de
descendre d'une rangée. Et il est écarté du focus initial : arriver sur un écran
avec le focus dans la navigation oblige à le déplacer avant même de regarder.
