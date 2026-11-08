# Mesures GPU et RAM — bureau Electron 1.42.0 contre proto CEF + mpv + SDL3

03/11/2026, 15:03 → 15:34, MacBook Pro M4, écran Liquid Retina XDR intégré (3024×1964, 120 Hz),
macOS 26.6.2. Charge du système pendant la série : `uptime` 2,4 à 2,8.

- **Proto** : `~/.cache/tentacle-cef/build/integration/Tentacle.app`, branche `proto/cef-mpv-sdl3`
  (`6d0f75f` ; binaire construit à 14:13 depuis `0fcd885`, les commits suivants ne touchent que des scripts de banc et la doc), CEF hors écran, mpv (contexte moltenvk) dans une
  `CAMetalLayer` sous la page, dans la même fenêtre.
- **Electron** : Tentacle TV 1.42.0, build de production de `/Applications`, **copié et re-signé ad hoc**
  (voir « Isolation du profil »), Liquid Glass coupé (`TENTACLE_LIQUID_GLASS=off`, journal :
  `[liquid-glass] forced-off`). mpv est chargé dans le processus principal et ouvre sa propre fenêtre
  Metal sous celle d'Electron.
- **Banc commun** : Tentacle 1.42.0 sur `127.0.0.1:3471`, Jellyfin 12.4 sur `:8471`, compte `admin`
  du banc. Même fenêtre : 1280×800 points sur l'écran intégré, une seule app à l'écran à la fois
  (verrou `locks/ecran`).

## Résultats

Médiane de 3 passes, puis (min–max). Une passe = l'app lancée à neuf, puis les 5 scénarios dans
l'ordre, puis l'app tuée ; les passes alternent proto / Electron.

| Scénario | App | RSS Mo | Empreinte Mo | CPU % d'un cœur | GPU de l'app % | GPU WindowServer % | GPU actif % | GPU mW | AGX « Device Util. » % | Marge EDR |
|---|---|---|---|---|---|---|---|---|---|---|
| Système sans app (bruit de fond) | — | — | — | — | — | 1,0 (0,9–1,1) | 2,0 (1,9–2,3) | 8 (7–9) | 0,6 (0,6–2,1) | — |
| 1. Accueil au repos ¹ | CEF | 742 (730–766) | 461 (451–546) | 1,9 (1,6–2,2) | 0,0 | 1,1 (0,4–2,6) | 1,5 (0,7–3,4) | 2 (1–6) | 0,5 (0,2–2,2) | — |
| | Electron | 616 (540–628) | 352 (343–368) | 0,1 (0,0–0,1) | 0,0 | 2,1 (1,1–2,5) | 3,1 (1,4–3,5) | 6 (2–7) | 1,6 (0,4–2,4) | — |
| 2. HDR10 fenêtré | CEF | 896 (888–906) | 730 (726–739) | 18,9 (18,5–20,1) | 15,2 (15,0–15,4) | 9,1 (8,9–9,7) | 23,6 (23,4–24,1) | 291 (255–302) | 21,3 (19,6–21,8) | 7,93 ×3 |
| | Electron | 702 (682–706) | 493 (489–502) | 18,1 (17,9–18,2) | 17,8 (16,4–17,8) | 7,9 (7,5–8,2) | 24,7 (24,0–25,0) | 348 (313–352) | 24,0 (22,1–24,0) | 7,93 ×3 |
| 3. Dolby Vision fenêtré | CEF | 912 (906–920) | 739 (736–745) | 18,9 (18,8–20,5) | 14,7 (14,6–14,7) | 9,0 (8,3–9,6) | 23,0 (22,5–23,8) | 277 (238–300) | 20,2 (18,9–20,5) | 7,93 ×3 |
| | Electron | 720 (701–728) | 546 (544–566) | 18,4 (18,0–18,5) | 17,7 (16,6–18,8) | 7,5 (7,1–8,5) | 25,2 (23,6–26,5) | 373 (340–397) | 25,1 (23,1–25,3) | **7,93 ×1, 1,00 ×2** |
| 4. HDR10 plein écran | CEF | 929 (921–933) | 832 (829–838) | 18,5 (18,5–19,3) | 17,2 (16,8–17,8) | 0,0 | 17,6 (17,4–18,1) | 297 (291–317) | 17,8 (17,6–19,5) | 7,93 ×3 |
| | Electron | 729 (705–740) | 659 (652–661) | 18,4 (15,8–18,7) | 18,2 (17,4–18,5) | 8,0 (7,5–8,4) | 24,2 (23,1–25,1) | 441 (396–451) | 22,6 (21,3–23,0) | 7,93 ×3 |
| 5. Octave, musique, mini-lecteur | CEF | 939 (931–952) | 780 (776–799) | 21,9 (21,4–25,7) | 9,9 (8,8–10,1) | 4,3 (3,9–8,5) | 17,3 (17,1–19,8) | 154 (152–175) | 15,0 (14,5–17,1) | — |
| | Electron | 762 (749–787) | 651 (636–656) | 21,6 (17,6–22,2) | 5,2 (5,0–5,3) | 4,7 (4,4–6,5) | 11,6 (11,1–13,0) | 124 (113–132) | 9,0 (8,6–10,6) | — |

¹ Seule la passe 1 a mesuré la page Accueil. En passes 2 et 3, le front des deux apps a rouvert
`/octave` (dernière page de la passe précédente) et la navigation vers `/` n'a pas pris : le
scénario 1 y mesure donc Octave **sans lecture**. Les conditions restent les mêmes pour les deux
apps. Passe 1 seule (vraie Accueil) : CEF 766 Mo RSS / 546 Mo d'empreinte / 1,9 % CPU / 0,9 mW ;
Electron 541 / 352 / 0,0 % / 6,0 mW.

Lecture des colonnes :
- **RSS** et **empreinte** : sommes sur TOUS les processus de l'arbre de l'app (CEF : 6 processus,
  dont 2 Renderer ; Electron : 4). mpv est dans le processus principal des deux côtés.
  Empreinte = `phys_footprint` de `footprint` (mémoire graphique comprise : elle est comptée dans
  les processus GPU). Relevées à la FIN de la fenêtre de mesure.
- **GPU de l'app** : temps GPU des processus de l'app (`accumulatedGPUTime` des clients
  d'AGXAccelerator) ÷ durée de la fenêtre. **GPU WindowServer** : idem pour WindowServer
  (composition de l'écran, pas seulement celle de l'app).
- **GPU actif %** et **GPU mW** : tout le GPU de la machine (IOReport), bruit de fond compris
  (~8 mW, ~2 %).
- **Marge EDR** : maximum de `edr-probe` (sonde externe, 2 Hz) pendant la fenêtre.

Détail par processus (passe 2, HDR10, RSS Mo / empreinte Mo) :
- CEF : principal (mpv inclus) 285 / 419 · trois « Tentacle Helper » 141 / 135, 82 / 25 et 66 / 20 ·
  Renderer de la page 238 / 105 · second Renderer 83 / 26.
- Electron : principal (mpv inclus) 326 / 313 · deux « Tentacle TV Helper » 123 / 94 et 51 / 7 · Renderer 202 / 75.

## Méthode exacte

```bash
# Verrou d'écran du lot (tenu de 14:50 à 15:35)
mkdir ~/.cache/tentacle-cef/locks/ecran
# Sonde GPU sans root (IOReport) — sudo demande un mot de passe, donc pas de powermetrics
clang -O2 bench/mesures/gpumon.c -o ~/.cache/tentacle-cef/build/mesures/gpumon -framework CoreFoundation -lIOReport
# Bruit de fond (aucune app) ×3, puis 3 passes par app en alternance
for n in 1 2 3; do bench/mesures/passe.sh repos $n; done
for n in 1 2 3; do bench/mesures/passe.sh cef $n; sleep 8; bench/mesures/passe.sh electron $n; sleep 8; done
python3 bench/mesures/synthese.py ~/.cache/tentacle-cef/build/mesures/resultats.jsonl
rmdir ~/.cache/tentacle-cef/locks/ecran
```

- `bench/mesures/passe.sh` lance l'app (proto : `--url=http://127.0.0.1:3471 --devtools-port=9306
  --profile=~/.cache/tentacle-cef/profiles/mesure-cef` ; Electron : copie re-signée,
  `--use-mock-keychain --remote-debugging-port=9305`, faux HOME), puis enchaîne :
  1. connexion si besoin, langue fr, sourdine persistée du lecteur, puis **30 s de repos, mesure 20 s** ;
  2. fiche « Banc HDR10 Pistes (2026) », bouton « Lecture » du front, **mesure 45 s** à partir de ~3 s de
     lecture (le fichier dure 60 s), sortie, 12 s d'attente (la marge EDR met du temps à retomber) ;
  3. même chose avec « Banc Dolby Vision Pistes (2026) » ;
  4. HDR10, touche F (plein écran natif), **mesure 42 s**, F, sortie ;
  5. `/octave`, « Lire Grand Format » (un titre de 360 s), mini-lecteur visible, **mesure 50 s**.
- `bench/mesures/scenario.mjs` pilote le VRAI front par CDP (mêmes clics, mêmes touches des deux
  côtés) et vérifie que la lecture avance et qu'elle est muette ; `fenetre.py` mesure :
  `gpumon 1000 <durée>` (énergie « GPU Energy » et résidence des états `GPUPH` d'IOReport),
  `ioreg -r -c AGXAccelerator` chaque seconde (« Device Utilization % »), `ioreg -a … -l -d 3`
  au début et à la fin (temps GPU par processus), `ps -o cputime` au début et à la fin (CPU),
  `footprint <pid>` et `ps -o rss` à la fin, `edr-probe --hz 2` en parallèle.
- Contrôle de chaque lecture après la fenêtre (`etats.log`) : `time-pos` entre 48,3 et 50,1 s,
  `pause=false`, `mute=true`, `volume=0`, sortie `pq` — 18/18 lectures.
- Données brutes : `~/.cache/tentacle-cef/build/mesures/{resultats.jsonl,etats.log}`.

### Isolation du profil Electron

L'app de `/Applications` est un build **Mac App Store sandboxé** (`com.tentacle.mobile`,
`app-sandbox`) : son profil est le conteneur `~/Library/Containers/com.tentacle.mobile`.
`--user-data-dir` y est sans effet (le code force `userData`) et un faux HOME ne redirige pas un
processus sandboxé. ⚠️ Un premier lancement d'essai (14:47, ~15 s, sans aucune saisie) a donc ouvert
le **vrai** profil : 57 fichiers réécrits au démarrage (cache HTTP, Local/Session Storage, date de
`tentacle-local.db`, un avatar, `DevToolsActivePort` laissé là). Tué aussitôt, signalé, rien
supprimé.

Mesures faites ensuite sur une **copie** : `ditto` de l'app, bundle id changé
(`com.tentacle.mesurecef`), reçu MAS retiré, `codesign --force --deep --sign -` (ad hoc, sans
entitlements, donc sans sandbox), lancée avec `CFFIXED_USER_HOME`/`HOME` =
`~/.cache/tentacle-cef/profiles/electron-mesure/home`. Mêmes binaires, signature et entitlements
différents. Vérifié : `lsof` montre le profil sous le faux HOME ; dates et tailles de tous les
dossiers réels (conteneur, Group Container, Application Support, Preferences, Caches…) identiques
entre 14:50 et 15:35 (0 différence sur 12 660 entrées).

## Ce qui n'a pas pu être mesuré, et les écarts de méthode

- **`powermetrics`** : `sudo` demande un mot de passe. Remplacé par IOReport lu sans root
  (`gpumon.c`). Les mW sont ceux de la machine entière, pas de l'app.
- **Electron n'est pas exactement le build de production** : c'est une copie re-signée, sans sandbox
  (voir plus haut). Effet sur les chiffres non mesuré.
- **Son** : le son du Mac n'était PAS coupé (`output muted of (get volume settings)` = false) ; il n'a
  pas été touché. Proto : `ao=null`, `mute=yes`. Electron : sourdine et volume 0 du lecteur
  (`tentacle_player_muted=1`, `tentacle_player_volume=0`, `tentacle_octave_volume=0` dans le
  profil de mesure, et `audio_control` muted/volume 0 avant la musique), vérifiés à chaque lecture.
  Electron garde une sortie CoreAudio réelle (muette), le proto aucune : le CPU audio n'est pas
  strictement identique.
- **Luminosité** : ni lue ni réglée ; inchangée à la main pendant la série (luminosité automatique :
  état non relevé).
- **Accueil** : seule la passe 1 l'a mesuré (voir ¹).
- **Marge EDR d'Electron en Dolby Vision** : 1,00 dans 2 passes sur 3, alors que mpv sort `pq`
  (`gamma` vu à chaque lecture). Cause non recherchée (pas un correctif ici). Le code d'Electron
  affirme que la marge se lit par processus et qu'une sonde externe reste à 1,00 ; ici la même sonde
  externe a vu 7,93 dans 7 lectures Electron sur 9, cette affirmation n'est donc pas confirmée.
- **Position de la fenêtre** : même taille (1280×800 points), positions non alignées.
- **Une seule mesure d'état par fenêtre** pour la RAM (fin de fenêtre) : pas de pic ni de courbe.
- **Pas de mesure de la page Accueil en mouvement** (défilement, survols) ni de la bascule
  musique ↔ vidéo.

## Ce que montrent les chiffres

- **RAM** : le proto en prend plus dans tous les scénarios. Empreinte : +109 Mo au repos (461 contre
  352), +237 Mo en HDR10 (730 contre 493), +193 Mo en DV, +173 Mo en plein écran, +129 Mo en musique.
  RSS : +126 à +200 Mo. Le proto a 6 processus, Electron 4.
- **GPU en lecture vidéo** : le GPU de la machine consomme moins avec le proto : HDR10 fenêtré
  291 contre 348 mW (−16 %), DV 277 contre 373 mW (−26 %), HDR10 plein écran 297 contre 441 mW
  (−33 %). Le taux d'activité du GPU est proche en fenêtré (23,6 contre 24,7 %), plus bas en plein
  écran (17,6 contre 24,2 %). En plein écran, WindowServer ne consomme plus de GPU avec le proto
  (0,0 % contre 8,0 %).
- **GPU en musique** : le proto en consomme plus (154 contre 124 mW, +24 % ; GPU de l'app 9,9 contre
  5,2 %).
- **GPU au repos** : les deux sont au niveau du bruit de fond (≤ 6 mW, GPU de l'app 0 %).
- **CPU** : identique en lecture vidéo (18 à 19 % d'un cœur) et en musique (~22 %) ; au repos, 1,9 %
  pour le proto contre 0,1 % pour Electron.
- **EDR** : les deux atteignent 7,93 en HDR10, fenêtré et plein écran (3/3). En DV, le proto 3/3 ;
  Electron 1/3 (1,00 dans les deux autres passes).
