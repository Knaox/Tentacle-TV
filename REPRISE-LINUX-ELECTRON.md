# Reprise — migration Linux : Tauri → Electron

Colle ce fichier (ou son chemin) au démarrage d'une nouvelle session. Il contient
la consigne, l'état réel, ce qui a été mesuré, et le point de blocage.

---

## 1. La consigne, telle qu'elle a été donnée

> Ton job est de migrer Tauri Linux vers Electron. Tu dois cartographier toutes
> les adaptations à faire sur Linux, et faire en sorte que Tentacle TV tourne sur
> Electron parfaitement, avec les téléchargements hors ligne possibles sur
> Electron Linux, la mise en veille automatique, etc. — **vraiment tous les
> comportements Windows et macOS doivent être présents aussi sur Linux.**
>
> Si tu as des questions, pose-les **en non-dev**, avec recommandation et
> explication de ce que ça change.
>
> **Max 300 lignes de code, commit à chaque étape.** On travaille sur une
> **branche Linux dédiée (localement)**.
>
> Tentacle doit être compatible avec **toutes les distributions** (Ubuntu, Debian,
> Arch, Fedora, etc.). **Le HDR doit être 100 % fonctionnel** : il marche sur
> macOS et Windows, il doit marcher sur Linux aussi (journal de debug graphique
> mis à jour pour Linux).
>
> Recherches sur internet autorisées, mais **tout doit fonctionner parfaitement**.
>
> Mettre à jour « À propos » dans l'app, bumper la version, changelog complet,
> mettre à jour les README et la doc GitHub pour Linux, mettre à jour les
> workflows GitHub. **On garde le système d'une commande qui installe tout selon
> l'OS** (détecte l'OS, installe proprement, s'épingle proprement dans
> l'emplacement des applications de chaque OS).

**Règles de travail complémentaires** : ne pas taguer, ne pas pousser, ne pas
déclencher de CI sans demande explicite. `pnpm lint` + `pnpm typecheck` verts
avant chaque commit. Commits en français, un par étape.

**Arbitrages déjà validés par l'utilisateur** (ne pas les rouvrir) :
- Montage vidéo **adaptatif** : Wayland → HDR + lecture plein écran ; X11 →
  lecture fenêtrée sans HDR ; un réglage force l'un ou l'autre.
- Version : **desktop 1.21.0** seul (le serveur reste à 1.13.0).
- **libmpv livrée dans le paquet**, pas dépendance système.
- Tauri **supprimé en fin de chantier** (c'est fait).

---

## 2. Où en est le travail

Branche locale **`feat/linux-electron`**, 30 commits, jamais poussée.
`main` = `80257cf9`.

`pnpm typecheck` vert partout, `pnpm lint` sans erreur, **290 tests passent**
(`pnpm --filter @tentacle-tv/desktop-electron test`).

### Ce qui est fait et vérifié
| Sujet | État |
|---|---|
| Dossier de données repris de Tauri (piège XDG) | ✅ testé |
| `libmpvPath()` pour Linux + repli système | ✅ testé |
| `LC_NUMERIC=C` avant chaque `mpv_create` | ✅ |
| Choix Wayland/X11 au lancement + réglage | ✅ testé |
| Surface vidéo **X11** (libX11 par koffi) | ✅ **mesuré dans un serveur X imbriqué** |
| Surface vidéo **Wayland** | ⚠️ **bloquée — voir §4** |
| Socle mpv (gpu-context, HDR, focus-on) | ✅ |
| Verdict HDR (`video-target-params`) | ✅ mesuré |
| Panneau de diagnostic Linux | ✅ |
| Anti-veille + renfort logind | ✅ mesuré (`systemd-inhibit --list`) |
| Auto-updater deb/rpm/pacman/AppImage porté | ✅ code + tests, **non éprouvé en vrai** |
| Empaquetage : les 4 formats sortent | ✅ produits localement |
| Intégration bureau (`.desktop`, icônes, WM_CLASS) | ✅ vérifié sur le paquet |
| Workflow CI réécrit, job `arch` supprimé | ✅ **jamais exécuté** |
| `install-linux.sh` (intégration AppImage, `--uninstall`) | ✅ **non éprouvé en vrai** |
| Tauri supprimé, pont web nettoyé | ✅ |
| README, RELEASE.md, CLAUDE.md, À propos, changelog | ✅ |
| Version 1.21.0 | ✅ |

### Ce qui reste à faire
1. **DÉBLOQUER LE MONTAGE WAYLAND** (§4) — c'est le seul vrai obstacle.
2. **Finir la compilation de la chaîne mpv** :
   `bash apps/desktop-electron/scripts/build-mpv-linux.sh --sortie ~/.cache/tentacle-mpv-linux`
   (tournait encore au moment de l'arrêt ; ~40 min). Puis empaqueter avec
   `--lib ~/.cache/tentacle-mpv-linux` et vérifier que le paquet lit du HEVC.
3. **MPRIS** — jamais commencé. C'est l'équivalent Linux du SMTC de Windows :
   touches média sous Wayland (`globalShortcut` y est inopérant en pratique) et
   vignette du média dans le panneau KDE/GNOME. Demande un serveur D-Bus :
   soit une bibliothèque JS pure, soit `libdbus-1` par koffi comme le WinRT.
4. **Éprouver en vrai** : l'updater (les 4 formats), `install-linux.sh`, une
   vraie session X11 de bureau, une installation par-dessus la 1.20.8 Tauri
   (les films téléchargés doivent survivre).
5. **CI** : le workflow n'a jamais tourné. Vérifier la compilation mpv en CI, le
   cache, et les 4 formats sur `ubuntu-22.04`.
6. `THIRD-PARTY-LICENSES.md` : compléter pour Linux (mpv GPL v2+, FFmpeg LGPL).
7. Commentaires « Portage de `apps/desktop/src-tauri/...` » dans
   `downloads/*.ts` : le chemin cité n'existe plus, reformuler.

---

## 3. Ce qui a été mesuré — à ne pas redécouvrir

Chaque ligne a coûté du temps. Le détail est dans `docs/LINUX-FENETRE-VIDEO.md`.

- **Tauri range ses données dans `~/.local/share`, Electron cherche `~/.config`.**
  Suivre `appData` recréait `tentacle-local.db` vide : médiathèque hors ligne et
  session effacées, sans message. Corrigé dans `cheminsDonnees.ts`.
- **`nativeHandle` lisait 8 octets ; sous Linux le descripteur en fait 4.**
  `mpv_init` échouait net (ERR_BUFFER_OUT_OF_BOUNDS), donc aucune vidéo, et le
  panneau annonçait « SDR » à juste titre — il n'y avait rien à décrire.
- **`transparent: true` doit être posé à la CONSTRUCTION.** Le geste de Windows
  (`setBackgroundColor` à l'exécution) ne marche pas : 7,3 % de vidéo visible
  contre 19,2 %, le reste peint en noir. Linux se range du côté de macOS.
- **`target-colorspace-hint` : `yes` et `auto` sortent du HDR quel que soit le
  contenu ; `no` supprime la transmission.** `auto` ne décide de rien sous
  Wayland (mpv#16305). `yes` sans condition.
- **Le verdict HDR se lit sur le COUPLE** `video-params` / `video-target-params`.
  Sur un écran laissé en HDR, un contenu SDR sort aussi en `pq`. Seul le couple
  distingue transmission et tone-mapping.
- **Le backend X11 de mpv est GPL-only** : `Feature x11 cannot be enabled: the
  build is not GPL!`. Une libmpv LGPL n'a **aucune** sortie vidéo sous X11. mpv
  est donc bâti en GPL pour Linux (FFmpeg reste LGPL, ni x264 ni x265).
- **La libmpv des distributions n'a pas de décodeur HEVC** (mesuré sur Fedora
  44 : `(no decoders)`). D'où la chaîne livrée.
- **Sous X11, un compositeur est nécessaire** : 0 % de vidéo visible sous
  openbox nu, 92,7 % dès que picom tourne. Sans composition, X11 ne mélange pas
  le canal alpha.
- **`powerSaveBlocker` ne retient pas logind** sous Wayland : `isStarted()`
  répond `true`, `systemd-inhibit --list` ne montre rien à nous. Renfort par
  `systemd-inhibit` (l'inhibiteur EST un descripteur de fichier, il se libère
  même si l'app meurt mal).
- **mpv n'accepte que le nom de CONNECTEUR** pour `fs-screen-name` (`DP-3`), pas
  le libellé d'Electron. Le pont passe par l'EDID du noyau (`linux/ecrans.ts`).
- **XWayland est cassé pour Electron sur ce poste** (Bazzite/SELinux, Mesa
  `dri_gbm.so` refusé). Ce n'est PAS un défaut du code ; le montage X11 a été
  validé dans un serveur X imbriqué.
- **`vendor/` est exclu par le `.gitignore`** (bloc auto-géré Nextcloud) : les
  binaires vivent dans `apps/desktop-electron/lib/{mpv,mpv-linux}`.
- **`productName` doit être la forme COURTE** pour electron-builder : rpm refuse
  une espace dans un nom de paquet.
- **`desktopName` + `syncDesktopName`** sont indispensables, sinon le bureau ne
  rattache pas la fenêtre au lanceur (deux icônes, épinglage cassé). Vérifié :
  `WM_CLASS = "tentacle-tv"`.

---

## 4. LE BLOCAGE — l'empilement sur Wayland

**Symptôme** : les deux fenêtres sont bien plein écran sur le même moniteur,
mais **celle de mpv est devant** et masque l'interface. La vidéo se voit
(7,3 % → tout l'écran), le repère HTML non (0,01 % au lieu de 0,34 %).

**Cause** : sur Wayland, l'ordre d'empilement se décide au **mappage**, et la
dernière fenêtre mappée gagne. Dans l'application réelle, notre fenêtre existe
depuis le lancement ; celle de mpv naît au premier `loadfile`, donc **après**.
Wayland interdit par conception à une application de se remonter elle-même sans
jeton d'activation issu d'un geste utilisateur.

**Tout ce qui a été essayé, et qui ne marche pas** (KWin 6.7.4) :

| Remède | Résultat |
|---|---|
| `win.focus()` après `loadfile` | aucun effet |
| `win.moveTop()` | aucun effet |
| `win.hide()` + `win.show()` + `focus()` | aucun effet |
| `setFullScreen(false)` puis `true` | aucun effet |
| `setAlwaysOnTop(true, "screen-saver")` | aucun effet (non supporté sur Wayland) |
| `mpv --focus-on=never` | posé, mais ne change pas l'empilement au mappage |

**Ce qui marche** (mesuré) : quand la fenêtre Electron est mappée **après** celle
de mpv, elle est devant et la vidéo se voit au travers (19,2 % de rouge, repères
à 0,57 %). C'est le seul levier connu.

**Pistes non encore testées, par ordre de coût croissant** :
1. `app.focus({ steal: true })` — non testé (session arrêtée avant).
2. Entrer en plein écran **après** que mpv ait mappé sa fenêtre, sans passer par
   un `false`/`true` immédiat (délai franc). Partiellement testé, non concluant.
3. **Fenêtre de lecteur séparée**, créée au démarrage de la lecture donc mappée
   après mpv. Change l'architecture de la page (SPA dans deux fenêtres).
4. **Surimpression dessinée DANS mpv** (`overlay-add` alimenté par le rendu hors
   écran d'Electron, entrées renvoyées par IPC mpv). Robuste et indépendant du
   compositeur, mais gros chantier (~1000 lignes) et fidélité d'interaction à
   éprouver (glisser la barre de progression, survols, molette).
5. Se rabattre sur X11 par défaut et n'offrir Wayland qu'en mode HDR assumé.

**Le chemin X11 n'est pas concerné** : il fonctionne, calage et empilement
compris (`XLowerWindow` + `XRaiseWindow` passent par le gestionnaire de fenêtres).

---

## 5. Comment travailler sur ce poste

- **Tout passe par `host-spawn`** : Claude tourne dans un conteneur Ubuntu,
  l'utilisateur et les outils sont sur l'hôte Bazzite.
  `host-spawn -- bash -lc '…' 2>&1 | tr -d '\033' | sed 's/\[6n//g;s/\]1[01];?//g'`
- Node de l'hôte, utilisable depuis le conteneur :
  `/home/knaox/.local/share/fnm/node-versions/v22.23.2/installation/bin/node`
- Binaire Electron : `node_modules/electron/dist/electron` (installé par
  `node node_modules/electron/install.js` — le postinstall est ignoré par pnpm).
- **Banc de mesure** : `~/.cache/tentacle-bench-linux/` — `main.js` (deux
  fenêtres + capture), `chemin-reel.js` (rejoue le chemin d'`ipc/video.ts`),
  `hdr-test.js`, `transparence.js`, `analyse.mjs` (compte les pixels d'une
  capture). Clips de test : `rouge.mp4` (SDR), `hdrpq.mp4` (PQ/bt.2020 réel).
- **Serveur X imbriqué** pour éprouver X11 depuis une session Wayland :
  `/tmp/x-imbrique.sh` lance `Xephyr :5` + `openbox` + `picom`. Le lancer
  **détaché** (`setsid nohup … &` + `disown`), sinon il meurt entre deux appels.
  Capture : `import -display :5 -window root fichier.png`.
- **Méthode** : ne jamais conclure sans compter les pixels. `spectacle -f -b -n
  -o` pour capturer, `analyse.mjs` pour compter rouge (vidéo) / vert et bleu
  (repères de l'interface) / noir (rien).
- Poste : Bazzite (Fedora 44), KDE Plasma 6.7.4 Wayland, RTX 5090 (pilote 610),
  trois écrans dont un 4K HDR (ASUS XG27UCDMG, DP-4, 980 nits) — les deux autres
  ne sont **pas** HDR, ce qui explique un verdict « TONE-MAPPÉ » légitime.

---

## 6. Points d'entrée du code

```
apps/desktop-electron/src/main/linux/
  sessionGraphique.ts   décision Wayland/X11 (pure, testée)
  session.ts            branchement Electron + montageLinux()
  fenetre.ts            transparent: true à la construction
  surfaceWayland.ts     ⚠️ le montage bloqué
  surfaceX11.ts         le montage qui marche
  x11.ts                libX11 par koffi
  ecrans.ts             EDID → connecteur, pour fs-screen-name
  optionsMpv.ts         socle mpv selon le montage
  hdr.ts                verdict HDR (couple video-params / target)
  veilleLogind.ts       renfort anti-veille
  miseAJour.ts          updater deb/rpm/pacman/AppImage
apps/desktop-electron/src/main/video/surface.ts   aiguillage par plateforme
apps/desktop-electron/scripts/build-mpv-linux.sh  chaîne mpv (GPL)
apps/desktop-electron/scripts/package-linux.mjs   les 4 formats
scripts/install-linux.sh                          la commande unique
docs/LINUX-FENETRE-VIDEO.md                       tous les relevés
```
