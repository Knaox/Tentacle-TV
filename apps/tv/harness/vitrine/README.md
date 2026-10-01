# Vitrine — les visuels des stores et du site, sur contenu libre

Tous les visuels de fiche de Tentacle TV (App Store iPhone, iPad, Mac et
Apple TV ; Google Play téléphone et tablettes ; Microsoft Store) et ceux du
site tentacletv.app, en français et en anglais, tirés de la VRAIE interface
sur un catalogue LIBRE : dix titres de Blender Studio (CC BY), images prises
sur Wikimedia Commons, licence vérifiée fichier par fichier.

- **Apple TV** : la refonte (`src/redesign/`), montée par le banc UI au
  simulateur (Apple TV 4K → captures natives 3840×2160).
- **Téléphone, tablette, bureau** : le client WEB de `main` (ce qui est
  livré), en build de production, branché sur un faux serveur qui sert le
  catalogue libre. Sous le seuil du bureau, le web est le MIROIR de l'app des
  stores : mêmes écrans, mêmes mesures.

## En une commande

Depuis `apps/tv/harness/vitrine` :

```bash
node vitrine.mjs all
```

| Étape | Commande seule | Effet |
|---|---|---|
| Sources | `sources [--fetch]` | Vérifie les 43 images libres (`catalog/sources.json`) ; `--fetch` télécharge celles qui manquent. |
| Instantané | `snapshot` | Tire affiches, fonds, vignettes et BlurHash ; écrit l'instantané (FR, EN). |
| Apple TV | `capture`, puis `compose` | Les écrans de `compose/appstore.json` au banc, puis les images App Store (accroche + écran) et le visuel « scène » du site. |
| Web | `web [--device=…] [--only=…] [--rebuild]` | Les écrans de `compose/web.json` sur iphone, ipad, ipadLandscape, tablet, mac, windows. |
| Stores | `stores [--store=…]` | iPhone, iPad (portrait et paysage), Play (téléphone, tablettes), Mac : accroche + écran ; Microsoft : captures nues et `legendes.md`. |
| Marque | `brand` | Microsoft : « Super hero art » 3840×2160 et icône 300×300, tirées de `brand/`. |
| GitHub | `github` | L'image d'en-tête du README et les quatre captures de `docs/screenshots/`, avec leurs crédits. |
| Site | `site` | Copie les sources du site dans `Tentacle Web/tools/capture/out/raw/vitrine/` ; le site les optimise lui-même (`node tools/capture/optimize.mjs`). |
| Planches | `planches` | Toutes les séries en planches contact, pour relecture. |
| Arrêt | `down [--sim]` | Arrête par PID Metro, le relais, le faux serveur et le client web lancés par la vitrine (et le simulateur). |

## La pile du web (`web/`)

- `server.mjs` : le faux serveur — le backend Tentacle et Jellyfin derrière
  `/api/jellyfin`, comme le vrai proxy — sur l'instantané. Héros FIXE
  (`/__vitrine/hero?set=<titre>`), langue (`/__vitrine/lang?set=en`), journal
  des routes inconnues (`/__vitrine/journal`). Ses routes se rechargent à chaud.
- `stack.mjs` : lance le faux serveur (3061) et `vite preview` du client web de
  `main` (5261, build de production — jamais le serveur de développement, qui
  affiche ses compteurs de débogage). Ce qui tourne déjà est gardé.
- `engine.mjs` + `electronHost.cjs` : **Electron hors écran** à la taille et
  à la densité de l'appareil, piloté par CDP. Chrome sans tête se figeait sur
  les captures haute densité (calques d'image en opacité partielle) ; le rendu
  hors écran d'Electron — le moteur de l'app de bureau — ne se fige jamais, et
  son `paint` livre l'image à la densité demandée (×3 pour l'iPhone).
- `shoot.mjs` : préparation (tactile, agent de navigateur, session de démo),
  attente du repos, temps figé avant la capture, hasard de l'app à graine fixe.
- `gestures.mjs` : défiler jusqu'à une section, survoler ou maintenir une
  carte, saisir un code, poser le lecteur sur un instant.
- `captureCss.mjs` : ce qu'un écran figé ne doit pas porter (barres de
  défilement, curseur, grain du héros à 6 %).

## Où vont les fichiers

Rien de binaire dans le dépôt. Par défaut (variables `VITRINE_*` pour changer) :

- `~/Desktop/Projet - local/Tentacle-Vitrine/` : `sources/`, `snapshot/`,
  `captures/` (Apple TV), `captures-web/<appareil>/<langue>/`, `video/` (le
  plan de Tears of Steel du lecteur), `github/docs/`, `planches/`, `CREDITS.md`.
- `~/Desktop/Projet - local/Tentacle-AppStore/` : chaque série dans un dossier
  DATÉ, à côté de l'actuelle (jamais par-dessus) — `appletv/2026-10-refonte`,
  `IOS/2026-10`, `Ipad/2026-10` (portrait), `Ipad/2026-10-paysage`, `macos/2026-10`,
  `PlayStore/2026-10/{telephone,tablette}`, `microsoft/2026-10` —, chacune avec son
  `CREDITS.md` (licence CC BY : les crédits partent avec les images).

## Les règles

- **Contenu libre seulement** : les titres de `catalog/`, rien de la vraie
  bibliothèque (droits ; rejet Apple 5.2.1). Pas de logo de titre : Blender
  Studio exclut ses logos de la licence CC.
- **Rien d'inventé** : ni note communautaire, ni avis, ni plateforme de
  streaming. Seules les notes perso du profil de démo — une fonction de l'app.
- **Pas de « téléchargement »** (ni « download ») sur un visuel Apple : la
  capture web s'arrête si le mot paraît à l'écran.
- **Les accroches vivent ici** (`compose/*.json`), écrites dans chaque langue,
  jamais dans l'i18n de l'app.
- **Les bancs sont à soi** : simulateur créé neuf, ports relus avant d'être
  choisis, processus arrêtés par PID, profils de navigateur jetables.
- **App Store** (règle 2.3.3) : l'app en usage, jamais un écran de connexion
  ou de démarrage seul — jumeler la TV DEPUIS le téléphone est une fonction,
  montrée en dernier. Aucune autre plateforme nommée (2.3.10).
- **Microsoft** : aucune accroche dans les captures (sa règle) ; les légendes
  (200 caractères au plus) se collent dans Partner Center.
