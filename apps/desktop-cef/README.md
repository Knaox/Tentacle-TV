# Tentacle CEF — prototype

Prototype de client de bureau pour Tentacle TV sur l'architecture de la réécriture CEF de
Jellyfin Desktop (aujourd'hui `andrewrabert/jellium-desktop`) : **CEF** pour l'interface web,
**libmpv** pour la lecture, **SDL3** pour la fenêtre. Objectif premier : un vrai HDR/EDR sur
macOS. Linux et Windows viendront ensuite, sans refonte : tout ce qui dépend de l'OS vit
derrière `src/platform/`.

Importé dans le monorepo (`apps/desktop-cef`) depuis le dépôt local `Tentacle-CEF`, branche
`proto/cef-mpv-sdl3` au commit `0dbcfe7` ; son historique est resté dans ce dépôt-là.

- Contrat entre les modules : [docs/INTERFACES.md](docs/INTERFACES.md)
- Windows (prérequis, `pnpm dev:cef`, recette) : [docs/A-TESTER-WINDOWS.md](docs/A-TESTER-WINDOWS.md)
- Ce que le bureau Electron offre et que CEF n'a pas encore : [docs/PARITE-ELECTRON.md](docs/PARITE-ELECTRON.md)
- Étude de la référence : `docs/etude/` (écrite par les sessions du lot)
- Dépendances, builds, profils, médias de test : `~/.cache/tentacle-cef/` (hors dépôt)

## Lancer — sur le profil d'Electron

Depuis la racine du monorepo :

```bash
pnpm dev:cef                 # build web + build natif, puis l'app (son ouvert)
pnpm dev:cef -- --skip-web   # sans reconstruire apps/web/dist
pnpm dev:cef -- --mute       # son coupé
```

Le lanceur est `scripts/dev.mjs` (Node seul, aucune dépendance), le même sur les trois OS :

- **macOS** : comme avant (`scripts/build.sh`, paquet `Tentacle.app`, libmpv du cache, SDL3 de
  Homebrew).
- **Linux** : vérifie les prérequis et donne LA commande d'installation de la distribution
  (Fedora, Debian/Ubuntu, Arch, openSUSE), télécharge CEF de l'architecture (épinglé), prend
  SDL3 du système (sinon la construit, archive épinglée) et construit notre libmpv (fork +
  correctifs) — à défaut, celle de la distribution, avec un avertissement à l'écran. Build dans
  `~/.cache/tentacle-cef/build/<nom>/app/tentacle`. `node scripts/dev.mjs deps` : les
  dépendances seules. Ce qu'il reste à essayer : [docs/A-TESTER-LINUX.md](docs/A-TESTER-LINUX.md).
- **Linux immuable** (Bazzite, Silverblue, Kinoite… : `sudo dnf install` y est impossible) : les
  paquets de développement vivent dans une boîte distrobox, `tentacle-cef` par défaut
  (`distrobox create --name tentacle-cef --image registry.fedoraproject.org/fedora:44`, `--nvidia`
  avec une carte NVIDIA). `pnpm dev:cef` tapé sur l'hôte se REJOUE dans la boîte, tel quel
  (`scripts/dev/linux-box.mjs`) ; `TENTACLE_CEF_BOX=<nom>` choisit une autre boîte (et force ce
  passage sur un hôte ordinaire), `TENTACLE_CEF_BOX=off` le coupe.
- **Windows** : Visual Studio Build Tools, CMake, Ninja ; CEF et SDL3 épinglés (axe windows).
- `TENTACLE_DEV_DRY=1` imprime les builds et la commande de l'app sans rien lancer.

L'app charge le front du monorepo (`apps/web/dist`, construit pour la coquille de bureau comme
`pnpm dev:electron`) sous **`tentacle://app`**, l'origine d'Electron, et **partage le stockage
de ce front avec Electron** : session, adresse du serveur, réglages, cache d'Octave. Se
connecter dans l'un, c'est être connecté dans l'autre.

- **Profil d'Electron** : celui de `pnpm dev:electron` (`dataPaths.ts` : sous macOS
  `~/Library/Application Support/com.tentacle.media`, sous Linux `$XDG_DATA_HOME` ou
  `~/.local/share/com.tentacle.media`, sous Windows `%APPDATA%\com.tentacle.media`), passé
  aussi à l'app par `--user-data`. Autre dossier :
  `TENTACLE_ELECTRON_PROFILE=<dossier>` (l'app du Mac App Store vit dans son conteneur).
- **Ce qui est partagé** : `Local Storage` et `IndexedDB`, par des liens depuis le profil CEF
  (`~/.cache/tentacle-cef/profiles/electron/Default/`). Le reste du profil Chromium (cookies,
  cache, historique) reste à CEF : autre version de Chromium, autre disposition, autre clé de
  chiffrement des cookies. CEF garde ces bases en LevelDB, le format d'Electron
  (`src/shell/browser_app.cpp`).
- **Jamais les deux à la fois** : le lanceur refuse tant qu'un processus tient le profil
  d'Electron (son `SingletonLock`, les verrous LevelDB). Ouvrir Electron pendant que CEF tourne
  le ferait démarrer sur un stockage vide, en mémoire.
- **Quitter par Cmd+Q ou en fermant la fenêtre.** Chromium diffère l'écriture du stockage
  (5 s et plus) et ne la termine qu'à une fermeture normale. Ctrl+C dans le terminal (ou un
  `kill`) arrête tout sans elle : ce qui a été fait dans les dernières secondes — une
  connexion, un réglage — ne revient ni dans CEF ni dans Electron (mesuré).
- `TENTACLE_URL=<URL>` pose l'adresse du serveur dans le front s'il n'en a aucune.

## Ce que la coquille surveille d'elle-même (Linux)

- **Le fil principal** (`src/shell/stall_meter.h`) : chaque étape de la boucle est chronométrée ;
  au-delà de 50 ms, `[fil] fil principal retenu N ms — étape (geste)` au journal. Un « gel » se
  lit là : `shell.debug.stalls` pour les bancs.
- **La page perdue** (`src/shell/render_recovery.h`) : le processus de rendu qui tombe est
  remplacé — la même page rechargée, l'accueil si elle retombe dans la minute, puis 2, 5, 10,
  30 s ; `[rendu] le processus de rendu est tombé (…)`. Une vidéo en cours est arrêtée.
- **Le secours d'affichage** (`src/shell/page_rescue.h`) : la page arrive par une texture
  partagée (dmabuf). Import impossible : peinture logicielle d'emblée. Import refusé image
  après image : l'app se relance en peinture logicielle. Lancement qui n'a jamais montré la
  page (témoin `<profil>/page-essai`) : le suivant part sans GPU (`--disable-gpu`). Le secours
  vaut cinq lancements (`<profil>/page-secours.json` ; le supprimer retente tout de suite).
  `TENTACLE_NO_SHARED_TEXTURE=1` force la peinture logicielle (essai).
- **La bulle d'aide et la vignette du glisser** sont des images du compositeur
  (`src/platform/linux/overlay_linux.h`) : aucune fenêtre ni contexte GL de plus — c'est leur
  destruction qui figeait l'image au premier clic.
- **Le lecteur préchauffé** (`src/bridge/video_prewarm.h`, sous-surface Wayland) : une instance
  mpv mince naît au REPOS de la page (3 s sans image ni saisie) et `mpv_init` la reprend —
  première image 0,83 s → 0,18 s. Jamais sur batterie.

Bancs rejouables : `bench/gel` (bulle + clic, KWin virtuel, souris factice), `bench/noir` (rendu
tué, import refusé, lancement sans image), `bench/lecteur/depart.mjs` (départ du lecteur),
`bench/survol/hoverlag.mjs` (bouton remplacé sous une souris immobile).

## Bandes-annonces : ni H.264 ni AAC

Les binaires publics de CEF n'ont pas les codecs propriétaires (`MediaSource.isTypeSupported` :
`avc1` et `mp4a` faux ; VP9, AV1, Opus vrais). La page le DÉCLARE au serveur (`dec=vp9,opus`),
qui lui relaie du VP9 + Opus s'il déclare `trailers.openCodecs` (serveur 1.41.0) : aperçus au
survol et lecteur de la fiche jouent sans rien ajouter à l'installation. Face à un serveur plus
ancien : aucun aperçu, aucune requête ; la fiche garde le lecteur officiel de YouTube. Un
`<video>` de la page joue sans geste préalable, comme dans Electron
(`--autoplay-policy=no-user-gesture-required`, `src/shell/browser_app.cpp`) : sans elle,
l'aperçu survolé avant le premier clic restait figé sur sa première image. Restent
hors d'atteinte sans les codecs : les bandes-annonces AlloCiné (Dailymotion, H.264 seul), les
vidéos « pour enfants » (MP4 seul) et ce qu'une extension jouerait en H.264. Détail et mesures :
`docs/BANDES-ANNONCES.md`, « Sans H.264 ni AAC — le bureau CEF ».

## Le lecteur web de secours, et comment provoquer la panne

Quand mpv ne s'initialise pas ou tombe en pleine lecture, la page passe au lecteur web
(`<video>` + hls.js) toute seule, à la même position, avec le bandeau « Lecteur de secours ».
Ce lecteur-là ne décode ni H.264 ni AAC : il le DÉCLARE (`openWebEngine`, packages/shared) et
Jellyfin lui sert de l'AV1 + Opus en fMP4 — copie d'une source AV1, encodage sinon (il faut que
l'administrateur de Jellyfin ait permis l'encodage AV1). Détail et mesures :
`docs/TRANSCODAGE-MOTEURS.md`, « Le lecteur web du bureau CEF ».

Pour l'éprouver sans casser mpv (`src/bridge/mpv_fault.h`) :

```bash
TENTACLE_MPV_FAULT=fatal pnpm dev:cef -- --mute   # la première lecture tombe 10 s après son départ
```

| Mode | Effet |
|---|---|
| `init` | `mpv_init` est refusé |
| `stall` | `mpv_init` ne répond jamais (la page abandonne après 8 s) |
| `load` | tout `loadfile` finit en `end-file` en erreur de chargement (−13) — le cas ambigu : la page bascule si le flux répond à sa sonde, sinon elle dit « connexion perdue » |
| `fatal` | la lecture en cours tombe, une fois |
| `absent` | aucun canal `mpv_*` : pas de lecteur natif (au lancement seulement) |
| `off` | rien |

En route, depuis la page (menu de débogage, outils de développement) :
`tentacle.invoke("mpv_debug_fault", { mode: "fatal" })` → `{ mode, fired }`. Un mode reste
jusqu'au suivant, sauf `fatal`. La bascule est mémorisée pour la session de la page : recharger
la page (ou `cancelFallbackSwitch()`, `apps/web/src/lib/fallbackPlayer.ts`) rend sa chance à mpv.

## Autres commandes

Depuis `apps/desktop-cef` (ou `pnpm --filter @tentacle-tv/desktop-cef <script>`) :

```bash
pnpm banc up        # banc local (colima) ; `pnpm banc` affiche son état
pnpm dev:server     # mode des bancs : page servie par le banc (ou $TENTACLE_URL), profil à part
pnpm build          # le build natif seul (Release, ~/.cache/tentacle-cef/build/tv)
```

Détails des bancs : [docs/REPRISE.md](docs/REPRISE.md) (« Lancer », « Comment tester » — leurs
commandes `pnpm dev` y désignent aujourd'hui `pnpm dev:server`).
