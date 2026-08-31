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

## Servi en production, et à qui

Les deux chemins de production construisent la variante et la servent : le
`Dockerfile` la bâtit puis copie `client/dist` dans l'image, et le hook
`deploy/post-receive` la bâtit dans le répertoire source d'où tourne déjà le
backend. Nginx ne fait plus tomber `/tv` dans son repli monopage — il proxifie
vers le backend, qui est le seul à décider.

**En production, `/tv` n'est servi qu'à un téléviseur.** Le signal est
l'en-tête `User-Agent` : `Web0S` — avec un zéro, pas la lettre O. Dit
franchement, un filtre d'agent n'est pas un contrôle d'accès, c'est une adresse
qu'on ne donne pas. Rien de sensible n'en dépend, le client exigeant de toute
façon un jeton d'appareil ou un cookie de session. Ce qu'il évite est qu'un
ordinateur tombé sur l'adresse reçoive une interface dessinée pour une dalle.

Hors production le filtre est ouvert sans condition, et `TENTACLE_TV_OUVERT=1`
rend le même service sur un serveur — la variable est lue à chaque requête, pas
au démarrage. Tout tient dans `apps/backend/src/static/tvUserAgent.ts`.

## Socle

Chrome 53 — webOS 4.0, téléviseurs 2018 et plus. Ce n'est pas la cible par
défaut de Vite, et rien dans `apps/web` n'a été écrit pour elle : l'écart est
comblé mécaniquement, par `@vitejs/plugin-legacy` côté JavaScript et par le
plugin PostCSS de `config/postcss/` côté CSS. Aucun composant partagé n'est
forké, et `config/postcss/compatGuard.ts` fait échouer le build si une primitive
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

## Les images de la coquille

`pnpm --filter @tentacle-tv/tv-webos icons` les régénère **toutes** depuis le
seul `shell/images/tentacle-logo-pirate.svg` — lui-même une copie de
`brand/logo-color.svg`. Les PNG sont versionnés ; le script ne sert qu'à les
refaire, et demande librsvg et ImageMagick.

⚠️ `brand/generate-icons.py`, qui produit les icônes de toutes les autres
plateformes, laisse **volontairement** celles-ci de côté : un rendu vectoriel
direct ne satisfait aucune des trois contraintes ci-dessous. Et `SUBJECT`, le
recadrage sur le dessin, est exprimé dans le repère du logo : il se REMESURE si
le dessin change d'encombrement (`rsvg-convert` en grand, puis `magick -trim`).

Trois choses ne se devinent pas, et sont la raison d'être du script :

**L'icône est posée au centre d'une tuile dont le fond est `iconColor`.** Un
dessin sur fond transparent laisse voir cette couleur ; un dessin sur fond
opaque pose un carré par-dessus. On prend le fond opaque — c'est le seul cas qui
reste correct si `iconColor` n'est pas honoré — et le dégradé est construit pour
valoir **exactement** `iconColor` sur ses quatre bords : rayon égal à la
demi-largeur, donc les milieux de bord tombent sur la dernière butée et les
coins sont au-delà. La jointure avec la tuile ne se voit pas. Changer l'un sans
l'autre fait réapparaître un liseré.

**Les deux icônes sont redimensionnées par le téléviseur, dans un sens ou dans
l'autre selon le millésime** : webOS TV 1.0 affiche la petite en 100×100, webOS
TV 2.0 affiche la grande en 115×115. On rend donc un maître de 5200 — multiple
entier de 130 (×40), de 80 (×65) et du 400 du Seller Lounge (×13) — puis on
réduit en Lanczos. Aucune des réductions ne tombe entre deux pixels, et les
détails fins du crâne survivent, ce qu'un rendu vectoriel direct à 80 pixels ne
garantit pas.

**Le splash ne doit pas être un écran noir** — la référence LG le dit en toutes
lettres. Le précédent était une vignette perdue au milieu de 1920×1080 de noir.

Le 400×400 sort dans `store-assets/` et non dans `shell/` : LG le réclame au
Seller Lounge, l'y substitue au `largeIcon` après redimensionnement, et il se
téléverse à part — il n'a rien à faire dans l'IPK.

## L'installateur, pour qui n'a pas cloné le dépôt

`installateur/` s'adresse à quelqu'un qui possède un téléviseur LG et rien
d'autre : ni ce dépôt, ni le SDK de LG, ni la moindre ligne de commande. Il pose
deux questions — l'adresse du téléviseur et la phrase secrète que l'application
« Developer Mode » affiche —, puis enregistre l'appareil, récupère sa clé SSH,
rapatrie l'IPK depuis la release `webos-latest` et l'installe.

Trois choses le contraignent, et expliquent sa forme :

**Il voyage hors du dépôt.** Le workflow l'empaquette dans
`installateur-tentacle-tv.zip`, attaché à la même release que l'IPK. Il ne peut
donc rien supposer de son voisinage : aucun `node_modules`, aucun fichier du
dépôt, aucun `pnpm`. Il retrouve la CLI de LG si elle est là, l'installe dans
`~/.tentacle-tv/webos-cli` sinon.

**Le seul prérequis tolérable est Node.js.** Il l'est déjà de fait — la CLI de
LG est un paquet npm — et tout le reste s'installe sans droits particuliers.

**Un double-clic doit suffire — sauf sur macOS, où il ne peut pas.** D'où trois
lanceurs pour une seule logique : `installer.sh` la porte,
`Installer-Tentacle-TV.command` la délègue sous l'extension que le Finder sait
ouvrir, `Installer-Tentacle-TV.cmd` fait de même sous Windows en basculant
d'abord la console en UTF-8. Les deux premiers doivent garder leur bit
d'exécution — le workflow le vérifie avant d'archiver, faute de quoi le
double-clic ne ferait rien du tout.

Sur macOS, le Finder refuse d'ouvrir tout fichier sorti d'une archive
téléchargée qui n'est pas signé par un développeur payant le programme Apple :
« Placer dans la corbeille » ou « Annuler », sans troisième choix. Le clic droit
› Ouvrir ne contourne plus rien depuis macOS 15, et aucune signature n'est
possible ici — un `.command` n'est pas un bundle, il n'y a rien à notariser.

Ce refus ne vise QUE le Finder : mesuré en posant `com.apple.quarantine` à la
main sur les fichiers extraits, `bash installer.sh`, `node installer.mjs` et
même `./Installer-Tentacle-TV.command` démarrent tous les trois sans un mot.
C'est bash qui s'exécute, et bash est signé par Apple. La voie annoncée aux
utilisateurs macOS est donc le terminal, et le `.command` n'est plus qu'un
confort pour qui a débloqué le fichier dans les réglages.

La phrase secrète est passée à `ares-novacom --getkey` par `--passphrase` plutôt
que retapée au clavier, et mise en capitales au passage : LG l'affiche ainsi, la
clé est déchiffrée telle quelle, et une saisie en minuscules ne produirait qu'un
« Unable to parse private key » que personne ne saurait interpréter.

**Le port 9991 n'est ouvert que par le bouton « Key Server »** de l'application
Developer Mode — pas par `Dev Mode Status`, qui ne fait qu'autoriser le mode. Un
téléviseur en mode développeur, allumé, à la bonne adresse, reste donc muet tant
que ce second bouton n'a pas été pressé, et c'est aussi lui qui fait apparaître
la phrase secrète. C'est la panne la plus fréquente : le script sonde ce port
avant toute chose et met cette cause en tête de son message d'échec.

## La sonde

`/tv/sonde.html` est servie par le backend **avant même le premier build** — le
serveur bascule sur `client/public` tant que `client/dist` n'existe pas. Elle
relève ce que le moteur du téléviseur sait réellement faire : API JavaScript
présentes, primitives CSS acceptées, codecs déclarés par `canPlayType` et par
`MediaSource`, capacités remontées par `deviceInfo`, et les `keyCode` de la
télécommande.

C'est le premier endroit où regarder quand un modèle se comporte autrement que
les autres.

Deux pages voisines, `/tv/harness-nav.html` et `/tv/harness-detail.html`,
chargent le **vrai moteur de focus** sur des géométries factices mais
discriminantes — grille virtualisée au scale de la dalle, rail, fiche dont
chaque alignement donnerait tort à la géométrie brute. Elles se pilotent au
clavier ou par `__press()`/`__where()` depuis une console, et
`harness-shims.js` compense les infirmités d'un navigateur qui pilote sans
afficher — `requestAnimationFrame` suspendus, événements de focus jamais émis.
C'est là que se rejouent les scénarios de navigation avant de toucher une
dalle.

Elles vivent dans `harness/`, **hors du dossier public**, et sont servies par
`config/serveHarness.ts` — un greffon `apply: "serve"`, donc absent de la
construction. Un banc d'essai n'a rien à faire sur le téléviseur de quelqu'un,
et la garantie tient dans le cycle de vie du greffon, pas dans une règle de
nettoyage qu'il faudrait penser à maintenir.

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

## Les réglages

Trois sections : **Compte**, **Lecture**, **À propos**. Les adresses sont
recyclées plutôt qu'ajoutées — `App.tsx` est partagé et ne bouge pas,
l'identifiant d'une section n'est affiché nulle part sur une dalle, et
`pages/lazyPagesTv.tsx` est le seul endroit à connaître la correspondance
(`data` → Compte, `playback` → Lecture, `appearance` → À propos, `security` →
redirection).

**Apparence est partie parce qu'elle n'avait plus rien à régler.** Un
téléviseur n'a pas de réglage système clair/sombre à suivre :
`prefers-color-scheme` n'y est pas renseigné, et le mode clair n'a aucun emploi
dans une pièce dont on a baissé la lumière. Le thème est figé au point de
passage unique — `theme/colorScheme.ts` est substitué par
`shims/themeSombre.ts`, ce qui couvre `useThemeMode`, `ThemeProvider` et
l'écran qui l'exposait. **Sécurité** demande de la saisie suivie et se fait
depuis un téléphone en une minute.

Lecture remplace `pages/Preferences.tsx` : mêmes hooks, même stockage serveur,
mêmes codes ISO 639-2/B — seule la mise en page change. Les `<select>` natifs
deviennent des boutons qui ouvrent `PanneauChoixTv`, une surcouche qui déclare
`role="dialog"` : c'est ce rôle, et lui seul, qui fait confiner le déplacement
par `focus/candidats.ts`.

## Un piège de mise en page, propre à cette cible

La passe des écarts remplace `gap` par des marges : un demi-écart sur chaque
enfant, et une marge NÉGATIVE du même demi-écart sur le conteneur. Deux
conteneurs à écart imbriqués entrent alors en conflit — l'enfant est à la fois
« élément à espacer » et « conteneur qui se rétracte », les deux règles ont la
même spécificité, et la marge négative gagne. L'espacement extérieur disparaît.

La discipline qui en découle : les blocs sont espacés par des marges posées sur
des éléments NEUTRES, et `gap` ne sert qu'à l'intérieur d'eux. Un élément ne
cumule jamais les deux rôles.

Un cas voisin se paie en mise en page de grille : `LibraryGrid` pose son `gap`
en style EN LIGNE, invisible aux passes. Sur Chrome 53 il ne fait rien et la
marge de `grille-tv.css` est le seul écart ; sur un navigateur récent les deux
s'ajoutent. `ui/grille/colonnesTv.ts` MESURE donc le moteur — un conteneur flex
hors écran, deux enfants, un `gap` — plutôt que d'interroger `CSS.supports`,
qui reconnaît la propriété dès Chrome 66 pour les grilles, dix-huit versions
avant que la flexbox n'en fasse quoi que ce soit.

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

## Le disque du serveur, à regarder AVANT tout le reste

Le 11 août 2026, une campagne de mesure entière a conclu à un défaut de
segmentation alors que la cause première était ailleurs : **le disque du serveur
Jellyfin était plein**. 121 Go de transcodes orphelins dans
`config/cache/transcodes`, et dans son journal :

```
No space left on device : '/config/log/FFmpeg.Remux-….log'
Error processing request: "No space left on device" URL "GET" "/videos/…/hls1/main/11.mp4"
```

ffmpeg ne pouvait plus écrire un seul segment. D'où les lectures qui se figeaient,
les milliers de requêtes en boucle sur les mêmes segments, les 500 et les 416 —
tout ce qu'on avait pris pour une incohérence de playlist. Après nettoyage, le
même film passe de 36 s lues en 95 s à **61,6 s lues en 70 s**.

**Deux causes se cumulaient**, et l'ordre compte :

1. **Le disque plein** — cause première, et elle rend tout le reste illisible. La
   première chose à vérifier avant d'ouvrir une enquête sur la lecture :
   `du -xh --max-depth=1 <config>/cache` et `df -h`.
2. **Le décalage d'index** — réel, celui-là, mesuré serveur sain (ci-dessous). Il
   ne produit qu'un hoquet, une relance de la veille toutes les ~70 s.

**Pourquoi le disque se remplissait, et ce qui a été corrigé côté client** : un
remux tourne à cent fois le temps réel ou plus. Personne ne l'arrête à la
position du lecteur — il court jusqu'à la fin du fichier. Or `WatchWeb` ne tuait
l'encodage que sur un saut : changer de piste, de qualité ou d'incrustation en
laissait un par clic. C'est corrigé (`libererEncodage`, partagé par le web, la
TV, Tauri et Electron).

**Le journal serveur du 11 août montre le mécanisme à l'œuvre** — chaque ligne
est un travail lancé à ~51 min du film qui sort en `code 0`, c'est-à-dire ayant
écrit les 88 minutes restantes :

| lancé | fini | durée | ce qui a été écrit |
|---|---|---|---|
| 14:20:30 | 14:21:11 | 41 s | de 51:45 à la fin |
| 14:21:20 | 14:22:30 | 70 s | de 51:30 à la fin |
| 14:41:24 | 14:42:43 | 79 s | **le film entier** (`-f mp4`, un seul fichier) |
| 14:44:22 | 14:44:57 | 35 s | de 51:51 à la fin |

À 14:53:20, `No space left on device`. Le disque avait été vidé le matin même.

**Correction de ce qui était écrit ici avant : la limitation de débit s'applique
bel et bien à ces travaux.** L'argument de jellyfin#16608 — le minuteur du
`TranscodingThrottler` ne se déclenche qu'après 5 s, les remux rapides finissent
avant — ne tient pas pour un fichier de cette taille : ces travaux durent 35 à
80 secondes, ils traversent ce contrôle une dizaine de fois. **Qu'ils atteignent
la fin du fichier est la preuve que `EnableThrottling` est désactivé sur ce
serveur.** Activé, ffmpeg serait suspendu à `ThrottleDelaySeconds` d'avance (180 s
par défaut) au lieu de courir à l'octet final : quelques centaines de mégaoctets
par session abandonnée, au lieu de dizaines de gigaoctets.

Le cas de #16608 reste réel pour les épisodes courts remuxés en quelques
secondes. Il ne dispense pas d'activer le réglage.

**Et le cache partage son système de fichiers avec les journaux et la base.** Le
même incident donne `No space left on device` sur `/config/log/FFmpeg.Remux-….log`,
`SQLite Error 13: database or disk is full`, et des 500 sur
`POST /Sessions/Playing/Progress`. Un cache de transcodage qui déborde n'abîme
pas une lecture : il met le serveur à genoux, journaux compris — donc sans trace
pour comprendre. Un volume dédié à taille plafonnée transforme la panne totale en
une lecture qui échoue.

## Pourquoi une lecture remuxée hoquette, et ce qui n'y est pour rien

Mesuré sur la C3 le 11 août 2026 (MKV, HEVC DOVIWithHDR10, remuxé en fMP4 HLS
parce que webOS ne démultiplexe le RPU qu'en ISOBMFF). L'outil est
`scripts/playbackCapture.mjs`, côté dalle, et `TENTACLE_JOURNAL_FLUX=1` côté proxy.

**La playlist ment sur les durées.** Relevé **serveur sain**, disque libéré, sur
« Baby Driver » — les segments alignés et le premier décalé se suivent :

| segment | annoncé | contenu réel (ffprobe) | écart | durée annoncée / réelle |
|---|---|---|---|---|
| 79 | 540,54 | 540,540 | 0,000 | 10,010 / 10,010 |
| 80 | 550,55 | 550,549 | −0,001 | 4,463 / 4,464 |
| 81 | 555,01 | 555,012 | −0,001 | **2,377 / 4,172** |
| 82 | 557,39 | 559,183 | **+1,793** | 1,794 / 6,549 |
| 83 | 559,18 | 565,731 | **+6,547** | 1,001 / 5,882 |

Le décalage naît exactement là où la playlist annonce des segments **courts** (1 à
2,4 s) que ffmpeg ne produit pas : il les fusionne en 4 à 6,5 s, et l'écart
s'accumule ensuite. Les deux playlists relevées portent cette signature — 15 %
de segments sous 3 s, un minimum à 0,042 s chez Baby Driver, soit UNE image.
Aucun encodeur ne découpe comme ça : c'est l'index du conteneur qui liste des
positions que ffmpeg n'honore pas.

Les segments s'enchaînent en revanche parfaitement **entre eux** — 41 ms, soit une
image à 23,976 — donc le flux est sain, et seul l'index est faux. La somme reste
juste (8406,40 s pour 140 min) : l'erreur est locale et se compense.

**La pile média de LG n'a aucune tolérance**, là où hls.js recale. Le client web
officiel ne contourne rien : sa configuration hls.js tient en six options, et
c'est `updateFragPTSDTS` (`level-helper.ts`) qui remplace les positions annoncées
par les PTS réellement démultiplexés — il journalise même « media timestamps and
playlist times differ ». hls.js traite les `#EXTINF` comme une estimation, la
pile de LG comme une vérité. D'où le même flux qui passe chez l'un et hoquette
chez l'autre.

Le relevé de 3883 requêtes pour 13 segments distincts en cent secondes, lui,
datait du disque plein : ffmpeg ne pouvait plus rien écrire. Serveur sain, il
n'en reste qu'une relance toutes les ~70 s.

Ce qui n'y est pour rien, et qu'il est inutile de re-suspecter : le débit,
`Range` (206 correct, `accept-ranges: bytes`), l'audio (DTS **copié**, pas
transcodé — la surcouche de diagnostic le dit), la charge du proxy, et le Dolby
Vision lui-même.

> **Le débit : bonne conclusion, mauvais raisonnement — corrigé le 11 août.**
> Il avait été écarté sur « les segments sortent en 16 ms médians ». Ce chiffre
> est le temps d'arrivée des **en-têtes** (`streamLog.ts`, champ `ms`) : il dit
> que Jellyfin avait déjà écrit le fichier, et rien du transfert. Personne ne
> mesurait le corps. Le proxy compte désormais les octets réellement écrits,
> `msCorps` et `debitMbps` — mesuré sur la dalle : **120 à 190 Mbit/s de
> médiane**, pour un flux qui demande 10 Mbit/s en médiane et 27 en pointe. Le
> débit est bien hors de cause, et on peut maintenant le prouver.
>
> Au passage, la même campagne écarte le **proxy** et la **double traversée
> Wi-Fi** (le backend de dev tourne sur un Mac en `en0`, donc chaque octet
> traverse le Wi-Fi deux fois). Elle confirme aussi que le téléviseur n'émet
> **aucun `Range`** : chaque réouverture d'un segment repart de zéro.

**Ni le téléviseur, ni notre profil.** Le même film cale aussi sur un autre
appareil, en TS avec l'audio converti en AAC. Le code de Jellyfin dit pourquoi :
`DynamicHlsPlaylistGenerator` ne tente l'extraction des images-clés que
`if (request.IsRemuxingVideo && … TryExtractKeyframes(…))`, et retombe sinon sur
`ComputeEqualLengthSegments`. Le déclencheur est donc **« vidéo copiée depuis ce
MKV »** — le conteneur de sortie et le sort de l'audio n'y changent rien.
L'extraction elle-même passe par `MatroskaKeyframeExtractor`, qui lit les
positions dans les **structures EBML du conteneur** au lieu de les chercher dans
les images ; `IsExtractionAllowedForFile` la réserve aux extensions listées dans
`AllowOnDemandMetadataBasedKeyframeExtractionForExtensions`. Retirer `mkv` de
cette liste est donc le levier le plus direct — à vérifier, car des segments de
durée fixe peuvent recréer un décalage d'une autre façon.

**Deux voies écartées, avec leur raison.** Le flux progressif
(`Videos/{id}/stream.mp4`) n'a pas de playlist pour mentir, mais il **perd le
Dolby Vision** : pas de `DOVI configuration record`, `codec_tag` `hev1` là où le
segment HLS porte `dvh1` et `dv_profile=8`. Et `BreakOnNonKeyFrames=True`
n'aligne que le premier segment d'une session — les suivants dérivent comme
avant. Le remède est côté serveur : c'est l'index de points de coupe de Jellyfin
qu'il faut corriger.

**Ce que le client fait de son côté**, faute de pouvoir corriger l'index : il ne
masque plus le défaut. La veille de gel (`lecture/relanceGel.ts`) compte
désormais ses relances sur une fenêtre glissante — son compteur retombait à zéro
à la moindre reprise, elle pouvait donc relancer indéfiniment sans jamais le
dire. Un indicateur de chargement a été essayé puis retiré : signaler l'attente
ne la raccourcit pas, et un calque de plus sur l'image n'est utile que s'il
apprend quelque chose.

## Ce que la dalle sait faire, et comment on l'apprend

`deviceInfo` ment par omission, et c'est le défaut le plus coûteux de la cible.
Relevé sur un OLED C3 de 2023, il ne rend que huit champs — `modelName`,
`panelType`, les quatre `platformVersion*`, `screenWidth`, `screenHeight`. Ni
`uhd`, ni `hdr10`, ni `dolbyVision`, ni `dolbyAtmos`, ni `oled` : aucun de ceux
que la documentation de LG décrit.

**Un champ absent n'est pas une réponse négative.** Le traiter comme un refus
faisait convertir la plage dynamique côté serveur, c'est-à-dire recompresser
une image 4K entière, sur une dalle qui lit le Dolby Vision nativement depuis
dix ans.

Trois sources répondent donc, du plus spécifique au plus général, et **chacune
ne sert que là où la précédente s'est tue** : le champ de `deviceInfo`, puis le
relevé du matériel, puis la déduction par gamme. Un `??` et non un `||`, pour
qu'un `false` déclaré reste un refus.

Le **relevé du matériel** (`lecture/configsTv.ts`) est la meilleure des trois
quand il répond, parce qu'il est déclaratif : le service Luna
`com.webos.service.config` expose les commutateurs de la carte mère, et il
répond à une application ordinaire — sans permission dans `appinfo.json`,
contrairement à `com.webos.settingsservice` qui rend « Access denied ». Le pont
est `PalmServiceBridge`, injecté par le gestionnaire d'applications et qui
survit à la navigation vers le serveur, alors même que la page change d'origine.

    tv.model.supportDolbyVisionHDR  true      tv.hw.displayType     "OLED"
    tv.config.supportDolbyTVATMOS   true      tv.hw.panelResolution "UD"
    tv.model.supportHDR             true      bSupport_8K_resolution false

**Ne jamais lire `tv.model.displayType`** : il vaut `"LCD DISPLAY"` sur une dalle
OLED. Seul `tv.hw.displayType` dit vrai. Les deux existent, se contredisent, et
rien dans leur nom ne signale lequel décrit le matériel.

Le relevé est asynchrone et facultatif — rien ne l'attend. La **déduction par
gamme** (`lecture/dalleWebos.ts`) reste donc le socle, pour les générations qui
ne connaissent aucune de ces clés et pour la course perdue d'un démarrage très
rapide. Elle tire de la GAMME et de l'ANNÉE ce que LG ne déclare pas.

Elle ne va que dans un sens, et c'est ce qui la rend sûre : elle accorde ce que
la TOTALITÉ d'une gamme possède, et n'ôte rien. Le Dolby Vision est sur toutes
les dalles OLED depuis 2016 et sur les QNED depuis leur naissance ; les
NanoCell et la gamme UHD l'ont reçu en 2019, les UK de 2018 ne l'ont pas. Le
décodeur Atmos arrive sur les OLED en 2017, sur les NanoCell en 2020, et **la
gamme UHD d'entrée n'en a jamais eu** — elle reçoit du Dolby Digital Plus sans
la couche objet. Une gamme qu'on ne sait pas lire ne reçoit rien.

`panelType` vaut `"OLED"` et n'était pas lu, ce qui refusait le DTS à tous les
téléviseurs de 2023-2024 qui le décodent — le seul critère que `deviceInfo`
sache nous en dire.

**Le vrai Dolby Vision s'obtient en SORTANT du MKV, et cela demande un remux.**
LG ne démultiplexe le RPU qu'en ISOBMFF et en flux de transport — la réponse
d'un ingénieur LG sur le forum développeur est explicite, et le MKV n'y figure
pas avant webOS 25. Un `CodecProfile` retire donc les plages Dolby Vision de
tout conteneur qui ne les porte pas, par une liste NÉGATIVE
(`Container: "-mp4,m4v,mov,ts,…"`) pour qu'un conteneur inconnu soit traité
comme n'en portant pas. Jellyfin ne peut alors plus faire de lecture directe :
il remuxe en fMP4, en copiant l'image et l'audio.

| voie | `hdrType` |
|------|-----------|
| lecture directe du MKV | `HDR10` — la couche de base, le RPU est perdu |
| remux HLS en fMP4 | `DolbyVision` |

Sur la médiathèque qui a servi de banc d'essai, cela concerne 353 des 983
fichiers 4K, tous en profil 8.1. Le saut dans le flux reste sous les deux
secondes, mesuré à ±10 et ±25 minutes.

**Un premier relevé avait conclu l'inverse**, et c'est ce qui a bloqué le sujet :
le remux rendait alors `hdrType: "none"` en BT.709. Le chiffre était juste,
l'interprétation fausse. Jellyfin ne marque un flux `-tag:v dvh1 -strict -2` —
donc n'écrit la boîte `dvcC`, sans laquelle aucune dalle ne décode le Dolby
Vision — que si le jeton **`DOVI`** figure dans la condition `VideoRangeType`.
Le premier essai le retirait en même temps que le reste : la dalle recevait un
flux annoncé Dolby Vision et non configuré, et retombait plus bas que le HDR10.
Reproduit à volonté, dans les deux sens.

**Le manifeste ment sur ce point, et c'est le piège à retenir.** Il annonce
`SUPPLEMENTAL-CODECS="dvh1.08.06/db1p"` que le jeton soit là ou non — il est
produit indépendamment du flux. Seul `videoInfo.hdrType` dit ce que la dalle
reçoit.

**Le DTS est copié dans le remux, et le croire coupable a coûté cher.** Un
premier relevé donnait « DTS copié : `hdrType` none ; converti en AAC :
DolbyVision », et il a fait retirer le DTS du profil — donc convertir l'audio de
tous les films Dolby Vision qui en portent. Il était faussé deux fois : le
fichier d'essai avait un sous-titre PGS par défaut, qui suffit à faire incruster
donc recompresser l'image, et le relevé datait d'avant le choix explicite de la
variante, quand le téléviseur prenait encore un repli SDR une fois sur trois.
Refait sur un fichier sans sous-titre image, variante désignée :

| audio du remux | `hdrType` |
|----------------|-----------|
| DTS copié | `DolbyVision` |
| converti en AAC | `DolbyVision` |

Le remux porte donc `aac,mp3,ac3,eac3,dts,dca`. Le PCM en reste dehors, mais par
PRUDENCE et non par mesure — personne ne l'a essayé, et une piste muette se
diagnostique moins bien qu'une conversion. Le **TrueHD** n'y sera jamais : webOS
ne le démultiplexe dans aucun conteneur, il n'a donc jamais atteint la chaîne
audio, barre de son ou pas. Un fichier qui n'aurait que cette piste-là est le
seul à payer une conversion.

**Une seule leçon vaut d'être retenue de ces deux erreurs** : ne jamais conclure
d'une mesure prise sur un fichier dont on n'a pas inventorié les pistes. Un
sous-titre image par défaut, une variante mal choisie — chacun suffit à
travestir le résultat, et tous deux se lisent pareil dans `hdrType`.

Le profil 5 suit le même chemin et sort lui aussi en `DolbyVision`, bien que le
manifeste ne l'annonce pas — le serveur tague le flux sans le publier.

Sur webOS 25, `doviEnMkv` devient vrai, ce `CodecProfile` disparaît et le MKV
repart en lecture directe : le remux n'est là que le temps que LG rattrape son
démultiplexeur.

**Le client désigne lui-même la variante, parce que le téléviseur la choisit
mal.** Le manifeste maître d'un remux Dolby Vision propose la variante copiée et
deux replis SDR ré-encodés, **tous au même `BANDWIDTH`**. Le lecteur HLS de
webOS 23 ne les départage pas : une lecture sur trois partait sur un repli, ce
qui coûtait la plage dynamique ET déclenchait un ré-encodage 4K permanent.
Jellyfin place pourtant la variante Dolby Vision en tête — son commentaire vise
« les clients conformes (Apple TV, webOS 24+) », et cette dalle est du mauvais
côté de la limite.

`lecture/varianteDovi.ts` lit le manifeste et retient la variante portant
`SUPPLEMENTAL-CODECS` ; `lecture/playbackInfoTv.ts` enveloppe le hook du web pour
lui substituer cette URL. Cinq titres d'affilée, cinq fois `DolbyVision`, image
copiée — contre quatre sur six par le manifeste maître.

Deux pièges de ce chemin. L'URL doit être **masquée pendant la résolution**,
sans quoi le lecteur démarre sur le manifeste maître avant qu'on ait tranché. Et
`new URL` a besoin d'une base absolue : le client parle au proxy par un chemin
relatif (`/api/jellyfin/…`) qu'une balise `<video>` résout seule mais pas le
constructeur — l'échec était silencieux et rendait simplement le manifeste
maître.

**Un sous-titre PGS par défaut coûte le Dolby Vision, et la cause est au
serveur.** Le rendu PGS côté client télécharge le sous-titre en `.sup` ; sur ce
Jellyfin 10.11.8, l'extraction rend `HTTP 400 Error processing request` sur
**tous** les fichiers, là où un sous-titre texte sort en 200. Le client fait
alors ce qu'il doit — repli sur l'incrustation serveur — mais l'incrustation
impose un ré-encodage, donc la perte de la plage dynamique.

Ce qui a été fait de ce côté : à langue égale, le sous-titre choisi d'office
préfère désormais le TEXTE à l'image quand celle-ci coûterait un ré-encodage
(`useDefaultTracks.ts`). On ne retire rien — un fichier qui n'a que de l'image
garde son sous-titre, et l'arbitrage appartient alors à celui qui regarde. Le
paramètre s'appelle `incrustationCouteuse` et non « le client sait dessiner un
PGS » : sous mpv, il ne sait pas, mais mpv les rend nativement et gratuitement.

**Le lecteur reçoit la variante, pas le manifeste maître — et l'URL ne doit
jamais être vidée entre les deux.** La première version masquait `streamUrl` le
temps de résoudre la variante ; `WatchWeb` monte le lecteur sous condition de
cette URL, si bien qu'il était DÉMONTÉ. Il y perdait la dernière position lue,
repartait de zéro, et — les PTS étant absolus par `CopyTimestamps` — les prenait
pour un décalage de conteneur, affichait 0 et RAPPORTAIT 0 à Jellyfin. Changer
de piste audio effaçait le point de reprise du film. On tient donc la variante
précédente pendant l'aller-retour.

**Changer de piste audio recharge la source, et c'est irréductible en remux.**
Jellyfin n'écrit jamais de `#EXT-X-MEDIA:TYPE=AUDIO` — vérifié dans
`DynamicHlsHelper.cs`, où le seul groupe de rendition câblé est celui des
sous-titres, et mesuré sur le serveur : zéro piste alternative dans le
manifeste, avec ou sans `AudioStreamIndex`. Une seule piste est mappée côté
ffmpeg. Le préchargement dans un second lecteur est fermé lui aussi — LG répond
qu'« une application webOS ne peut lire qu'une vidéo à la fois ».

Reste à savoir si cela vaut qu'on s'en préoccupe. Chronométré sur la dalle,
du clic à l'image :

    +   27 ms  PlaybackInfo →        +  178 ms  vidéo:loadstart
    +   59 ms  PlaybackInfo ←        + 1190 ms  vidéo:loadedmetadata
    +   82 ms  master.m3u8 →         + 1211 ms  vidéo:canplay
    +  111 ms  master.m3u8 ←         + 1242 ms  vidéo:playing

**Soixante millisecondes de serveur**, et 1,06 s de lecteur natif. Pré-chauffer
la session à la sélection — l'idée naturelle — ne gagnerait donc rien et
laisserait des transcodages orphelins derrière chaque déplacement de focus dans
le menu. `MinSegments: 1` fait déjà le travail. Sur les fichiers **non** Dolby
Vision la question ne se pose pas : ils partent en lecture directe et la bascule
se fait par l'API `audioTracks`, sans rien recharger.

**Ce que fait le serveur s'affiche enfin**, en développement seulement :
`verif/surcoucheLecture.ts` peint le verdict de `playbackVerdict.ts` pendant la
lecture — mode, image copiée ou recompressée, audio copié ou converti, codec,
plage, raisons. Garde `import.meta.env.DEV || __TV_DEBUG__` et import dynamique,
comme la surcouche de focus ; vérifié absent du build livré jusqu'à ses chaînes
de caractères. Sans raccourci — la télécommande n'a pas de modificateur — et
sans élément focusable, sous peine de fausser le moteur de focus.

Elle a servi le jour même : elle annonçait « image RECOMPRESSÉE » sur un Dolby
Vision à l'image copiée. `VideoRangeTypeNotSupported` commence par « video » et
tombait dans les raisons de ré-encodage — juste pour un tone mapping, faux pour
le mécanisme qui va CHERCHER le remux. Le verdict s'appuie maintenant sur
`AllowVideoStreamCopy=false`, que Jellyfin pose sur les replis ré-encodés et sur
eux seuls.

Elle ne s'affiche qu'avec les commandes (`data-tv-lecteur === "osd"`) : un
panneau posé sur une image qu'on regarde n'est plus un instrument.

**Une lecture peut se figer sans que rien ne le signale.** Sur un remux, après un
saut ou à la reprise, l'élément vidéo s'arrêtait dans cet état :

    currentTime immobile   paused true   readyState 4
    buffered 19 s d'avance  error.code 2

`error.code 2` est `MEDIA_ERR_NETWORK`, et l'échelle de repli ne l'écoutait pas —
elle ne connaît que les codes 3 et 4, à raison : eux seuls disent qu'une puce a
refusé un flux. Une coupure réseau sur un segment n'a rien à retirer du profil,
elle a un flux à reprendre. Le film restait perdu.

`lecture/relanceGel.ts` s'en charge, avec le remède mesuré — `load()` puis
repositionnement, car `play()` est accepté sans effet et un micro-saut déplace
la position sans rien relancer. Il faut reposer la position APRÈS `load()`, qui
l'oublie. Trois relances au plus, puis l'abandon est écrit au journal.

**Le taux d'images ne détecte pas un gel** : `videooutput/getStatus` rend
`frameRate: 23.976` pendant le gel comme pendant la lecture — c'est la cadence
nominale du flux. Le seul témoin est la position qui n'avance plus, avec
`readyState >= 3` pour ne pas confondre avec un chargement.

Ces lignes viennent de `luna://com.webos.service.videooutput/getStatus`,
qui décrit ce qui sort réellement vers la dalle — `videoInfo.hdrType`,
`videoInfo.vui`, et la géométrie de `displayOutput`. **C'est le seul instrument
qui départage une hypothèse d'image d'un fait**, et il répond sans permission.
Il tranche aussi la question des formats larges : un 2,40:1 y apparaît en
`3840×2024` posé à `y = 68`, c'est-à-dire une image à son rapport exact avec
ses bandes — jamais étirée.

Vérifié de bout en bout sur la dalle : un MKV HEVC Dolby Vision 8.1 avec une
piste DTS 5.1 et une piste TrueHD 7.1 part en lecture directe — le serveur
choisit la piste DTS, ne touche pas à l'image, et sert
`/Videos/{id}/stream`.

**Une barre de son ne change rien à cette table, et c'est contre-intuitif.** Le
blocage d'un TrueHD ou d'un DTS-HD MA n'est pas à la SORTIE mais au
DÉMULTIPLEXAGE : LG ne liste ces codecs dans aucun conteneur, aucune
génération, donc la piste n'est jamais extraite du fichier et n'atteint jamais
l'eARC. C'est aussi pourquoi aucune application webOS n'en propose — l'Atmos de
Netflix ou de Disney+ voyage en E-AC3 JOC, que la table couvre déjà. Ce qu'une
chaîne audio change réellement est le nombre de CANAUX qu'un remux a le droit
de porter, et cette valeur vient désormais du matériel
(`tv.config.supportDolbyTVATMOS`) plutôt que d'une supposition. À ne pas
confondre avec `tv.model.edidType`, qui vaut `"TrueHD+dts"` : il décrit ce que
le téléviseur annonce à ses ENTRÉES HDMI, pas ce que son démultiplexeur
applicatif sait ouvrir.

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

Cinq règles gouvernent les déplacements. Un mouvement horizontal reste dans
sa rangée tant qu'il y a une carte à atteindre, et cède au bout de la piste ;
dans une grille, un mouvement vertical descend dans sa **colonne**, et une
colonne sans suite s'arrête à la rangée d'après — jamais plus loin. Hors
grille, un mouvement vertical s'arrête à la **première bande** rencontrée — la
ligne visuelle du candidat le plus proche, où le score départage, puis la
redirection de zone s'applique au gagnant : la géométrie brute sur tout
l'écran faisait gagner ce qui s'ALIGNE au départ plutôt que ce qui le SUIT, et
sur une fiche « bas » depuis Retour filait à la tuile d'extras par-dessus la
rangée d'actions, quand une ligne d'épisode pleine largeur — jamais désalignée
de nulle part — enjambait extras et saisons. Un voisin qui **chevauche** reste
un voisin (`geometrie.ts`) : la passe d'écarts PostCSS pose des marges
négatives sur toute ligne `flex gap-*`, et exiger un franchissement de bord
strict rendait les options d'un menu inatteignables une sur deux. Le rail
n'est **jamais un candidat géométrique** — il couvre toute la hauteur, et sans
cela « bas » y remonterait au lieu de descendre d'une rangée — : « gauche »
sans voisin est sa porte, partout, et l'on y entre sur l'écran courant ;
« droite » restitue l'élément de contenu qu'on avait quitté (`focus/zones.ts`,
le vocabulaire des `destinations` d'Android TV transposé au DOM — même chose
pour les zones de la fiche, qui entrent par « Lecture » et par la saison
active). Il reste écarté du focus initial : arriver sur un écran avec le focus
dans la navigation oblige à le déplacer avant même de regarder. Enfin, le
défilement est une **conséquence** du focus : un pas d'une rangée quand la
cible n'est pas montée, rendu intégralement si aucun focus n'aboutit — la page
ne défile jamais seule. Une exception, explicite : le défilement **connaît les
bords**. `cadrage.ts` reçoit le MOU — ce qu'il reste à défiler de part et
d'autre — et colle au bord quand le reliquat tiendrait dans la marge ; et
surtout, `bordure.ts` tranche AVANT d'agir entre un pas de révélation et une
**destination**. Plus aucun candidat au-delà dans le document, et moins d'un
écran de mou : alors on rejoint le bord d'un trait, et on y reste. Il faut les
deux verrous, chacun a son contre-exemple — le banc d'essai pose une piste
hors de la fenêtre de recensement, qui doit rester révélée par les pas ; une
grille de bibliothèque retire ses rangées du document au-delà de son overscan,
où « aucun candidat » devient vrai à tort mais où il reste des milliers de
pixels. La règle ne vaut que pour la VERTICALE : horizontalement, la question
se poserait au document alors que le mou est celui d'une piste. Sans elle, un
pas vaut 144 px depuis un bouton, donc 288 pour deux, et le mou au-dessus du
premier élément d'une page vaut 246 à 284 px — toutes les pages se pressaient
sur cette falaise, et la barre montait puis redescendait. Deux compléments du
même défaut : `deplacer` porte un **verrou de cycle**, car la répétition d'une
télécommande en lançait une dizaine par seconde dont le dernier minuteur
restaurait une position périmée ; et une **rangée vidée garde sa hauteur**
(`PisteTv.tsx`), sans quoi la page se rallonge au-dessus du focus quand on
remonte — invisible au bureau, où `contain-intrinsic-size` réserve la place,
mais la passe de compatibilité retire cette propriété. Les calques
`position: fixed` — le rail — sont exclus de la passe fenêtre du cadrage
comme de la question du bord : on écrivait pour eux un défilement qu'ils ne
suivaient pas, et leurs entrées répondraient « il y a un candidat au-dessus »
depuis n'importe où.

**Deuxième exception : le POINTEUR défile.** Viser un bord de l'écran avec la
Magic Remote fait défiler la vue sans que le focus bouge — c'est le geste de
webOS, où le pointeur EST la désignation, et sans lui la télécommande n'a aucun
moyen d'atteindre une carte trois écrans plus bas autrement qu'à la flèche. La
règle est tenue par les deux bouts. D'un côté le **sceau** (`curseur.ts`) :
chaque écriture de défilement scelle l'état, et le survol refuse de prendre le
focus tant que le pointeur n'a pas réellement bougé. Sans lui, le `mouseover`
que le défilement provoque sous un pointeur IMMOBILE emmènerait l'anneau dans
le sens du défilement, à chaque image — c'est le défaut que `curseur.ts`
documentait déjà sans le corriger. De l'autre le **réancrage** : à l'arrêt, et
seulement si l'anneau a quitté la fenêtre, on le repose sur l'écran courant.
Sans lui, la première flèche appuyée ramènerait la vue là où l'anneau était
resté, par `amenerEnVue`, annulant le geste qu'on vient de faire.

Les cibles — le conteneur vertical, la piste horizontale — sont résolues au
DÉMARRAGE du geste et gardées jusqu'à son terme. Les réévaluer à chaque image
paraissait plus juste, et c'est le contraire : la page défile sous un pointeur
immobile, `elementFromPoint` finit par désigner un calque fixe, et le geste
s'arrêtait au milieu sans rien pour le reprendre — mesuré, 753 px puis plus
rien alors qu'il restait du mou. La courbe de vitesse est quadratique, de 240 à
1600 px/s (`zonesBord.ts`, pur et testé) : effleurer la bande fait ramper, ce
qui permet de s'arrêter sur la bonne rangée, et s'y coller fait filer. Une
droite donne trop de vitesse dès l'entrée dans la bande, et l'on dépasse
toujours sa cible. Enfin, la boucle d'animation n'existe QUE pendant le
défilement : au repos, aucune image n'est composée pour rien.

**Un menu de filtres pose son focus en s'ouvrant** (`MenuFiltreTv.tsx`). Le
moteur ne peut pas s'en charger : il ne déplace le focus qu'aux appuis
directionnels, et ses repose-focus renoncent dès qu'un élément est focalisé —
ce qu'est la pastille. C'est donc l'affaire des enveloppes, et deux des quatre
surfaces piégeantes posaient déjà le leur. `destinationEntreeDeZone`
(`zones.ts`) expose la cascade pour cela, et son dernier rang **préfère les
non-champs** : le repli en ordre de document désignait le champ de recherche
des genres, donc faisait monter le clavier système à un simple appui vers le
bas. Un panneau qui n'offre QUE de la saisie — les deux années — garde son
entrée explicite : rien ne doit faire surgir un clavier sans geste de
l'utilisateur.

**Le clavier système suspend le moteur** (`clavierSysteme.ts`). Sur webOS il
monte seul au focus d'un `<input>` et ne peut pas être désactivé ; tant qu'il
est là, les flèches lui appartiennent, et les lui prendre produit le défaut de
focus que LG documente sans contournement. `keyboardStateChange` suffit — un
événement DOM ordinaire, sans `webOSTV.js` que le CSP interdit. **Ne jamais
blurrer le champ quand `visibility` repasse à faux** : la séquence d'une
dictée est vrai → faux → vrai, et c'est ce qui casserait la saisie vocale — la
seule qui existe ici, le téléviseur transcrivant lui-même sans jamais donner
l'audio à l'application.

**Un maintien qui agit avale OK jusqu'au relâchement** (`focus/verrouTouche.ts`).
L'action longue se déclenche au seuil, touche tenue — c'est ce qui donne la
sensation d'un appareil qui répond — mais la touche tenue continue d'émettre,
et ses répétitions atteignaient l'écran fraîchement ouvert : maintenir OK sur
une carte traversait la fiche jusqu'au lecteur, le bouton « Lecture »
synthétisant un `click` par Entrée. Le verrou, armé par l'action longue juste
avant d'agir, avale la touche en capture sur `window` — avant le moteur et
React, donc l'affinage d'entrée du nouvel écran survit — et se désarme au
`keyup`, ou au silence de la répétition sur les modèles qui ne notifient pas
le relâchement. Sur une affiche, le maintien ouvre la fiche comme l'appui
court : un geste ne se juge pas à ce qu'il apprend mais à ce qu'il répond.

**Le pointeur déplace le focus, et ne fait rien d'autre.** Un téléviseur LG en a
un — la Magic Remote le fait apparaître dès qu'on agite la télécommande. Le
survol du client web reste éteint des deux côtés : les règles `:hover` sont
retirées de la feuille, les gestionnaires `onMouseEnter` neutralisés par
`shims/survolInerte.ts`. Ce que `focus/survolFocus.ts` ajoute n'est pas leur
retour, c'est un moyen de plus de déplacer le focus — il n'y a toujours qu'un
seul état, et la carte visée montre exactement ce qu'elle montre au D-pad. Les
champs de saisie en sont exclus : webOS ouvre son clavier système au focus d'un
`<input>`, et un pointeur qui traverse un champ de recherche ferait surgir un
clavier plein écran que personne n'a demandé.

## L'anneau de focus

Un trait **blanc** de 3 px qui épouse les coins, un **halo violet** derrière
lui, une **ombre portée** dessous — et, sur une carte, autour de **l'affiche
seule**, titre et métadonnées hors cadre. C'est la grammaire des clients
natifs du même produit (`apps/tv/src/theme/focus.ts`) : le blanc désigne sur
n'importe quelle jaquette, là où une couleur de marque se perd sur une affiche
violette ; la marque revient dans le halo.

**C'est un `box-shadow`, pas une `outline`, et la raison n'est pas
esthétique** : Chromium ne fait suivre le `border-radius` par l'outline qu'à
partir de la version 94, et la dalle en a 53. L'anneau y était un rectangle
autour d'une affiche arrondie à 20 px — quatre oreilles à chaque angle,
invisibles au bureau où le navigateur arrondit tout seul. L'échange se paie :
une ombre se laisse rogner par un ancêtre en `overflow: hidden`, ce qu'une
outline ne fait jamais ; les rangées réservent déjà la place (`pt-8`, `pb-6`),
et `verif/reglesFocus.ts` a sa règle de rognage.

Deux pièges à connaître avant d'y toucher. **Ne posez aucun `border-radius`
dans `focus.css`** : les feuilles du portage ne sont dans aucune couche, et
une règle sans couche l'emporte sur toutes — elle écraserait le
`rounded-full` de chaque pastille au moment précis où on la vise. Et
l'anneau d'une carte vit sur un DESCENDANT (`.media-tile::after`, en fondu
d'opacité, jamais d'ombre animée) : on descend de l'enveloppe focalisée vers
la boîte de l'affiche — pas besoin de `:has()`, qui n'existe pas ici.

## Le fond au focus

Deux calques, jamais trois, et l'ancien tient l'écran jusqu'à ce que le nouveau
soit chargé (`ui/heros/calquesFond.ts`, pur et testé). Trois défauts se
ressemblaient à l'écran et n'avaient qu'une cause : un déplacement du focus est
un `blur` suivi d'un `focus`, et l'effacement partait sur le premier. Le fond
était donc démonté puis remonté entre CHAQUE carte — écran noir le temps de
télécharger l'image, clignotement entre deux épisodes d'une même série qui
partagent pourtant le même Backdrop, et apparition sèche au retour sur une
carte déjà visitée. L'effacement est désormais différé de 120 ms et la visée
suivante l'annule.

L'opacité vit sur la COUCHE, pas sur les images : deux calques à 0,55
superposés composent à 0,80, et le croisement se verrait comme un éclat à
mi-course. Et le fondu est une ANIMATION, pas une transition — elle joue au
montage de l'élément qui la porte, y compris quand l'image est déjà en cache,
cas qu'une transition ne peut pas traiter puisque son état de départ et son
état d'arrivée sont posés dans le même rendu.
