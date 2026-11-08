# RAM et CPU au repos — Tentacle CEF contre le bureau Electron 1.42.0 (axe ram, 04/11)

MacBook Pro M4, écran Liquid Retina XDR (3024×1964, 120 Hz), macOS 26.6.2. Banc local
(Tentacle 1.42.0 `:3471`, Jellyfin 12.4 `:8471`), fenêtre 1280×800 points, une seule app à
l'écran (verrou du lot), fenêtre devant (`fenetres` le vérifie à chaque passe). Empreinte =
somme des `phys_footprint` (`footprint`) de TOUS les processus de l'arbre ; RSS = somme des
`ps -o rss`. Harnais : `bench/mesures/` — `porte.sh` (3 tours, ordre tournant), `passe.sh`
(5 scénarios), `fenetre.py`, `scenario.mjs`, `synthese.py` ; un levier à la fois :
`essai.sh` + `diag.py` ; détail Chromium : `memdump.mjs` ; CPU exact : `cpuns`,
`cpu_repos.py`, `cpufils` ; couche web à l'écran : `verif-couche.sh` ; chaîne de lecture seule :
`mpv_hote.m`.

## Verdict de la porte

**Dernière porte (intégration `e17418a`, § 2.4) : NON franchie** — HDR10 fenêtré +62, DV fenêtré +13 ;
accueil −8 (égalité), plein écran −39, Octave −23 ; RSS en dessous partout. Historique ci-dessous.

**Porte du 04/11 après-midi : NON franchie** : en empreinte (`phys_footprint`), Tentacle CEF reste au-dessus
d'Electron 1.42.0 en vidéo fenêtrée ; il est au niveau ou en dessous ailleurs. En RSS, il est en
dessous partout. Au repos, son CPU reste au double de celui d'Electron (0,2 % contre 0,1 % d'un cœur).

| Scénario | Empreinte CEF / Electron (Mo, médianes des deux portes) | Verdict empreinte | RSS CEF / Electron | Verdict RSS |
|---|---|---|---|---|
| Accueil au repos | 375 / 385 (porte 1) · 388 / 374 (finale) | **égalité** (±15, dans le bruit) | 499 / 634–654 | ✅ −135 à −155 |
| HDR10 fenêtré | 581 / 501 · 579 / 494 | ❌ **+80 à +85** (+16 %) | 627–631 / 701–714 | ✅ −74 à −83 |
| Dolby Vision fenêtré | 592 / 560 · 592 / 552 | ❌ **+32 à +40** (+6 %) | 650 / 715–734 | ✅ −64 à −84 |
| HDR10 plein écran | 663 / 682 · 686 / 654 | **égalité** (−19 / +32, forte dispersion CEF 662–725) | 658 / 723–738 | ✅ −65 à −80 |
| Octave, musique | 632 / 666 · 632 / 650 | ✅ **−18 à −34** | 684 / 761–772 | ✅ −77 à −88 |
| CPU au repos (exact) | 0,20–0,24 % / 0,10–0,15 % d'un cœur | ❌ ×2 (≈ +0,1 % d'un cœur) | | |

Point de départ (même harnais corrigé, `0f9aa5f`) : 562 / 746 / 753 / 828 / 806 Mo d'empreinte,
784–962 Mo de RSS, 6 processus, CPU au repos 1,7 % (ps). Gain : **−150 à −190 Mo d'empreinte,
−280 Mo de RSS, 6 → 4 processus, CPU au repos ÷ 7**.

Pourquoi la vidéo fenêtrée reste au-dessus (HDR10, +80 à +85 Mo), mesuré processus par processus
(§ 3) et chaîne de lecture à part (§ 3.1) :
- **≈ +40 Mo : la chaîne de lecture, pas CEF.** La même lecture (gpu-next, Vulkan, macvk, sortie PQ,
  VideoToolbox) dans un petit hôte sans CEF : libmpv d'Electron (mpv 0.40 + FFmpeg 7.1.1)
  253 Mo, mpv 0.41.0 de Homebrew + FFmpeg 9.0.2 287 Mo (+33), notre fork 0.41-dev + FFmpeg 9.0.2
  294 Mo (+7 de plus). **Cause (axe lecteur, § 3.1) : `--hwdec-threads` de mpv 0.41 (4 fils au
  lieu d'un), pas FFmpeg ; corrigé par `hwdec-threads=1` (`742767e`) : −16 Mo en HDR10, −17 en DV** ;
- **≈ +16 Mo : le drawable de la couche web** (rendu hors écran, structurel) ;
- **≈ +20 Mo : le processus GPU** (cible de rendu hors écran et capture) ;
- **≈ +8 Mo : le Renderer** (composants du « Chrome runtime » que n'a pas Electron).

## 1. Ce qui faussait la mesure de départ (03/11)

| Défaut | Effet | Correction |
|---|---|---|
| Modale « Nouveautés » jamais fermée côté CEF (bouton « Fermer » en `aria-label`) | l'« accueil au repos » de CEF était une page animée à 121 images/s : CPU 32 %, GPU 578–923 Mo | `041e0de` |
| Feuille « Choisissez votre personnage » arrivée après le dernier dismiss ; avatar focalisé animé sans fin | idem | `041e0de` |
| Passes 2-3 dans `/octave` | le front rouvre le MODE musique (`tentacle_octave_mode`) et renvoie « / » vers `/octave` | `cfcbcda` (bouton « Films et séries ») |
| Geste de souris relançant la bannière 20 s | les 30 s de repos en attrapaient la fin | `ee35606` |
| Session macOS verrouillée / écran éteint | rien n'est dessiné : EDR 1,00, GPU nul, Electron libère sa fenêtre occultée ; écran éteint (13:37–14:30), même CEF ne dessine plus (GPU 12 Mo) | `a38958f` (passe refusée), plus de `--background` |
| CPU par `ps -o cputime` | arrondi à 10 ms : ±0,05 % par processus sur 20 s, l'ordre de grandeur du repos | `1338864`, `ebc0c16` (`proc_pid_rusage`) |

## 2. Résultats

### 2.1 Porte 1 — avant (`0f9aa5f`) / après (`ed6d951`) / Electron, 14:47–15:35

Médiane de 3 passes (min–max), ordre tournant, écran allumé, fenêtres devant
(`~/.cache/tentacle-cef/build/ram-porte/1447/`).

| Scénario | Empreinte avant | Empreinte après | Empreinte Electron | RSS avant / après / Electron | Processus |
|---|---|---|---|---|---|
| Accueil au repos | 562 (513–847¹) | **375** (359–395) | 385 (383–385) | 784 / **499** / 654 | 6 / 4 / 4 |
| HDR10 fenêtré | 746 (729–752) | **581** (570–581) | 501 (470–502) | 911 / **631** / 714 | 6 / 4 / 4 |
| Dolby Vision fenêtré | 753 (732–762) | **592** (578–592) | 560 (557–565) | 930 / **650** / 734 | 6 / 4 / 4 |
| HDR10 plein écran | 828 (826–866) | **663** (661–670) | 682 (674–684) | 937 / **658** / 738 | 6 / 4 / 4 |
| Octave (musique) | 806 (787–810) | **632** (630–634) | 666 (665–672) | 962 / **684** / 772 | 6 / 4 / 4 |

¹ Passe 3 de l'avant : une animation a tourné pendant la fenêtre (CPU 9,9 %, 781 mW).

EDR (sonde externe) : CEF 8,74 dans les 6 scénarios HDR × 3 passes, avant comme après ;
Electron 1,00 en fenêtré dans 2 passes sur 3 (8,74 en plein écran). GPU : vidéo CEF ≤ Electron
(330 contre 362 mW en HDR10 fenêtré) ; musique CEF > Electron (165 contre 145 mW, § 6).

### 2.2 Porte finale — HEAD de la branche contre Electron

Médianes (min–max) ; une passe CEF a été écartée en partie (session verrouillée vers 16:46 :
DV, plein écran et Octave de la passe 1, rejouées en passe 4). CPU exact (`cpuns`).
`~/.cache/tentacle-cef/build/ram-porte/final-1643/`.

| Scénario | Empreinte CEF | Empreinte Electron | RSS CEF / Electron | CPU % cœur CEF / Electron | GPU mW CEF / Electron | EDR CEF / Electron |
|---|---|---|---|---|---|---|
| Accueil au repos | 388 (346–402), n=4 | 374 (374–395) | 499 / 634 | **0,2 / 0,1** | 3 / 2 | — |
| HDR10 fenêtré | 579 (572–588), n=4 | 494 (486–503) | 627 / 701 | 16,4 / 16,5 | **314 / 403** | 8,74 / 8,74 (1,00–8,74) |
| DV fenêtré | 592 (587–592) | 552 (542–556) | 651 / 715 | 16,0 / 16,8 | **256 / 395** | 8,74 / 1,00 (1,00–8,74) |
| HDR10 plein écran | 686 (662–725) | 654 (653–679) | 658 / 723 | 16,4 / 17,3 | **300 / 434** | 8,74 / 8,74 |
| Octave | 632 (632–636) | 650 (636–661) | 684 / 761 | 19,1 / 18,9 | 164 / 123 | — |

## 2.4 Porte sur l'intégration `e17418a` (jalons 3 de ram et 4 de lecteur) — 04/11 21:15–21:53

`build/integration` (couche web détruite quand la page est transparente, `hwdec-threads=1`),
3 passes valides de chaque côté, une passe par bloc de verrou (une passe Electron prise session
verrouillée, écartée et rejouée). `~/.cache/tentacle-cef/build/ram-porte/integ-2039/`.

| Scénario | Empreinte CEF / Electron | Écart | dont principal / GPU / Renderer / autres | RSS CEF / Electron | GPU mW CEF / Electron |
|---|---|---|---|---|---|
| Accueil au repos | 375 (349–393) / 383 (361–394) | **−8** (égalité, bruit) | +0 / −31 / +13 / −2 | 504 / 631 | 3 / 3 |
| HDR10 fenêtré | 562 (556–568) / 500 (486–500) | ❌ **+62** | +34 / +24 / +9 / −1 | 623 / 695 | **289 / 400** |
| Dolby Vision fenêtré | 570 (565–574) / 557 (546–559) | ❌ **+13** | −13 / +21 / +8 / −2 | 647 / 709 | **254 / 348** |
| HDR10 plein écran | 648 (646–658) / 687 (662–689) | ✅ **−39** | −70 / +23 / +9 / −1 | 662 / 718 | **311 / 490** |
| Octave | 638 (631–639) / 660 (636–665) | ✅ **−23** | −49 / +25 / +1 / −2 | 676 / 754 | 154 / 129 |

CPU au repos : 0,2 / 0,1 % (fenêtres de 20 s, arrondi à 0,1) ; mesure dédiée de 60 s
(`cpu_repos.py`) : 0,147 / 0,135–0,147 %. EDR : 8,25 partout des deux côtés (marge maximale du
moment). **La porte reste fermée** : HDR10 fenêtré +62, DV fenêtré +13 (au-dessus à chaque passe).

### Ce qui reste, et la suite proposée

| Reste (vidéo fenêtrée) | HDR10 | DV | Nature | Suite proposée | Prix |
|---|---|---|---|---|---|
| Principal | +34 | −13 | chaîne de lecture : le principal d'Electron (mpv 0.40 / FFmpeg 7.1) pèse ~48 Mo de MOINS en HDR10 qu'en DV, le nôtre autant dans les deux | **lecteur** : localiser ce que mpv 0.41 / FFmpeg 9 font de plus sur HDR10 avec `mpv_hote` (HDR10 contre DV, deux libmpv, 25 s, 2 mesures) | moyen |
| Processus GPU | +24 | +21 | rendu hors écran : ANGLE pour la capture | aucun drapeau n'y touche (§ 2.3) ; CEF fenêtré + mpv dans sa fenêtre (modèle d'Electron) | élevé (refonte) |
| Renderer | +9 | +8 | Chrome runtime de CEF 156 | — (dans CEF) | élevé |
| Surface vidéo à 3 drawables | (égal à Electron) | | levier : 2 drawables = −16 Mo dans toutes les vidéos → DV ≈ −3, HDR10 ≈ +46 | **lecteur + recette** : à valider (120 Hz ProMotion, images sautées, EDR) — vidéo-HDR avait choisi 3 | faible, risque cadence |

## 2.3 Après l'intégration `007eba8` (jalon 3) — essais d'une instance

- **Couche web détruite quand la page est entièrement transparente** (`2032a4b`) : HDR10 fenêtré
  après 14 s de lecture, principal 380–383 → 361 Mo, IOSurface du principal 63 → 31 Mo ; EDR 8,74
  continu pendant 18 s sans couche web (relevé horodaté, 2 Hz).
- **CPU au repos** après fusion : 0,147 % d'un cœur (6,6 réveils/s ; Electron 0,135–0,147).
- **Processus GPU en vidéo** (memory-infra, HDR10) : CEF `gpu/angle` 90,5 Mo + `gpu/dawn` 38,5 +
  `gpu/shared_images` 62,5 ; Electron pas d'ANGLE, `gpu/dawn` 22,4, `gpu/shared_images` 46,9.
  ANGLE n'existe chez CEF que pour le rendu hors écran (capture). Essayés sans effet sur
  l'empreinte du GPU (133–142 Mo) : `--force-gpu-mem-available-mb=256` et `=128`,
  `--disable-gpu-shader-disk-cache`, `--num-raster-threads=1`, `--skia-resource-cache-limit-mb=8`.
  `--use-gl=disabled` : composition LOGICIELLE (GPU 25 Mo, mais principal +34 et Renderer +45 :
  −34 Mo au total) — écarté, une page 2560×1600 à 120 Hz composée par le processeur.
- **Octave** : 17,3 images/s, 13,3 % de la vue abîmée par image (`shell.stats` : `dirtyPixels`
  / `viewPixels`). WindowServer y travaille MOINS que sous Electron (3,8 contre 5,4 %) : l'excédent
  est dans le GPU de l'app (8,7 contre 5,1 %), c'est-à-dire la capture plein cadre de Chromium et
  notre copie plein cadre. Ne copier que les bandes abîmées (plusieurs couches Metal) rattraperait
  la seconde (≈ 10 mW) au prix d'un risque de déchirure entre bandes : non fait.

## 3. Par processus (porte 1, médianes, Mo d'empreinte)

| Scénario | Principal CEF / Electron | GPU | Renderer | Autres (stockage / réseau) |
|---|---|---|---|---|
| Accueil | 68 / 69 | 218 / 231 | 86 / 78 | 6 / 7 |
| HDR10 fenêtré | **366 / 317** | 122 / 99 | 86 / 78 | 6 / 7 |
| DV fenêtré | 367 / 365 | 126 / 108 | 91 / 81 | 6 / 7 |
| HDR10 plein écran | 417 / 467 | 146 / 128 | 92 / 83 | 6 / 7 |
| Octave | 192 / 243 | 328 / 314 | 105 / 103 | 6 / 7 |

Principal pendant HDR10 (30 s de lecture, `footprint`) : CEF mémoire graphique 173–174 /
PartitionAlloc 103–108 / IOSurface 63 / IOAccelerator 10 ; Electron 163 / 64 (+ V8 de Node 17) /
46 / 10. Les deux font passer `malloc` par PartitionAlloc (Chromium le remplace dans tout le
processus : le tas de mpv, FFmpeg et MoltenVK y est compté). Les IOSurface en plus (17 Mo) sont
le drawable de la couche web (OSR, § 7). Le tas en plus (~40 Mo) vient de la chaîne de lecture
(§ 3.1) ; écartés en route : cache du démultiplexeur (~3 Mo, fichier de 1,28 Mo), fontconfig
(libass passe par CoreText), couches Vulkan implicites (aucune), réglages MoltenVK (compression
des shaders `MVK_CONFIG_SHADER_COMPRESSION_ALGORITHM=1` : 108 Mo, `MVK_CONFIG_USE_MTLHEAP=0` :
103 Mo), `vd-lavc-threads=1` (inchangé).

### 3.1 La chaîne de lecture seule, sans CEF

Petit hôte (`dlopen` d'une libmpv), même fichier HDR10 local, options du front, `ao=null`,
empreinte après 25 s (deux mesures, écart < 1 Mo) :

| libmpv | mpv / FFmpeg | `vo=null` (VideoToolbox copie) | gpu-next + Vulkan + macvk, sortie PQ, VideoToolbox |
|---|---|---|---|
| Electron 1.42.0 | 0.40.0 / 7.1.1 | 56,3 Mo | **253,0–253,5 Mo** |
| Homebrew | 0.41.0 / 9.0.2 | — | 286,6–286,7 Mo (+33) |
| La nôtre (fork jellium `b5c712f4`) | 0.41.0-dev / 9.0.2 | 76,5–76,7 Mo | **293,4–293,8 Mo (+40)** |
| Paquet `--dist` | 0.41.0-dev / 9.0.2 LGPL | 73,9 Mo | (pas de sortie macvk dans l'hôte) |

Même MoltenVK (1.4.2, celui de Homebrew dans l'hôte) des deux côtés ; libplacebo NON : en arm64,
Electron charge `libplacebo.387.dylib` (v7.387.0 ; sa 360 n'est qu'en x86_64), nous la 7.360.1.
En décodage logiciel, les deux chaînes sont identiques (186–187 Mo) ; sans vidéo (`vid=no`),
21,2 contre 17,9 Mo : l'écart est dans le chemin VideoToolbox.

**Bissection (axe lecteur, `742767e`)** — ce n'est PAS FFmpeg : notre fork lié aux dylibs
FFmpeg 7.1.1 d'Electron pèse 294–295 Mo, autant que sur 9.0.2 ; aucune option n'y change rien
(`hwdec-extra-frames`, `vd-lavc-dr`, cache, sortie SDR, OSD : ±0,5 Mo). C'est
**`--hwdec-threads`** : mpv 0.41 décode en matériel sur 4 fils par défaut (0.40 : un seul) —
24 Mo d'`av_malloc` dans les fils de libavcodec et 2 images VideoToolbox de plus en vol.
`hwdec-threads=1` (défaut du lecteur depuis `742767e`) : hôte 276–277 Mo ; **app −16 Mo en
HDR10 (608 → 592), −17 en DV (583 → 566)**, EDR 8,74, 0 image sautée ni retardée. Le reste dans
l'hôte est surtout son artefact (icône de mpv rendue dans SA fenêtre, ≈ 12 Mo, absente de l'app)
et libplacebo 7.360 contre 7.387 (≈ 4 Mo). Détail : `.claude/lot2/lecteur-RAPPORT.md`.

## 4. Leviers, un par un

| Levier | Commit | Effet mesuré | Gardé |
|---|---|---|---|
| Veille de l'horloge d'images (lien ralenti à 250 ms, suspendu à 3 s) | `8fbce00` | CPU repos 2,25 → 0,35–0,40 % (ps, fenêtre derrière) | oui |
| Vue dessinée depuis l'IOSurface de CEF, sans copie `viewTex_` | `620a864` | principal −16 à −20 Mo | oui |
| `renderer-process-limit=1` (plus de Renderer de réserve) | `ab93654` | −25 Mo, RSS −82 Mo | oui |
| `NetworkServiceInProcess` | — | 0 (nom inconnu de CEF 156) | non |
| `NetworkServiceInProcess2` (réseau dans le principal) | `ab93654` | −12 Mo net, RSS −74 Mo | oui |
| Framework CEF lié au lieu de `dlopen` (`__DATA_CONST` propre) | `9e638c2` | −45 à −55 Mo, RSS −115 Mo (programme vide : 16 → 2,5 Mo) | oui |
| Trim des drawables en veille profonde (1 seul, celui à l'écran) | `277733b`, `ed6d951` | principal au repos 93–97 → 65–67 Mo ; captures identiques avant/après | oui |
| 2 drawables au plus | `277733b` → retiré `ed6d951` | −16 Mo en animation, mais 6 relevés sur 15 avec une image sautée (2 sur 9 à 3) | non |
| Page et réseau réveillent l'horloge, sondage 0,2 Hz | `eafba53` | CPU repos 0,36–0,37 → 0,235 % (exact) ; latence d'une modification 100 → 6 ms | oui |
| `disable-stack-profiler` | `c5238fb` | principal −0,08 % (fil StackSamplingProfiler) + helpers | oui |
| `--disable-features=SkiaGraphite` | — | GPU −103 Mo mais Renderer +215 Mo (raster logiciel) | non |
| `--disable-zero-copy` | — | 0 | non |
| Pression mémoire simulée (CDP, page et navigateur) | — | 0 | non |
| Repli de pompe CEF 250 ms → 1 s | — | CPU inchangé (−1 réveil/s) | non |
| MoltenVK : compression des shaders, pas de MTLHeap | — | 0 | non |

## 5. CPU au repos (mesure exacte, `proc_pid_rusage`, 60 s, fenêtre devant)

`bench/mesures/cpu_repos.py` (`proc_pid_rusage`, ns exacts), accueil au repos, fenêtre devant,
60 s, deux instances de chaque, alternées :

| Version | Principal | GPU | Renderer | Stockage / réseau | **Arbre** | Réveils/s |
|---|---|---|---|---|---|---|
| CEF, horloge en veille (`ed6d951`) | 0,250–0,252 % | 0,053–0,059 | 0,046–0,047 | 0,009–0,013 | **0,359–0,370 %** | 10,7–11,2 |
| CEF final (réveil par la page, sondage 0,2 Hz, sans échantillonneur) | 0,146 % | 0,037 | 0,044 | 0,008 | **0,235 %** | 8,0 |
| Electron 1.42.0 | 0,052–0,057 % | 0,019–0,022 | 0,032–0,034 | 0,031–0,037 | **0,135–0,147 %** | 5,6–5,9 |

Ce qui reste dans le principal (`cpufils`, par fil) : `CrBrowserMain` ~0,15 % (tâches de Chromium sur
le fil UI, sans symboles dans CEF ; un `sample` de 20 s n'y voit que ~16 ms d'activité, dont
`CefDoMessageLoopWork`), `NetworkService` 0,02 % (le réseau est dans le principal), fil IO 0,013 %.
Essayé sans gain : repli de la pompe CEF 250 ms → 1 s (CPU inchangé).

## 6. GPU en musique : pourquoi la page coûte plus que sous Electron

Le mouvement d'Octave (l'indicateur « en cours ») avance PAR PAS à 15 images/s sur de petites
zones. Sous Electron, Chromium ne recompose que ces calques. Sous CEF hors écran, chaque image
de la page coûte trois passes plein cadre (2560×1600) : la capture OSR de Chromium (copie dans
le pool), notre copie dans le drawable de la couche web, et la recomposition de toute la couche
par WindowServer. D'où GPU de l'app 8,7–8,8 % contre 5,1–5,5 %, 164–165 contre 123–145 mW (+14 à +33 % selon la
porte ; +24 % le 03/11). En vidéo, c'est l'inverse : CEF 256–314 mW contre 395–434 (−22 à −35 %). Ce qui le réduirait : ne copier que les rectangles abîmés (CEF les donne) dans des
IOSurface à nous, en double tampon ; la capture et la recomposition restent (structurel à l'OSR).

## 7. Incompressible, et ce que coûterait d'atteindre Electron

| Coût | Mo (HDR10 fenêtré) | Ce qu'il faudrait | Prix |
|---|---|---|---|
| Chaîne de lecture mpv 0.41 contre mpv 0.40 d'Electron | ≈ +40 → **≈ +4** | Fait : `hwdec-threads=1` (`742767e`, −16 à −17 Mo dans l'app ; le reste de l'écart de l'hôte est son propre artefact). Reste libplacebo v7.387.0 dans le paquet (≈ −4 Mo) | faible : axe `paquet` ; à revalider EDR/DV |
| Drawable de la couche web (rendu hors écran) | ≈ +16 | Rien en dessous d'un drawable affiché ; sinon abandonner l'OSR | — |
| Processus GPU (cible hors écran, capture OSR) | ≈ +20 | Abandonner l'OSR : CEF fenêtré + mpv dans sa propre fenêtre sous celle de CEF (le modèle d'Electron). CEF n'honore pas la transparence de la page hors OSR sur macOS. | élevé : refonte du compositeur et des preuves EDR (plusieurs jours) |
| Renderer : composants du « Chrome runtime » (CEF 156 n'a plus le runtime Alloy) | ≈ +8 | Correctifs dans CEF lui-même | élevé, hors de notre code |
| Surface vidéo mpv à 3 drawables (choix de vidéo-HDR pour le 120 Hz ProMotion) | 0 contre Electron (lui aussi 3) | 2 drawables : −16 Mo | à mesurer : risque sur la cadence |

Ce qui est déjà au plancher : `__DATA_CONST` (framework lié), processus (4, comme Electron),
drawables de la page au repos (1), capture et drawables libérés en veille profonde.
Pour la vidéo fenêtrée seule, sans changer la chaîne de lecture, il resterait ≈ +40 Mo
(HDR10) et ≈ 0 (DV). Ce n'était pas la version de FFmpeg : `hwdec-threads=1` (`742767e`) en a
repris −16 à −17 Mo ; le reste de l'écart HDR10 est propre à CEF (lignes ci-dessus).

## 8. Ce qui n'a pas été vérifié

- **Paquet `--dist`** (FFmpeg 9.0.2 LGPL réduit) : le build `--dist` de la branche échoue tant que
  le jalon 2 de `paquet` (`96950e91`, embarquement du framework lié) n'est pas intégré ; le build
  `paquet` du cache était incomplet (pas de LC_RPATH) au moment de la mesure. Sa libmpv seule,
  sans sortie vidéo : 73,9 Mo contre 76,5 (la nôtre) et 56,3 (Electron) ; avec sortie vidéo, elle
  n'a pas ouvert de contexte macvk dans l'hôte de test → non mesurée.
- **Electron n'est pas le build de production** : copie re-signée ad hoc, sans sandbox (03/11).
- **Fenêtres session verrouillée** : écartées (champ `verrouille` de `fenetre.py`, `synthese.py`).
- **EDR d'Electron** à 1,00 en fenêtré dans une partie des passes (HDR10 1/3, DV 2/3) ; CEF 8,74
  partout. Cause non recherchée.
- **Mémoire de pointe** : une seule lecture de l'empreinte en fin de fenêtre, comme le 03/11.
