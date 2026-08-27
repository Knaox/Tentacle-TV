# Reprise — migration Linux : Tauri → Electron

Colle ce fichier (ou son chemin) au démarrage d'une nouvelle session. Il contient
la consigne, les règles, ce qui a été **mesuré**, et ce qui reste à faire.

> **Ne suppose rien de ce qui n'est pas écrit ici comme mesuré.** Les chiffres de
> ce document viennent tous d'un relevé sur la machine. Le reste — ce qui est
> listé « non vérifié » — est à éprouver, pas à croire.

---

## 1. La consigne

> Migrer le client desktop Linux de Tauri vers Electron. **Tous les comportements
> Windows et macOS doivent exister aussi sur Linux** : lecture native, HDR,
> téléchargements hors ligne, mise en veille automatique, plein écran, etc.
>
> Compatible avec **toutes les distributions** (Ubuntu, Debian, Arch, Fedora…).
> **Le HDR doit être 100 % fonctionnel** — il marche sur macOS et Windows.
>
> Recherches internet autorisées, mais **tout doit fonctionner parfaitement**.
> Questions à poser **en non-dev**, avec recommandation et explication de ce que
> ça change.
>
> Mettre à jour « À propos », la version, le changelog, les README, la doc GitHub
> et les workflows CI. **Garder le système d'une commande qui installe tout selon
> l'OS** (détection, installation propre, épinglage dans les applications).

### Règles de travail — non négociables

- **300 lignes MAX par fichier de code.** Au-delà : extraire (le dépôt a déjà ce
  réflexe — `ipc/videoSonde.ts`, `ipc/videoHdr.ts`, `playerDebugAffichage.ts`…).
- **Un commit par étape**, en français, dès que l'étape tient debout. Jamais de
  gros commit fourre-tout : une étape qui se révèle mauvaise doit pouvoir être
  annulée sans emporter les autres.
- **`pnpm lint` + `pnpm typecheck` + `pnpm --filter @tentacle-tv/desktop-electron
  test` verts AVANT chaque commit.**
- **Commiter ne vaut PAS publier : aucun `push`, aucun tag, aucun déclenchement
  de CI sans demande explicite.**
- **Ne jamais conclure sur le rendu sans compter les pixels** (voir §5).
- Toute chaîne d'interface nouvelle passe par l'i18n FR + EN
  (`packages/shared/src/i18n/locales/{fr,en}/`).

### Arbitrages déjà validés — ne pas les rouvrir

- Montage vidéo **adaptatif** : Wayland → HDR + lecture plein écran ; X11 →
  lecture fenêtrée sans HDR ; un réglage force l'un ou l'autre.
- Version : **desktop 1.21.0** seul (le serveur reste à 1.13.0).
- **libmpv livrée dans le paquet**, pas dépendance système.
- Tauri **supprimé** (fait).

---

## 2. État du dépôt

Branche locale **`feat/linux-electron`**, **49 commits**, jamais poussée.
`main` est à jour avec GitHub (`baaa4fa7`), la branche a été rebasée dessus.

```
pnpm lint       0 erreur (139 avertissements préexistants, non introduits ici)
pnpm typecheck  vert sur les 13 paquets
pnpm --filter @tentacle-tv/desktop-electron test   311 tests, tous verts
```

### Les 17 commits de code de la dernière session (plus ce document)

| Commit | Sujet |
|---|---|
| `cc9930ac` | chaîne mpv : embarque bz2 et consorts, audit `readelf` |
| `fc11bf3e` | le prefix de compilation se crée sur un `/tmp` vierge |
| `56b9649e` | mpv 0.41 ne connaît plus l'option meson `sdl2` |
| `d73a9b19` | erreur d'init mpv courte et utile jusqu'à la page |
| `3cbddbc0` | **FFmpeg statique dans libmpv, audio par pulse** |
| `2e9dab0c` | ne retenir une chaîne que si elle se CHARGE |
| `06dd13dd` | sans libmpv, la coquille annonce d'emblée le lecteur web |
| `51227cb8` | bascule de secours hors rendu, mémorisée, annoncée |
| `75f4e8d2` | **le plein écran existe sur Linux** — natif, comme macOS |
| `58b12d4a` | debug : chaque plateforme ne lit que ses lignes |
| `ddb51df3` | debug : transmission HDR au booléen + pic |
| `bd92b530` | debug : bouton déplaçable, panneau redimensionnable, persistés |
| `3381c6a8` | debug : interrupteur pour couper mpv et éprouver le repli |
| `3b2b4c82` | `TENTACLE_SANS_DEVTOOLS=1` pour des captures propres |
| `2f4c0327` | **réglage Wayland/X11 dans les Préférences** |
| `e0343de7` | **libplacebo bâtie avec glslang** — shaderc rendait le rouge violet |
| `77b4570b` | identifier l'écran par ce que la PAGE mesure (pure, **sans appelant**) |

---

## 3. Ce qui a été mesuré — à ne pas redécouvrir

### 3.1 Pourquoi mpv ne démarrait pas : TROIS causes empilées

Le symptôme de départ : « la vidéo se lance mais sans mpv, via le fallback ».
Trois défauts distincts se cachaient l'un derrière l'autre, chacun démasqué en
corrigeant le précédent.

**a) La chaîne compilée était inchargeable sur Fedora.**
11 bibliothèques réclamaient `libbz2.so.1.0` — un SONAME que seuls Debian et
Ubuntu fournissent (Fedora et Arch n'exposent que `libbz2.so.1`). La
vérification de fin de compilation (`ldd | grep "not found"`) tournait dans le
conteneur Ubuntu, **où tout se résout** : elle passait toujours. Remplacée par un
audit `readelf -d` des NEEDED contre une liste blanche de SONAME universels.
Rejouable seul : `bash apps/desktop-electron/scripts/build-mpv-linux.sh --audit <dossier>`.
Le motif `SYSTEME` n'était en outre **pas ancré** : `libm` avalait
`libmp3lame`/`libmpg123`/`libmd`, `libz` avalait `libzimg`.

**b) Electron embarque le FFmpeg de Chromium, et notre libmpv s'y liait.**
`node_modules/electron/dist/libffmpeg.so` exporte **858 symboles `av*` non
versionnés** en portée globale du processus. Résultat, dans `mpv_initialize` :

```
libavcodec: build version 61.19.101 incompatible with runtime version 62.33.100
```

`abort()` — l'application mourait avec un `exit code 1` et **aucune trace JS**.

- `RTLD_DEEPBIND` (koffi `{deep:true}`) **règle** ce point (`mpv_initialize` = 0)
  **mais** l'allocateur de Chromium interpose `malloc` : tout ce qui alloue d'un
  côté et libère de l'autre segfaulte. Piles lues au core dump :
  `pw_free_strv`, puis `pa_xfree`. **Écarté.**
- **Retenu** : FFmpeg lié en **statique** dans libmpv
  (`--disable-shared --enable-static --enable-pic`), symboles cachés
  (`-Wl,--exclude-libs,ALL`). Vérifié : `nm -D libmpv.so.2.5.0` → **0** symbole
  `av*` exporté, 54 `mpv_*`.
- Deux pièges du lien statique, tous deux rencontrés :
  `-Dprefer_static=true` de meson statifie AUSSI libass/fontconfig/glib, dont
  les `.a` d'Ubuntu ne sont pas PIC → lien impossible. La parade est de fusionner
  `Libs.private` dans `Libs` des seuls `.pc` de FFmpeg (le script le fait).

**c) `ao_pipewire` meurt entre deux versions de SPA.**
L'ABI de SPA est faite de macros **inline figées à la compilation**. Un
`ao_pipewire` bâti sur les en-têtes 1.0.5 d'Ubuntu 24.04 meurt dans la boucle de
données de la 1.6.8 de Fedora 44 — SIGSEGV dans `libspa-audioconvert`, pile au
core dump. Poser `ao=pulse` en **option** ne suffit pas. **Retenu** :
`-Dpipewire=disabled` à la compilation ; le son passe par **libpulse**, qui parle
un protocole *versionné* sur un socket (pipewire-pulse le sert partout), `alsa`
en repli.

### 3.2 Les couleurs étaient fausses, et rien ne le disait

Mesuré au pixel, même clip et même machine :

| libplacebo bâtie avec | `rouge.mp4` rendu |
|---|---|
| libshaderc 2023.8 (Ubuntu 24.04) | **(127,0,255) — violet** |
| glslang 15.1 | **(255,24,0) — rouge** |

Le journal de mpv ne signale rien : la swapchain choisie est la même
(`A2B10G10R10_UNORM_PACK32 + PASS_THROUGH`). **Corollaire de méthode : un rendu
aux couleurs suspectes se vérifie sur un aplat connu AVANT de soupçonner le HDR.**
⚠️ Toutes les mesures d'empilement prises avant ce correctif sont **à jeter** :
le clip rouge sortant violet, le compteur « rouge » ne comptait rien.

### 3.3 La collecte des dépendances embarquait trop

`ldd` liste la fermeture transitive **entière**, dépendances privées des
bibliothèques laissées au système comprises : `libgcrypt`, `libgpg-error`,
`libpulsecommon-16.1` (privée d'Ubuntu !), `libicu*`, `libxml2`… La collecte lit
désormais les **NEEDED directs** au `readelf` (`ldd` ne sert plus qu'à résoudre un
SONAME en chemin). **53 → 29 fichiers.**
`libglib-2.0` est en outre laissée au **système** : Electron la charge déjà (GTK),
et deux glib actives dans un processus finissent en `abort`.

### 3.4 Sur Wayland, `getBounds()` ment

Mesuré sur ce poste à trois écrans : une fenêtre en plein écran **sur l'ASUS**
rend `x=0 y=0`. `screen.getDisplayMatching()` désigne donc l'écran posé à
l'origine (le Dell) — et `SurfaceWayland.viserNotreEcran()` envoyait **mpv sur le
mauvais moniteur**. Le trio mesuré par la page — `innerWidth`, `innerHeight`,
`devicePixelRatio` — identifie l'écran, lui : vérifié au banc,
« ASUSTek XG27UCDMG (1920x1080@2) → DP-4 ».
`ecranPourMesure()` (`linux/ecrans.ts`, pure et testée) fait ce rapprochement.
**Elle n'a pas encore d'appelant.**

### 3.5 Acquis des sessions précédentes (toujours valables)

- **Tauri range ses données dans `~/.local/share`, Electron cherche `~/.config`.**
  Suivre `appData` recréait une base vide : médiathèque hors ligne et session
  effacées, sans message. Corrigé dans `cheminsDonnees.ts`.
- **`nativeHandle` lit 4 octets sous Linux**, pas 8.
- **`transparent: true` doit être posé à la CONSTRUCTION** (comme macOS, PAS
  comme Windows) : 7,3 % de vidéo visible contre 19,2 % sinon.
- **`target-colorspace-hint=yes`** sans condition sur Wayland (`auto` n'y décide
  rien — mpv#16305).
- **Le verdict HDR se lit sur le COUPLE** `video-params` / `video-target-params` :
  sur un écran laissé en HDR, un contenu SDR sort lui aussi en PQ.
- **Le backend X11 de mpv est GPL-only** → mpv est bâti en GPL pour Linux
  (FFmpeg reste LGPL, ni x264 ni x265).
- **La libmpv des distributions n'a pas de décodeur HEVC** (mesuré sur Fedora 44).
- **Sous X11, un compositeur est nécessaire** : 0 % de vidéo sous openbox nu,
  92,7 % dès que picom tourne.
- **`powerSaveBlocker` ne retient pas logind** sous Wayland → renfort
  `systemd-inhibit`.
- **mpv n'accepte que le nom de CONNECTEUR** pour `fs-screen-name` (`DP-3`).
- **XWayland est cassé pour Electron sur ce poste** (Bazzite/SELinux, Mesa
  `dri_gbm.so` refusé) — ce n'est PAS un défaut du code.

---

## 4. Les tests passés, et leur résultat

### 4.1 Automatisés — 311 tests verts

+21 tests cette session :

| Fichier | Ajout | Ce qu'il garde |
|---|---|---|
| `video/mpvChargement.test.ts` | 4 (nouveau) | premier candidat qui s'ouvre gagne ; cause courte des écartés ; échec total nomme chaque chemin |
| `video/mpvLib.test.ts` | +5 | ordre des candidats Linux ; `TENTACLE_MPV_LIB` = choix explicite sans repli |
| `video/mpvOptions.test.ts` | +1 | une option refusée est tracée, jamais fatale |
| `fullscreen.test.ts` | +5 | **Linux n'avait AUCUN test** — plein écran natif, sortie, `quitter()` |
| `linux/session.test.ts` | 2 (nouveau) | aller-retour écrire/relire du choix de session |
| `linux/ecrans.test.ts` | +4 | `ecranPourMesure` : densité discriminante, jumeaux → `null` |

### 4.2 Sur la machine réelle (hôte Bazzite / Fedora 44, KWin 6.7.4 Wayland, RTX 5090 pilote 610)

| Test | Résultat |
|---|---|
| `dlopen` de la chaîne (python3 ctypes, hôte) | ✅ `api=0x20005` |
| `dlopen` dans Electron + koffi | ✅ |
| Audit `readelf` rejoué sur l'ANCIENNE chaîne | ✅ dénonce exactement les 5 SONAME divergents — preuve que l'audit voit ce que `ldd` ratait |
| Lecture HEVC main10 locale dans l'app réelle | ✅ `file-loaded`, `video-reconfig` ×2, lecture soutenue, aucun crash, hwdec vulkan, son 5.1 par pulse |
| **Repli à FROID** — `TENTACLE_MPV_LIB=/inexistant` | ✅ « aucune libmpv chargeable : lecteur natif tu » ; les 7 commandes mpv listées dans « restent a implementer » ; lecture directe au lecteur web **sans les 8 s de timeout** |
| **Repli à CHAUD** — libmpv Fedora (sans HEVC) forcée | ✅ `end-file(4)` → bascule → **bandeau « Lecteur de secours »** visible à l'écran (capture recadrée à l'appui), aucun avertissement React |
| Panneau de diagnostic à l'écran | ✅ lisible : verdicts, Démarrage, Réseau sortant (capture) |
| Couleur du rendu sur aplat connu | ✅ (255,24,0) après glslang — voir §3.2 |

### 4.3 Empilement Wayland — batterie de remèdes

Banc écrit cette session : `~/.cache/tentacle-bench-linux/chemin-e.js`.
Clip `rouge.mp4`, deux repères HTML 240×240 (vert haut-gauche, bleu bas-droite)
dans une fenêtre transparente ; capture au marqueur `MESURE`, comptage
`analyse.mjs`. **Références de la session précédente : bon = rouge 19,2 % /
repères 0,57 % ; mauvais = repères 0,01 %.**

Mesures **avec** la re-visée d'écran par densité (§3.4) ajoutée au banc :

| Remède | rouge | vert | bleu | écran atteint |
|---|---|---|---|---|
| témoin (`attach()` actuel) | 7,30 % | 0,57 % | 0,56 % | ASUS / DP-4 |
| `app.focus({steal:true})` | 7,30 % | 0,00 % | 0,00 % | Dell / DP-3 |
| plein écran après `file-loaded` + 300 ms | 7,30 % | 0,00 % | 0,00 % | Dell / DP-3 |
| **`hide()`+`show()`+plein écran+focus** | **20,29 %** | **0,57 %** | **0,59 %** | ASUS / DP-4 |
| **plein écran, 150 ms, `hide()`+`show()`+focus** | **20,29 %** | **0,57 %** | **0,59 %** | ASUS / DP-4 |

**Sans** la re-visée par densité, les cinq remèdes donnaient tous 7,30 %.

Lecture honnête de ce tableau : les deux variantes de **re-mappage** (`hide`+
`show`) sont les seules à remplir les deux critères — vidéo ≥ 15 % **et** repères
≥ 0,3 % — et elles dépassent la référence « bon ». Le vol de focus seul ne marche
pas. **Le mécanisme exact n'est pas établi** (pourquoi la re-visée change le
résultat de `remap` alors que `fs-screen-name` est censé ne valoir qu'à la
prochaine entrée en plein écran) : à confirmer avant d'écrire le code.

⚠️ **Rien de tout cela n'est dans l'application** : `surfaceWayland.ts` est
**inchangé**. Seule la fonction pure `ecranPourMesure` est commitée.

---

## 5. Ce qui reste à faire

### 5.1 Priorité — finir l'empilement Wayland

1. Reproduire le tableau §4.3 (le banc est écrit, il suffit de le relancer).
2. Isoler la part de chacun des deux gestes : re-visée d'écran seule, re-mappage
   seul, les deux. Aujourd'hui ils sont mesurés ensemble.
3. Si le résultat tient : brancher dans `linux/surfaceWayland.ts` —
   `ecranPourMesure()` pour la visée (elle attend un appelant), et le re-mappage
   séquencé sur l'évènement `file-loaded` relayé par `ipc/videoEvenements.ts`.
   Le `hide()`/`show()` doit rester **invisible** à l'usage : à éprouver à l'œil,
   pas seulement au compteur de pixels.
4. Consigner les chiffres dans `docs/LINUX-FENETRE-VIDEO.md` **quel que soit le
   résultat**.

### 5.2 Non vérifié — à éprouver avant de dire que ça marche

Tout ce qui suit est **écrit et vert en tests, mais jamais essayé en vrai** :

- **Plein écran Linux** (`75f4e8d2`) : les trois mesures prévues n'ont pas été
  faites — le banc X11 imbriqué (Xephyr) n'affichait plus rien cette session, la
  fenêtre Electron ne s'y mappait pas. À vérifier : (a) plein écran du lecteur
  **web** de secours sur Wayland, (b) F11 hors lecture, (c) mpv **fenêtré sous
  X11** puis plein écran — c'est là que Chromium pourrait couper l'alpha.
- **Le verdict HDR réel** : jamais relevé sur un contenu PQ dans l'app depuis la
  remise en état de la chaîne. Écran HDR du poste : **ASUS XG27UCDMG, DP-4**
  (les deux autres ne sont pas HDR — un verdict « TONE-MAPPÉ » y est légitime).
  Clip PQ : `~/.cache/tentacle-bench-linux/hdrpq.mp4`.
- **Le panneau après filtrage par plateforme** (`58b12d4a`) : vérifier à l'œil
  que « écran capable EDR », « couche Metal » et « bascule d'écran » ont bien
  disparu sur Linux, et que « sortie mpv » porte le bon verdict.
- **Bouton déplaçable / panneau redimensionnable** (`bd92b530`) : jamais essayé à
  la souris (impossible depuis le conteneur). Vérifier aussi que la position et
  la taille survivent au relancement, et le re-clamp quand la fenêtre rétrécit.
- **L'interrupteur M** (`3381c6a8`) : jamais actionné. Doit couper mpv **en
  pleine lecture** (démontage → `mpv_destroy` → lecteur web) et survivre au
  relancement.
- **Le réglage Wayland/X11 des Préférences** (`2f4c0327`) : jamais ouvert à
  l'écran. Vérifier les trois valeurs, l'affichage du montage courant, le bouton
  « Relancer maintenant », et que `~/.local/share/…/session-graphique.json` porte
  bien le choix.
- **X11 de bout en bout** : rien de mesuré cette session.

### 5.3 Chantiers non commencés

1. **MPRIS** — l'équivalent Linux du SMTC de Windows : touches média sous Wayland
   (`globalShortcut` y est inopérant) et vignette dans le panneau KDE/GNOME.
   Demande un serveur D-Bus : bibliothèque JS pure, ou `libdbus-1` par koffi.
2. **Éprouver l'updater** (deb/rpm/pacman/AppImage), **`scripts/install-linux.sh`**,
   et une **installation par-dessus la 1.20.8 Tauri** — les films téléchargés
   doivent survivre.
3. **CI** : `.github/workflows/desktop.yml` a été réécrit mais **n'a jamais
   tourné**. Vérifier la compilation mpv en CI (~40 min), le cache, et la sortie
   des 4 formats sur `ubuntu-22.04`.
4. **`THIRD-PARTY-LICENSES.md`** : compléter pour Linux — mpv GPL v2+, FFmpeg
   LGPL, et les bibliothèques nouvellement embarquées (bzip2, zimg, LAME,
   mpg123, libmd).
5. **Changelog `changelogs/desktop.md`** : le bloc `[1.21.0]` ne mentionne pas
   encore le lecteur de secours, le plein écran Linux, ni le réglage de session.
6. Commentaires « Portage de `apps/desktop/src-tauri/…` » dans `downloads/*.ts` :
   le chemin cité n'existe plus, reformuler.

---

## 6. Comment travailler sur ce poste

- **Claude tourne dans un conteneur Ubuntu ; l'application et les outils
  graphiques sont sur l'hôte Bazzite.** Le pont est `host-spawn` :
  ```bash
  host-spawn -- bash -lc '…' 2>&1 | tr -d '\033' | sed 's/\[6n//g;s/\]1[01];\?//g'
  ```
- **Lancer l'app sur l'hôte** — `setsid nohup` ne survit pas ; passer par systemd :
  ```bash
  host-spawn -- bash -lc 'systemd-run --user --unit=tentacle-diag --collect \
    --setenv=TENTACLE_DEBUG_PANEL=1 --setenv=TENTACLE_SANS_DEVTOOLS=1 \
    --setenv=WAYLAND_DISPLAY=wayland-0 --setenv=TENTACLE_AUTOWATCH=1 \
    --working-directory=<repo>/apps/desktop-electron \
    bash -lc "pnpm dev > ~/.cache/tentacle-diag-dev.log 2>&1"'
  # arrêt : systemctl --user stop tentacle-diag
  ```
- **Variables utiles** : `TENTACLE_AUTOWATCH=1` (reprend le dernier film),
  `TENTACLE_DEBUG_PANEL=1` (panneau ouvert d'office), `TENTACLE_SANS_DEVTOOLS=1`
  (indispensable pour les captures — sinon DevTools couvre le panneau),
  `TENTACLE_MPV_LIB=<chemin|livree|homebrew>`, `TENTACLE_LINUX_SESSION=x11`.
- **Banc de mesure** : `~/.cache/tentacle-bench-linux/` — `chemin-reel.js` (rejoue
  le chemin d'`ipc/video.ts`), `chemin-e.js` (essais d'empilement, écrit cette
  session), `analyse.mjs` (compte rouge/vert/bleu/noir d'une capture),
  clips `rouge.mp4` (SDR) et `hdrpq.mp4` (PQ réel).
- **Capturer** : `spectacle -f -b -n -o /tmp/x.png` (Wayland), puis
  `node analyse.mjs /tmp/x.png`. Pour lire une couleur exacte :
  `magick /tmp/x.png -crop 1x1+X+Y txt:`. **Toujours capturer sur un marqueur du
  journal**, jamais sur un `sleep` : une capture partie après la mort du
  processus montre un fantôme (l'erreur a été faite).
- **Piles de crash** : `coredumpctl list` puis `coredumpctl info <pid>` — c'est ce
  qui a démasqué les trois causes du §3.1.
- **La chaîne mpv** vit dans `apps/desktop-electron/lib/mpv-linux/` (gitignoré,
  29 fichiers), copiée depuis `~/.cache/tentacle-mpv-linux-v2`.
  La reconstruire : `bash apps/desktop-electron/scripts/build-mpv-linux.sh
  --sortie ~/.cache/tentacle-mpv-linux-v2` (~40 min si `/tmp` est vide ; le
  prefix `/tmp/tentacle-mpv-lgpl-linux` est encore chaud).
  ⚠️ **Chaque étape du script est gardée par un `[ ! -f … ]`** : changer une
  option sans supprimer l'artefact correspondant fait **sauter l'étape en
  silence** (l'erreur a été faite deux fois).
- Binaire Electron : `node_modules/electron/dist/electron` (hissé à la racine du
  workspace, pas dans `apps/desktop-electron/`).

---

## 7. Points d'entrée du code

```
apps/desktop-electron/src/main/linux/
  sessionGraphique.ts   décision Wayland/X11 (pure, testée)
  session.ts            branchement Electron + montageLinux()
  fenetre.ts            transparent: true à la construction
  surfaceWayland.ts     ⚠️ INCHANGÉ — c'est ici que va le correctif d'empilement
  surfaceX11.ts         le montage X11 (validé en serveur X imbriqué)
  x11.ts                libX11 par koffi
  ecrans.ts             EDID → connecteur ; ecranPourMesure() sans appelant
  optionsMpv.ts         socle mpv selon le montage
  hdr.ts                verdict HDR (couple video-params / target)
  veilleLogind.ts       renfort anti-veille
  miseAJour.ts          updater deb/rpm/pacman/AppImage
apps/desktop-electron/src/main/video/
  mpvChargement.ts      essaie les candidates, dit ce qu'il écarte
  mpvLib.ts             candidatsLibmpv() / libmpvPath()
  mpvFfi.ts             koffi.load + cache
  displayHdr.ts         transmissionRendu(), picRendu()
apps/desktop-electron/src/main/ipc/
  video.ts              commandes mpv, enregistrées seulement si libmpv charge
  videoHdr.ts           display_hdr_state / display_hdr_auto (inconditionnelles)
  linuxSession.ts       linux_session_get / set
apps/desktop-electron/src/main/fullscreen.ts   PLEIN_ECRAN_NATIF = darwin || linux
apps/desktop-electron/scripts/build-mpv-linux.sh   chaîne mpv (+ --audit)
apps/web/src/
  pages/Watch.tsx                       la porte : mpv / secours / interrupteur
  lib/lecteurSecours.ts                 store de la bascule de secours
  lib/lecteurNatif.ts                   interrupteur de debug (touche M)
  components/player/BandeauLecteurSecours.tsx
  components/settings/LinuxSessionSelect.tsx
  dev/                                  panneau de diagnostic (F9)
docs/LINUX-FENETRE-VIDEO.md             tous les relevés
```
