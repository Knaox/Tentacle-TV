# Mise à jour automatique du bureau CEF (axe `maj`, 04/11)

Les utilisateurs se plaignaient d'être avertis de **chaque** mise à jour. Désormais l'app se
met à jour seule sur les trois systèmes, et ne parle que quand ça compte.

| Gravité (manifeste) | Ce que fait l'app | Ce que voit l'utilisateur |
|---|---|---|
| `minor` | télécharge, vérifie, prépare en arrière-plan ; pose la mise à jour **à la fermeture** | **rien** |
| `major` (ou une mineure qui **traverse** une majeure jamais reçue : `majorSince`) | idem | **une** notification en bas à droite : progression, « Redémarrer pour mettre à jour », « Plus tard » (rappel 24 h après), « Ne plus m'avertir jusqu'à la prochaine grosse mise à jour » (mémorisé par l'appareil, levé par la majeure suivante), « Nouveautés ». Elle attend la fin d'une lecture. Sans clic, la mise à jour s'installe quand même à la fermeture |
| `critical`, ou version courante `< minVersion` | idem, sans attendre | **mise à jour de sécurité** : un voile bloque l'app tout de suite (lecture comprise), explique pourquoi (texte du manifeste), sans bouton pour le masquer ; « Redémarrer et installer » dès qu'elle est prête |
| obligatoire **sans réseau** / archive refusée / installation impossible ici | réessaie : 5 min, puis attente doublée à chaque échec, plafonnée à 6 h (4 s au banc) | un avertissement **qui ne bloque pas** (« en attente du réseau », « nouvel essai… » avec sa progression, ou « installez-la depuis tentacle.tv ») ; après un premier échec, le voile ne revient qu'une fois la mise à jour **prête** — jamais d'app bloquée qu'on ne sait pas mettre à jour |
| la nouvelle version ne démarre pas | retour à l'ancienne copie, version retenue comme mauvaise | « Mise à jour annulée », plus jamais reproposée |

Hors ligne au lancement : aucun contrôle, aucun blocage. Sans flux ni clé publique compilés
(builds de développement des autres axes), le moteur est **éteint** : aucun accès réseau.

## Sparkle 2 ou moteur maison : moteur maison

Sparkle 2 est la référence sur macOS et nous lui empruntons ses garanties (EdDSA/ed25519,
empreinte de l'archive, même équipe de signature, installation à la fermeture). Nous ne le
prenons pas :

- **Trois systèmes, une règle.** Sparkle n'existe que sur macOS (WinSparkle est un autre
  projet, autre format, autres règles ; rien pour Linux). La règle mineure / majeure /
  critique, le « ne plus m'avertir jusqu'à la prochaine grosse » et `majorSince` seraient
  écrits deux ou trois fois. Ici : `src/update/decision.cpp`, une fois, testée hors ligne —
  cas du brief, puis **balayée** sur 258 048 entrées contre 20 propriétés écrites à part
  (`src/update/tests/invariant_tests.cpp` ; 6 mutations de la règle, toutes attrapées).
- **La règle n'est pas celle de Sparkle.** Ses critiques (`sparkle:criticalUpdate`) et son
  `minimumAutoupdateVersion` existent, mais « silence pour une mineure, une notification pour
  une majeure, mémorisation jusqu'à la majeure suivante » demande de toute façon un
  `SPUUserDriver` maison — et la notification est une surcouche WEB (CEF), pas une fenêtre
  AppKit : on n'utiliserait de Sparkle que le téléchargement et l'installateur.
- **Pas de retour arrière** dans Sparkle si la nouvelle version ne démarre pas ; ici, période
  d'essai et retour automatique (assistant + compteur de lancements).
- **Poids.** Sparkle.framework (Autoupdate, Updater.app, services XPC) pèse quelques Mo (ordre
  de grandeur, non mesuré ici). Le nôtre, **mesuré** : +463 Ko sur l'exécutable (2 044 752 → 2 507 936 octets, moteur +
  libsodium statique) et 252 Ko d'assistant (`Contents/MacOS/tentacle-update`).
- **Bac à sable / MAS.** Hors Mac App Store (exclu par le brief), l'app est signée Developer ID
  et notarisée, sans bac à sable : elle peut remplacer son propre `.app` ; les services XPC de
  Sparkle, faits pour les apps en bac à sable, n'apportent rien. Une version MAS désactiverait
  le moteur (le Store met à jour), comme Electron aujourd'hui.

## Le flux (format)

Un seul fichier JSON servi en HTTPS (pas de course entre deux téléchargements), une
**enveloppe** :

```json
{ "format": 1, "keyId": "tentacle-2026", "manifest": "<texte JSON>", "signature": "<base64>" }
```

La signature ed25519 porte sur les octets UTF-8 du champ `manifest`. Plusieurs clés de
confiance (rotation) sont compilées : `-DTENTACLE_UPDATE_PUBLIC_KEYS=id:base64;id2:base64`.
Le manifeste :

```json
{
  "version": "1.43.0", "channel": "stable", "severity": "minor|major|critical",
  "minVersion": "1.40.0", "majorSince": "1.42.0", "issuedAt": 1793800000,
  "notes":  { "fr": "• …", "en": "• …" },
  "reason": { "fr": "pourquoi c'est obligatoire", "en": "…" },
  "notesUrl": "https://…",
  "assets": { "macos-arm64": { "url": "https://…/Tentacle-1.43.0-macos-arm64.tar.xz", "sha256": "…", "size": 124554676 },
              "linux-x86_64-appimage": { … }, "windows-x64-zip": { … } }
}
```

Refusés : enveloppe ou manifeste mal formés (lectures typées : jamais d'exception, jamais de
plantage) ; signature fausse ou clé inconnue ; manifeste plus ancien (`issuedAt`) que le
dernier accepté (rejeu pour cacher une mise à jour de sécurité) ; version ≤ courante ; autre
canal ; URL d'archive non HTTPS (HTTP seulement vers 127.0.0.1, et seulement si le flux est
lui-même local) ; archive plus grosse que sa taille signée (coupée en route) ou dont le SHA-256 diffère
(effacée, nouvel essai) ; paquet extrait dont l'identifiant, la version, le macOS minimum
(`LSMinimumSystemVersion`), l'architecture ou la signature ne conviennent pas (même **équipe**
que l'app en cours si elle est signée Developer ID ; signature valide seulement pour un build
ad hoc). L'assistant refait ces contrôles **juste avant l'échange** : une copie préparée
modifiée entre-temps est refusée. Une version préparée puis retirée du flux est abandonnée.
Aucun canal de la page ne valide une version : la « bonne santé » est constatée par le natif.
La clé de **test** (`TENTACLE_UPDATE_TEST_PUBKEY`) n'est acceptée qu'avec un flux sur la
boucle locale.

## Sur l'appareil

`<profil>/update/` (option `--update-state-dir`) : `state.json` (silence « jusqu'à la
prochaine grosse », rappel « Plus tard », versions revenues en arrière, dernier `issuedAt`),
`probation.json` (période d'essai), `helper.log`, la copie de l'assistant.

### macOS (construit, prouvé de bout en bout)

1. Téléchargement NSURLSession (session éphémère, sans cache), progression vers la page.
2. SHA-256 en arrière-plan, puis **préparation à côté de l'app** : `/Applications/.Tentacle.app.update/`
   (même volume), `tar` (xz/gzip/zip, `..` refusé), contrôles d'identité et de signature.
3. « Redémarrer » ou fermeture : l'app lance `tentacle-update` (copié hors du paquet, sa propre
   session, aucun descripteur hérité) puis quitte. L'assistant attend la fin du processus
   (kqueue), échange les deux dossiers **atomiquement** (`renamex_np(RENAME_SWAP)`, APFS ;
   repli à deux `rename` avec remise en place), garde l'ancienne copie en
   `.Tentacle.app.previous`, écrit la période d'essai.
4. Relance (si « Redémarrer ») avec les mêmes arguments. La nouvelle version se déclare en
   bonne santé 10 s après l'ouverture de sa fenêtre ; l'ancienne copie est alors effacée.
   Morte avant (plantage ou code de sortie non nul) : l'assistant remet l'ancienne et la
   relance ; fermée **proprement** par l'utilisateur, elle est gardée. Après une pose à la
   fermeture, c'est l'app qui compte ses lancements ratés (3 → retour arrière, avec
   l'assistant de l'ANCIENNE copie) ; une fermeture propre clôt l'essai. Sans ancienne copie
   (effacée, app déplacée), l'essai est clos au lieu de boucler.

Non couvert : la reprise d'un téléchargement interrompu et la réutilisation d'une copie
préparée après un redémarrage (tout repart de zéro) ; un plantage de la nouvelle version
AVANT `maj::install` après une pose silencieuse (le compteur vit dans le module : à avancer au
tout début de `runApp`, fichier du socle — les contrôles de macOS minimum et d'architecture
couvrent les cas connus) ; le filtrage des canaux `update.*` par l'origine de la page (seul le
serveur configuré est chargé). Un dossier non inscriptible (compte standard, `/Applications` d'un autre
utilisateur), une app lancée depuis l'image disque ou « transloquée » par Gatekeeper → pas
d'élévation de droits (Sparkle en a une) ; l'obligatoire prévient alors sans bloquer.

### Linux (construit et parcouru de bout en bout dans un conteneur, pas encore dans l'app)

`src/platform/linux/update_linux.cpp` : libcurl (≥ 7.62 ; listes de protocoles en texte à
partir de 7.85), redirections en https seulement ; **AppImage** seulement (`$APPIMAGE`),
clé `linux-x86_64-appimage` ou `linux-arm64-appimage` selon l'architecture ; échange atomique
`renameat2(RENAME_EXCHANGE)` (un exécutable en cours se renomme ; repli à deux `rename`).
La relance passe par un guetteur `sh` qui, comme l'assistant macOS, surveille la nouvelle version
90 s : morte avant sa bonne santé avec un code non nul (même avant `main`) → ancienne copie
remise, retour arrière noté, ancienne version relancée ; fermée proprement → gardée. Après une
pose à la fermeture, le compteur de lancements de l'app fait le retour arrière. Un paquet
`.deb/.rpm/pacman` relève du gestionnaire de paquets (dépôt signé) : `canSelfUpdate` répond
`package-manager`, le moteur se tait. Delta par zsync (AppImageUpdate) : suite possible.

**Éprouvé** par `pnpm test:update:cross` (`bench/update/cross-test.sh`) : conteneur Debian 12
dans la VM colima (vrai noyau Linux 6.8, aarch64), sans fenêtre, 2 cœurs / 2 Go. Règle et
moteur (158 vérifications), puis 6 parcours du **vrai moteur sur la vraie implémentation
Linux** (`src/update/tests/linux_e2e.cpp`, une fausse app par version, posée en fausse
AppImage) et un flux signé servi sur 127.0.0.1 (`bench/update/cross/linux-e2e.sh`) :

| Parcours | Vérifié |
|---|---|
| majeure | notifiée une fois prête ; « Redémarrer » ; échange ; relance par le guetteur ; bonne santé ; ancienne copie effacée |
| majeure relancée puis fermée proprement avant 10 s | gardée |
| mineure | aucune notification ; posée à la fermeture sans relance ; lancée à la main, bonne santé |
| critique | bloquante une fois prête, jamais muette |
| relance qui meurt avant le moteur (code 3) | le guetteur remet l'ancienne, retour noté, plus jamais reproposée |
| mineure posée qui ne tient pas | deux lancements ratés, retour arrière au 3e, ancienne relancée |

Ce parcours a trouvé un défaut du moteur commun, corrigé (`3d393e7`) : après un retour arrière
lancé, la période d'essai était réécrite sans `rolledBack` — invisible sur macOS (l'assistant
écrit après la sortie), fatal sous Linux (la version malade revenait).

### Windows (compilé et lié par mingw-w64, jamais exécuté)

`src/platform/windows/update_windows.cpp` + `src/update/helper/helper_windows.cpp` : WinHTTP ;
MSIX laissé à Windows (`msix-managed`) ; installation par utilisateur
(`%LOCALAPPDATA%\Programs\Tentacle`) : zip extrait par `tar.exe` à côté, remplacé après la
sortie par `tentacle-update.exe` (deux `MoveFileEx` réessayés 30 s, pas d'échange atomique de
dossiers sous Windows), période d'essai surveillée, retour arrière.

**Éprouvé** par `pnpm test:update:cross` : mingw-w64 12 (variante posix), libsodium statique
construite depuis la source Debian, liens complets (`-static`) du moteur, des tests, de
l'outil de vérification, de l'assistant et d'un exécutable qui tire toute l'implémentation
Windows (`tests/system_check.cpp`) ; 0 avertissement. Trouvé : l'assistant démarre par `wmain`
(`-municode` sous mingw), `appmodel.h` absent de mingw-w64 < 11. **Jamais exécuté** (ni Windows
ni wine ici) ; jamais compilé par MSVC.

### Ce qui reste pour Linux et Windows (impossible à faire ici)

Commun : le moteur, la règle, le flux, la surcouche et leurs tests sont les mêmes et passent
sur les trois. `helper-test.sh` et `dev-update.mjs` restent propres à macOS (PlistBuddy,
codesign, paquet `.app`).

Linux (AppImage) :
1. Brancher `tentacle_update_system` dans un build Linux de l'app — qui n'existe pas encore
   (fenêtre, compositeur, vidéo : ébauches) ; version par `-DTENTACLE_APP_VERSION=X.Y.Z`.
2. Une vraie AppImage (runtime type 2, squashfs monté) : relance par `$APPIMAGE`, arguments de
   `/proc/self/cmdline` vus depuis l'AppRun, profil CEF libéré avant la relance.
3. x86_64 (le banc a tourné en aarch64), ext4/btrfs/xfs, le repli à deux `rename`, un dossier
   non inscriptible (`/opt`), `xdg-open` pour les nouveautés, la surcouche dans la vraie fenêtre.
4. Plus tard : deltas zsync (champ `zsync` au manifeste) ; dépôts APT/DNF signés pour les paquets.
5. CI : un job AppImage dans `desktop-cef.yml` (le correctif ne contient que macOS) ; le banc
   croisé tourne tel quel sur un exécuteur Linux.

Windows (installation par utilisateur ; MSIX laissé à Windows) :
1. Construire avec MSVC (`vcpkg install libsodium:x64-windows-static`) dans un build Windows de
   l'app, qui n'existe pas encore ; version idéalement depuis la ressource VERSIONINFO.
2. Exécuter : `tentacle_update_tests.exe` (le premier passage réel), puis l'assistant.
3. Écrire le contrôle d'éditeur à la préparation : `WinVerifyTrust` sur `Tentacle.exe` et
   `tentacle-update.exe`, même certificat que l'app en cours (pendant du Team ID macOS), et le
   refaire dans l'assistant avant l'échange.
4. Éprouver : sous-processus de CEF qui retiennent le dossier, chemins longs, antivirus qui
   verrouille les fichiers fraîchement extraits, relance par la ligne de commande d'origine,
   `tar.exe` absent (Windows < 10 1803 : extraire en interne).
5. MSIX : décider du canal — Store, ou `.appinstaller` à mise à jour automatique — et dans ce
   cas le moteur ne fait qu'annoncer (`msix-managed`) ; l'obligatoire prévient.
6. Banc `dev-update` Windows et job CI (zip + flux signé), puis signature Authenticode.

## La notification (`web/shim/update-overlay.{js,css}`)

Injectée par le natif dans la frame principale (Shadow DOM : le front de Tentacle n'en sait
rien et n'a rien à changer), dans le verre sombre de Tentacle. Elle attend la fin d'une lecture :
route `/watch/…`, évènements mpv du pont (`start-file` → `end-file`), Octave qui joue. Le
voile de sécurité, lui, s'impose tout de suite et retient le clavier de la page.
`aria-live` poli (aucun vol du focus), `prefers-reduced-motion` respecté. Pas de notification
système quand l'app est en arrière-plan : la notification attend dans la fenêtre (non fait :
`UNUserNotificationCenter`, qui demanderait une autorisation au premier usage).

## Forcer une mise à jour (sécurité)

Depuis le serveur, sans rebâtir : relever `minVersion` (ou passer `severity: critical`) et
re-signer le flux. Dans la CI proposée : `versions.json` → `desktopCefMinVersion`, puis le cran
`manifest-only` du flux de travail. Les appareils en dessous ne peuvent plus continuer sans
installer — sauf hors ligne.

## La CI (correctif prêt, jamais appliqué : `docs/patches/maj-desktop-cef-ci.patch`)

Pour Tentacle-TV (`git apply` à la racine) : `.github/workflows/desktop-cef.yml` (construire
avec flux et clé publique compilés, tests, Developer ID + notarisation, archive `tar.xz`,
Release `desktop-cef-vX.Y.Z`, flux signé par `bench/update/make-manifest.mjs` avec le secret
`TENTACLE_UPDATE_SIGNING_KEY`, **relu** par `tentacle_update_verify` comme l'app le lira, poussé
dans `updates/desktop-cef/<canal>.json` sur main) ; `versions.json` → `desktopCefMinVersion` ;
`changelogs/desktop.md` : la gravité d'un bloc par `<!-- severity: major -->`, la raison d'une
critique dans `### Sécurité` / `### Security`.

## Commandes

```bash
pnpm test:update                                        # = bench/update/test.sh
pnpm test:update:cross                                  # Linux (parcours) et Windows (mingw), conteneur
pnpm dev:update -- --app=<.app> --preflight             # le paquet peut-il démarrer ? (sans fenêtre)
pnpm dev:update -- --severity=minor|major|critical      # = node bench/update/dev-update.mjs …
pnpm dev:update -- --severity=major --scenario          # parcours joué et vérifié jusqu'au redémarrage
pnpm dev:update -- --severity=major --broken --scenario # la nouvelle version ne démarre pas → retour arrière
```

`dev:update` vérifie d'abord, sans fenêtre, que chaque bibliothèque de l'app se résout
(`bench/update/preflight.mjs` : @rpath contre les LC_RPATH, @executable_path, @loader_path ;
code 3 sinon) : à faire AVANT de prendre le verrou d'écran. Puis il prend l'app construite (`scripts/build.sh maj`, ou `--app=…`), en installe une
copie en 1.0.0 dans `~/.cache/tentacle-cef/update-test/install/`, fabrique la nouvelle
version (1.0.1 / 1.1.0 / 1.0.2), son archive et le flux signé par une clé de TEST générée dans
`~/.cache/tentacle-cef/update-test/test-key.json` (jamais commitée), sert le tout sur
`127.0.0.1:8475` (débit limité `--rate=25` Mo/s pour voir la progression ; la critique coupe
le premier téléchargement en route pour montrer le cas « réseau perdu ») et lance l'app :
`--mute`, `--background`, DevTools 9315, profil `profiles/maj`, contre le banc (`:3471`) s'il
répond. Sans `--scenario`, l'app reste ouverte pour cliquer soi-même ; Ctrl+C arrête tout.
