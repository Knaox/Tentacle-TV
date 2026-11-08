# Recette du lot « app CEF » (axe `recette`)

Une commande, rejouable, sur un `.app` donné ; sortie en tableau ; code de retour = nombre de cas
en échec :

```bash
scripts/recette.sh --app ~/.cache/tentacle-cef/build/integration/Tentacle.app
```

Phases (dans l'ordre ; on peut n'en nommer que certaines) : `banc`, `fake-edr`, `video`, `saisie`,
`octave`, `socle`. Journaux : `~/.cache/tentacle-cef/build/recette/passe-<MMJJ-HHMM>/` (`tableau.tsv`,
`tableau.txt`, un journal par passe). Toujours muet (`--mute` + `TENTACLE_MUTE=1`). Chaque passe
qui affiche une fenêtre prend le verrou d'écran du lot et le rend aussitôt.

| Phase | Ce qui est prouvé | Par quoi |
|---|---|---|
| `banc` | Tentacle 1.42.0 `:3471` et Jellyfin `:8471` répondent | HTTP 200 |
| `fake-edr` | le compositeur seul (couche `--fake-video=edr:4`, sans mpv) : page trouée, page opaque et page vide > 1 (macOS accorde la marge même à une couche masquée), repos 1,00 | `scripts/banc-socle-edr.sh`, sonde externe |
| `video` (`edr-*`) | par titre (HDR10, DV, SDR) : référence 1,00 avant (rémanence attendue jusqu'à 30 s), EDR fenêtré avec les contrôles de la page au-dessus, plein écran ATTEINT (SDL taille = écran, `NSWindowStyleMaskFullScreen`, serveur de fenêtres : fenêtre = écran, couche `TentacleVideoLayer` = écran et swapchain = écran × échelle), EDR en plein écran, sortie, retour ; HDR > 1, SDR = 1,00 ; témoin interne `pont.debug.surface` cohérent | `bench/hdr/recette-video.mjs`, `edr-probe`, `tools/edr-probe/win-state.swift` |
| `video` (`pont-*`, `robustesse`) | scénario du pont (11 cas par titre) et robustesse (7 cas) | `web/shim/dev/scenario-{video,robustesse}.mjs` |
| `saisie` | touches NATIVES (`--debug-input`, app au premier plan, profil neuf) : Entrée sur la vraie page `/login` (keydown → keypress → keyup, la page quitte `/login`), `navigator.language` = première langue du système et `navigator.languages` dans son ordre, F11 et ⌃⌘F : plein écran puis fenêtré (NSWindow et serveur de fenêtres), ⌘Q en pleine lecture → l'app sort d'elle-même avec le code 0 | `tests/saisie/connexion.mjs`, `bench/hdr/recette-saisie.mjs` |
| `octave` | musique sous CEF, bascule musique → vidéo → musique | `web/shim/octave-cef.mjs` |
| `socle` | saisie, IME, popups, défilement, plein écran natif, 120 Hz réel, redimensionnement, repos | `scripts/banc-socle.sh` |

Variables : `RECETTE_TITRES="hdr10 dv sdr"`, `RECETTE_PONT=0` (EDR et plein écran seuls),
`RECETTE_FOREGROUND=1`, `TENTACLE_CEF_CACHE`, `EDR_PROBE`.

## Passes

### Passe 0 — 04/11 14:30–14:40, intégration `3b8e1a38` (`build/integration`), écran déverrouillé

Journaux : `~/.cache/tentacle-cef/build/recette/passe-1104-1400/`. **140 OK, 14 KO** au tableau
brut ; après analyse, **aucune régression de l'app** — les 14 KO viennent de la recette ou du banc :

| # | KO | Cause | Suite |
|---|---|---|---|
| 1 | `edr-*` × 3 : « plein écran : SDL / serveur de fenêtres / couche à la taille » (9 KO) | ma mesure : sur un écran à encoche, le plein écran natif s'arrête SOUS la barre des menus (fenêtre 1512×949 à y=33 sur un écran 1512×982). SDL, le serveur de fenêtres et la couche disent tous 1512×949, swapchain 3024×1898 : cohérent | corrigé (`933d045`, `win-state` : marge = barre des menus) |
| 2 | `edr-hdr10` : EDR fenêtré 1,00 et « fenêtre sur l'écran 0 » vide | la fenêtre n'était pas à l'écran courant au moment de la mesure (liste du serveur de fenêtres vide ; lancée `--background`, premier titre juste après le déverrouillage). Le plein écran qui suit donne 8,74, et DV fenêtré 8,74 | la recette attend désormais la fenêtre à l'écran ; à rejouer |
| 3 | `robustesse` : aucun cas lu | banc : « Banc Disparu (2026) » n'est plus dans l'index Jellyfin (une analyse de bibliothèque l'a retiré, son fichier manquant) | rétabli par `bench/hdr/banc-disparu.mjs`, désormais lancé par la phase `banc` ; à rejouer |
| 4 | `fake-edr` : B (page opaque) 8,74 au lieu de 1,00, repos final 8,74 | rémanence : le banc mesurait B 4 s après A et le repos 1 s après C | `banc-socle-edr.sh` attend 1,00 avant chaque cas ; au rejeu B reste 8,74 : c'est le comportement de macOS, déjà mesuré par le socle le 03/11 (8,439) — l'attendu « 1,00 » de l'en-tête du banc était faux, corrigé |

Ce qui est vert (preuves dans le tableau) :
- **EDR** : DV fenêtré **8,74**, HDR10 et DV plein écran **8,74**, SDR **1,00** fenêtré et plein
  écran ; référence 1,00 avant chaque titre ; `--fake-video=edr:4` page trouée et page vide 8,74.
- **Plein écran réellement atteint** pour les 3 titres : `window://fullscreen` vrai, SDL
  `fullscreen=true` 1512×949, serveur de fenêtres 1512×949 à y=33 (sous l'encoche), couche
  `TentacleVideoLayer` 1512×949, swapchain 3024×1898 ; sortie : SDL 1280×800.
- **Témoin interne `pont.debug.surface`** : VRAI écran déverrouillé, fenêtré et plein écran —
  `kCGColorSpaceITUR_2100_PQ`/`BGR10A2Unorm`/`wantsEdr`/métadonnées en HDR10 et DV,
  `kCGColorSpaceITUR_709` sans EDR en SDR. Journal de couche : une seule couche née par lecture,
  réglée par MoltenVK en ~90 ms, retirée au retour. Le témoin faux du 03/11 14:25 n'est pas
  reproduit (ni écran verrouillé à 13:42, ni déverrouillé à 14:31) : rien à corriger dans
  `VideoSurface::colorState()` ; la recette le contrôle désormais à chaque passe.
- **Pont** : 11/11 par titre (HDR10, DV, SDR) — lecture, pause/reprise, seek, pistes audio et
  sous-titres, plein écran aller-retour, fin, retour. `mute = yes` partout.
- **Octave** : tous les cas, couches vidéo 0 → 1 (HDR10, gamma pq) → 0 → 0.
- **Socle** : 21/21 — 120 Hz réel (`presentedFps` 120, intervalle moyen 8,40 ms), IME, popups,
  défilement, Retina, plein écran natif, redimensionnement en direct, fermeture propre ; repos :
  1 image en 10 s, CPU cumulé 0,23 s sur 10 s (tous processus).

### Rejeu de la passe 0 — 04/11, terminé à 15:43, même intégration `3b8e1a38`, recette `933d045`

Journaux : `passe-1104-1442/` (phases `banc`, `video`, `fake-edr`). **88 OK, 1 KO**, et ce KO
n'en est pas un (attendu corrigé ensuite) :
- HDR10 fenêtré **8,74** (la fenêtre attendue à l'écran), DV 8,74, SDR 1,00 ; plein écran ×3 :
  SDL 1512×949, serveur de fenêtres 1512×949 à y=33, couche 1512×949, swapchain 3024×1898 → ✅.
- Robustesse **7/7** (média introuvable → écran d'erreur, « Retour à la fiche », lecture suivante,
  épisode 1 → 2 en nouvelle instance, « Retour » en lecture).
- `fake-edr` B (page opaque) **8,74** : même valeur sur `build/socle` (03/11) et `build/ram-avant`
  (`0f9aa5f`) → pas une régression ; macOS accorde la marge à toute couche `wantsEDR` de l'arbre.

**Verdict passe 0 : intégration `3b8e1a38` conforme, aucun défaut à renvoyer à un axe.**

### Passe 1 — 04/11 17:46–18:58, intégration `007eba8`

**`build/integration`** (`passe-1104-1746/`) : **171 OK, 1 KO**, et ce KO venait de la recette :
`recette-saisie.mjs` sortait en 13, car il attendait la réponse de ⌘Q d'une app déjà fermée. Tous
les cas de la phase sont verts ; le correctif est `78312d4`.
- EDR : HDR10 et DV **8,74** fenêtré et plein écran, SDR **1,00** ; plein écran ×3 : SDL, serveur
  de fenêtres et couche 1512×949 sous l'encoche ; `fake-edr` A/B/C 8,74, repos 1,00.
- Saisie : Entrée valide `/login` (`keydown:Enter:13 | keypress:Enter:13 | keyup:Enter:13`) ;
  `navigator.language` **fr-CH**, `navigator.languages` `["fr-CH","fr","en-AU","en"]` (système
  `fr-CH, en-AU`) ; F11 et ⌃⌘F : NSWindow et serveur de fenêtres true → false ; ⌘Q en lecture
  (time-pos 2,2 s) → **code 0**.
- Pont 33/33, robustesse 7/7, Octave 50/50 ; socle 22/22, `presentedFps` 119 sur 120 Hz ; repos :
  1 image en 10 s, CPU 0,15 s.

**`build/integration-dist`** (le `--dist`, 17:46) : **ne démarre pas**.
`dyld: Library not loaded: @rpath/libSDL3.0.dylib … Reason: no LC_RPATH's found`.
`scripts/deps/embed-dylibs.sh:63` n'ajoute `@executable_path/../Frameworks` que si
`otool -l` ne contient pas déjà cette chaîne. Or, depuis que le framework CEF est lié (ram
jalon 1), la chaîne figure dans le chemin de chargement du framework
(`@executable_path/../Frameworks/Chromium Embedded Framework.framework/…`). Le test réussit donc
à tort : les rpath absolus sont retirés et aucun n'est ajouté. → **défaut renvoyé à `paquet`**.
Le test doit viser les `LC_RPATH` seuls, par exemple
`otool -l | awk '/cmd LC_RPATH/{getline;getline;print $2}'`.

**`--dist` avec le seul rpath ajouté** (copie `build/recette-dist-rpath`,
`install_name_tool -add_rpath @executable_path/../Frameworks` puis signature ad hoc ;
`passe-1104-1848/`) : **172 OK, 0 KO**. Les valeurs sont les mêmes que celles de
`build/integration` : EDR 8,74 / 8,74 / 1,00, plein écran 1512×949, saisie 7/7, ⌘Q → code 0,
socle `presentedFps` 119, repos CPU 0,11 s.

Au passage, la recette ne rendait pas le verrou d'écran quand l'app ne démarrait pas : elle
tentait `rmdir` alors que `qui` était encore dans le dossier, et la phase suivante attendait donc
son propre verrou (18:05–18:47, signalé par `ram`). Corrigé dans `93b2be7`.

**Verdict passe 1** : l'intégration `007eba8` est conforme. Un seul défaut : le `--dist` ne démarre
pas (rpath, `paquet`).

### Passe 2 — 04/11 20:38–21:17, intégration `e17418a` (rpath, `hwdec-threads=1`, couche web détruite quand transparente)

Les deux builds viennent du même checkout et datent de 20:35. Le `--dist` démarre tel quel, son
seul `LC_RPATH` étant `@executable_path/../Frameworks` ; aucun rpath n'a été ajouté à la main.

| | `build/integration` (`passe-1104-2038/`) | `build/integration-dist` (`passe-1104-2044/`) |
|---|---|---|
| Total | **171 OK, 0 KO** | **171 OK, 0 KO** |
| EDR HDR10 fenêtré / plein écran | 8,74 / 8,74 | 8,25 / 8,25 (voir plus bas) |
| EDR DV fenêtré / plein écran | 8,74 / 8,74 | 8,25 / 8,25 |
| EDR SDR fenêtré / plein écran | 1,00 / 1,00 | 1,00 / 1,00 |
| Témoin interne, fenêtré | PQ / BGR10A2 / EDR / métadonnées (HDR), 709 sans EDR (SDR) | idem |
| Plein écran (×3) | couche 1512×949, swapchain 3024×1898 | idem |
| `fake-edr` A / B / C, repos | 8,74 ×3, 1,00 | 8,74 / 8,74 / 8,25→8,63, 1,00 |
| Saisie | 7/7 (fr-CH, F11, ⌃⌘F, ⌘Q en lecture → code 0) | 7/7 |
| Pont, robustesse, Octave | 33/33, 7/7, 50/50 | 33/33, 7/7, 50/50 |
| Socle : cadence, repos | `presentedFps` 119 ; CPU 0,07 s / 10 s | `presentedFps` 120 ; CPU 0,14 s / 10 s |

**EDR fenêtré à 8,25 sur le `--dist` : ce n'est pas le `--dist`, c'est l'écran.** Le plafond de
marge de l'écran a baissé pendant la passe. À 20:46, le cas C de `fake-edr` (couche factice, sans
mpv ni page) est descendu de 8,74 à 8,25 en cours de mesure. Rejoué à 21:10 sur
`build/integration` (`passe-1104-2110/`), `fake-edr` donne **8,251** sur A, B et C, alors que ce
même build donnait 8,74 à 20:40. La marge dépend de la luminosité courante de l'écran (luminosité
automatique, le soir). La vidéo du `--dist` (21:06) a donc été mesurée sous un plafond de 8,25 : HDR10 et DV y
atteignent le plafond fenêtré comme plein écran. `hwdec-threads=1` et la couche web détruite ne
font pas baisser l'EDR fenêtré.

**Verdict passe 2** : `e17418a` est conforme, en `build/integration` comme en `--dist`. Aucun
défaut à renvoyer.
