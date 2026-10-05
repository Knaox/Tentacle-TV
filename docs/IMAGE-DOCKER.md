# L'image Docker du serveur — ce qu'elle porte, et pourquoi si peu

Demande du 2026-10-05 : « Tentacle doit être léger : l'image actuelle est
beaucoup trop lourde. » Ce document dit ce qui pesait (mesuré au registre), ce
qui a changé, les variantes essayées avec leurs chiffres, et les pièges payés
en route. Le `Dockerfile` garde, en commentaires, le pourquoi de chaque étape.

## Ce qui pesait

Relevé du registre (`ghcr.io/knaox/tentacle-tv:latest` = v1.23.0, amd64,
tailles compressées, sans rien télécharger — manifeste et historique de
l'image) :

| Couche | Compressé |
|---|---|
| `node:20-alpine` (3 couches) | 48,4 Mo |
| `corepack` + `pnpm@latest` | 8,7 Mo |
| apk `chromaprint ffmpeg python3 deno` | 105,8 Mo |
| yt-dlp (zipapp) | 2,9 Mo |
| **`node_modules` du monorepo ENTIER** | **306,9 Mo** |
| serveur compilé, clients web et LG, shared-deps | ~6,5 Mo |
| **Total** | **479,3 Mo** (arm64 : 473,6) |

Les deux tiers étaient le `node_modules` de tout l'espace de travail —
dépendances de développement du web et du téléviseur comprises (vite,
typescript, tailwind, react…), recopiées telles quelles dans l'image. S'y
ajoutaient deno (le moteur JavaScript de yt-dlp, ~43 Mo compressés), ffmpeg et
tous ses codecs vidéo, la CLI Prisma et son moteur de schéma (que l'entrypoint
lançait par `npx` à CHAQUE démarrage), et pnpm « latest ». L'image tournait
en root, sans healthcheck, et `node:20` n'est plus maintenu depuis avril 2026.

## Ce qui a changé

- **Les dépendances de production du serveur, seules** : `pnpm deploy --prod`
  du seul `@tentacle-tv/backend`, sans les pairs facultatifs de
  `@prisma/client` (la CLI `prisma`, `typescript`), puis l'élagage
  `apps/backend/docker/prune-node-modules.sh` — Prisma ne garde que
  `runtime/library.js` et son moteur, et rien de ce qui ne s'exécute pas
  (cartes, types, docs, tests). 700 paquets et 652 Mo deviennent 123 paquets
  et 29 Mo, dont 16 Mo de moteur Prisma.
- **Plus de CLI Prisma** : le serveur pose son schéma lui-même
  (`services/schemaInit`). Sur une base vierge, `prisma/schema-full.sql` —
  généré au build depuis `schema.prisma` (`pnpm db:schema-sql`) — puis
  `core-init.sql`, à chaque démarrage, sans jamais rien supprimer. La base
  obtenue est identique à `schema.prisma` (`prisma migrate diff` : rien, hors
  les tables des plugins). L'assistant d'installation n'appelle plus
  `prisma db push`, qui supprimait les tables de Vigie.
- **Plus de deno** : yt-dlp résout les défis de YouTube avec le Node du
  serveur (≥ 22 exigé par yt-dlp). Résultats identiques, mesurés : voir
  `BANDES-ANNONCES.md`.
- **ffmpeg et fpcalc compilés pour le seul usage du serveur** (étape
  `media-tools`) : Jellyfin rend les extraits audio en MP3
  (`audioWindows.ts`), le serveur n'a qu'à décoder du MP3. ffmpeg 8.1.2
  statique réduit au MP3 → PCM (1,6 Mo), chromaprint 1.6.0 lié dessus avec
  la même FFT (fftw3) que le paquet d'Alpine (2,7 Mo). Empreintes `fpcalc
  -raw` et PCM décodé **identiques au bit près** à ceux des paquets d'Alpine
  (trois signaux : sinus et bruit rose, balayage modulé, accords et bruit
  brun ; 221, 705 et 1 432 points).
- **`node:24-alpine`**, pnpm à la version de `packageManager` (plus de
  « latest »).
- **Un utilisateur non-root** : l'entrypoint (sous tini) ne garde root que le
  temps de rendre le volume de données à PUID:PGID (1000:1000 par défaut) —
  une fois, au premier démarrage sur un volume d'une image d'avant —, puis
  `su-exec`. Lancé directement en non-root, il saute cette marche.
- **Un healthcheck sans curl** (`fetch` de Node sur `/api/health`, qui répond
  aussi en mode installation), sondé toutes les 3 s au démarrage.
- **Un contexte de build en liste blanche** (`.dockerignore`) : 136,8 Mo et
  4 272 fichiers envoyés au constructeur, puis 19,5 Mo et 3 730 fichiers
  (mesuré par BuildKit sur une extraction `git archive`, comme en CI).

Les étapes `tv-client-build`, `tv-client`, `server` et `production` gardent
leurs noms et leur rôle : `server.yml` et `webos.yml` les remplacent par des
contextes nommés (`.github/scripts/lib/server-image.mjs`, tests rejoués).

## Les variantes mesurées

2026-10-05, colima (4 processeurs, 6 Go), arm64 ; étape `server` (le client
LG ajoute 1,8 Mo à l'image livrée). Taille compressée : poussée vers un
registre local et lue au manifeste — la même mesure que celle de GHCR.
Décompressée : `docker export` du système de fichiers. Démarrage : du
`docker run` à la première réponse 200 de `/api/health`, base existante,
médiane de trois, dans une même séance. Build : `--no-cache`, moyenne de deux
passages consécutifs (le réseau du registre npm fait varier de ±15 s).

| Variante | Compressée | Décompressée | Démarrage | Build à froid |
|---|---|---|---|---|
| Avant (`node:20-alpine`, monorepo, deno) | 464,3 Mo | 1 591 Mo | 2,5 s | 144 s |
| `node:24-alpine`, outils audio d'Alpine | 139,5 Mo | 356 Mo | 0,8 s | 76 s |
| **`node:24-alpine`, outils audio compilés** | **93,7 Mo** | **253 Mo** | **0,7 s** | **81 s** |
| `node:24-slim` (Debian, apt) | 269,7 Mo | 732 Mo | 0,6 s | 75 s |
| distroless `nodejs24-debian12:nonroot` | 134,3 Mo | 287 Mo | 0,6 s | 60 s |

L'image livrée complète (étape `production`, client LG compris) : **95,5 Mo
compressés en arm64**, contre 473,6 Mo pour la v1.23.0 publiée (−80 %) ;
258 Mo décompressés, contre 1,6 Go. La compilation de ffmpeg et chromaprint
coûte quelques secondes de build, et la CI la garde en cache (étape stable
tant que leurs versions ne bougent pas).

**Retenue : alpine, outils audio compilés.** La plus légère de loin, et la
seule qui garde tout ce que fait le serveur à l'identique :

- **slim** : la base Debian est plus lourde, et son ffmpeg tire des
  centaines de bibliothèques ;
- **distroless** : pas de shell, donc pas d'entrypoint pour reprendre un
  volume d'une image d'avant (root) — elle tourne en 65532, figée ; pas de
  Python, donc yt-dlp en binaire autonome (40 Mo, PyInstaller), plus
  d'ouvrier chaud pour les bandes-annonces ni de mise à jour quotidienne de
  yt-dlp (le zipapp qu'il télécharge exige Python) ; ffmpeg statique complet
  (vidéo comprise). Plus lourde qu'alpine, et moins capable.

## Les pièges payés

- **`pnpm install --filter` en mode `hoisted` installe le verrou ENTIER** :
  700 paquets, react-native et expo compris. `pnpm deploy` ne prend que le
  paquet visé — à condition de tolérer les patchs du mobile et de la TV
  (`--config.allow-unused-patches=true`) et de couper les pairs automatiques
  (`--config.auto-install-peers=false`), sans quoi la CLI Prisma revient par
  un pair facultatif de `@prisma/client`.
- **Le client Prisma refuse `PREPARE` / `EXECUTE`** : il envoie le SQL brut
  en protocole préparé, où MariaDB les rejette. `runStatements.ts` les émule
  (lire la variable de session, exécuter son texte) sur UNE connexion
  (`connection_limit=1`) — `core-init.sql` reste jouable tel quel par le
  client `mysql`.
- **`core-init.sql` ne suffit pas sur une base vierge** : neuf tables
  (`server_config`, `paired_devices`, `notifications`…) ne naissaient que du
  `db push` de l'assistant. D'où `schema-full.sql`, généré au build.
- **Une base peut n'être vierge qu'à moitié** : l'image d'avant, démarrée sur
  une base neuve, y posait le début de `core-init.sql` (`share_links`…) puis
  butait — sans `server_config`. Le schéma complet est donc rejoué en
  `IF NOT EXISTS` (tables, index, clés étrangères : `idempotentDdl.ts`) ;
  trouvé par la batterie de l'image, qui enchaîne ancienne et nouvelle image
  sur la même base.
- **En amd64, le `configure` de ffmpeg exige `nasm`** (optimisations x86) :
  invisible en arm64, trouvé par un build amd64 émulé avant la CI.
- **L'émulation amd64 d'un Mac Apple Silicon (QEMU, colima) ne sait pas
  compiler ffmpeg** : `cc1` y plante au hasard, jusque dans les tests du
  `configure`, qui conclut alors à des en-têtes absents (`dirent.h`). Rien à
  voir avec le `Dockerfile` : la CI construit chaque architecture sur sa
  propre machine (`ubuntu-latest`, `ubuntu-24.04-arm`). L'image amd64 se
  mesure donc au premier build de la CI (cran `build`, rien de publié).
- **Le fpcalc « statique » d'AcoustID est lié à la glibc** (`ld-linux`,
  `libc.so.6`) : « not found » sur Alpine. On le compile.
- **`FindFFTW3` prend `libfftw3.so`** et la liaison statique échoue : chemin
  de `libfftw3.a` donné en dur (`-DFFTW3_FFTW_LIBRARY`).
- **Le muxer de `-f s16le` s'appelle `pcm_s16le`** au `configure` de ffmpeg.
- **Une copie faite en root rend les fichiers à root** : l'entrypoint
  recopie les dépendances partagées des plugins SOUS l'utilisateur du
  serveur, sinon le `chown` repassait à chaque démarrage.
- **`/tv` répond 404 à un navigateur ordinaire** en production : c'est voulu
  (`static/tvUserAgent.ts`), un agent `Web0S` reçoit le client.

## Vérifié sur l'image retenue

- Démarrage sur une base vierge (schéma complet puis `core-init.sql`, 189
  instructions), puis redémarrage (143) ; processus `node` en 1000:1000 ;
  conteneur « healthy » en quelques secondes. Base obtenue identique à
  `schema.prisma` (`prisma migrate diff`), y compris depuis une base vierge à
  moitié.
- Volume ET base remplis par l'image d'AVANT (root, base neuve) : volume
  rendu à 1000:1000 au premier démarrage, jamais ensuite ; schéma complété.
- Client web servi, `/tv` servi à un agent de téléviseur LG.
- Vigie installé (module serveur 1.23.0, sans configuration) : chargé, ses
  routes répondent.
- Bande-annonce réelle : maître HLS `visionos` en 2,4 s ; `web_embedded`
  identique avec Node et avec deno.
- Build en mode CI `server` (étape `production`, client LG repris de
  `:latest` par contexte nommé) et en mode CI `webos` (étape `production`
  posée sur la v1.23.0 publiée, client LG venu d'un dossier : le serveur
  d'avant reste intact, seul le client change) ; tests des scripts de
  livraison (61/61).
