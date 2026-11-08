# Reprise du prototype CEF + mpv + SDL3 — état au 03/11, fin de lot

## Où on en est

Branche d'intégration : **`proto/cef-mpv-sdl3` = `0fcd885`** (+ ce commit), locale seulement (aucun remote,
aucun push). Elle contient tout ce que les quatre axes ont rendu. Elle compile
(`scripts/build.sh integration`). Les quatre branches d'axe n'ont rien de plus.

| Objectif de la demande | État |
|---|---|
| Front web de Tentacle dans CEF (OSR, IOSurface), fenêtre SDL3, 120 Hz | ✅ marche (banc local 1.42.0) |
| Vidéo mpv sous la page, contrôles/barre/pistes du front par-dessus | ✅ SDR, HDR10, DV : 11/11 cas chacun, robustesse 7/7 (lecture, pause, seek, pistes audio et sous-titres, fin, retour) |
| Plein écran | ✅ natif, prouvé dans l'app pendant la lecture (passe du pont : 11/11 par format) |
| HDR10/DV en passthrough PQ | ✅ côté mpv : `video-target-params` pq/bt.2020, couche `ITUR_2100_PQ`, `BGR10A2Unorm`, `wantsEdr`, `CAEDRMetadata` |
| **Écran en mode étendu (headroom > 1)** | ✅ **hors CEF** : HDR10, DV 8.1 et DV 5 à **8,44**, SDR à 1,00, sous un voile semi-transparent, redimensionné et en plein écran. Cause trouvée : MoltenVK pose ses réglages de couche dans une transaction Core Animation jamais validée sur le fil de mpv → corrigé dans NOTRE couche (`9aef383`), sans toucher MoltenVK. Le socle mesure aussi 8,44 sous la page (couche factice `edr:4`). ✅ **dans l'app CEF** (passe du pont, `dd725d8`) : HDR10 et DV **7,94**, SDR 1,00, depuis l'interface de Tentacle, plein écran compris |
| Octave : audio sans fenêtre vidéo, mini-lecteur, file, pause/seek, bascule | ✅ sous CEF, 0 échec sur 2 passages ; couches vidéo 0 → 1 (HDR10) → 0 → 0 |
| Saisie, IME, popups, défilement, redimensionnement, DPI (socle J2) | ✅ banc 22/22 (`8f0e63c`) : 120 Hz réel, plein écran natif, IME, popups, repos |

Rapports : `.claude/lot/{socle,pont,octave}-RAPPORT.md` ; celui de vidéo-HDR est dans son commit
`5ce850a` (étude + contrat) et dans `.claude/worktrees/proto-hdr-bbcaf3/`.

## À la passation

Les quatre axes ont rendu leur dernier jalon ; tout est intégré, plus rien ne tourne, le verrou
d'écran est libre. Rien n'a été poussé.

## Où tout se trouve

- Dépôt : `/Users/damienrouge/Desktop/Projet - local/Tentacle-CEF` (Syncthing, chemin avec espaces).
- Worktrees des axes : `.claude/worktrees/proto-{socle-5b2493,hdr-bbcaf3,pont-1d8541,octave-2d4bfb}`,
  branches `claude/proto-*` du même nom.
- Brief du lot (règles, ports, acquis de Tentacle) : `.claude/PROTO-BRIEF.md`.
- Journal daté : `.claude/lot/INTEGRATION.md` ; rapports : `.claude/lot/octave-RAPPORT.md`,
  `.claude/worktrees/proto-pont-1d8541/.claude/lot/pont-RAPPORT.md`.
- Contrat des modules et propriétaires : `docs/INTERFACES.md`. Étude de la référence : `docs/etude/`.
- Hors dépôt, `~/.cache/tentacle-cef/` : `ref/` (clones jellium/jellyfin-desktop, lecture seule),
  `deps/` (CEF 156, libmpv du fork dans `deps/mpv/b5c712f4`), `build/<axe>/`, `profiles/`,
  `media/` (vidéos HDR10/DV/SDR fabriquées, 18 titres de musique), `banc/comptes.json`.

## Lancer

Depuis la racine du dépôt (pnpm, aucune dépendance npm — `package.json` n'appelle que des scripts) :

```bash
pnpm banc up        # colima + banc local (Tentacle 1.42.0 :3471, Jellyfin :8471) ; `pnpm banc` = état
pnpm dev            # VRAI build Release (scripts/build.sh), puis lance l'app contre le banc, avec le son
pnpm build          # le build seul
```

- `pnpm dev` construit le même `.app` que le paquet (Release) dans `~/.cache/tentacle-cef/build/dev/`
  (`dev-<worktree>` depuis un worktree), profil `~/.cache/tentacle-cef/profiles/dev`, puis lance
  l'app au premier plan (journal dans le terminal, Ctrl+C pour quitter).
- Serveur : `TENTACLE_URL=http://… pnpm dev` (défaut : le banc `http://127.0.0.1:3471`). Si le
  serveur ne répond pas, échec immédiat AVANT le build, avec la commande à lancer (colima, banc).
- Options passées à l'app : `pnpm dev -- --mute` (son coupé : à utiliser par toute session),
  `pnpm dev -- --size=1440x900 --devtools-port=9300`, etc. (`src/app/args.cpp`).

## Comment tester

1. **Banc local** (Tentacle 1.42.0 sur `:3471`, Jellyfin 12.4 sur `:8471`) :
   ```bash
   colima start
   cd "/Users/damienrouge/Desktop/Projet - local/Tentacle-CEF"
   bench/server/banc.sh up && bench/server/banc.sh status
   ```
   (`banc.sh setup` seulement sur un banc neuf.) Identifiants : `jq .admin ~/.cache/tentacle-cef/banc/comptes.json`.
2. **Construire** : `scripts/build.sh integration` → `~/.cache/tentacle-cef/build/integration/Tentacle.app`.
3. **Lancer** :
   ```bash
   ~/.cache/tentacle-cef/build/integration/Tentacle.app/Contents/MacOS/Tentacle \
     --url=http://127.0.0.1:3471 --devtools-port=9301 \
     --profile=$HOME/.cache/tentacle-cef/profiles/integration
   ```
   Se connecter, ouvrir « Banc HDR10 Pistes » ou « Banc Dolby Vision Pistes » (Films), Lecture.
   Musique : bibliothèque Musique → Octave. Le son sort sur CoreAudio, volume et sourdine du
   lecteur ; `--mute` (ou `TENTACLE_MUTE=1`) le coupe — obligatoire pour tout lancement de banc.
   Autres options : `--fake-video=RRGGBB|off|edr:4`, `--size=LxH`, `--frame-rate=N`, `--debug-input`.
4. **Témoin EDR** pendant une lecture HDR (doit dépasser 1,00) :
   `~/.cache/tentacle-cef/build/video-hdr/edr-probe/edr-probe`.
5. **État dans la page** : `node tools/cdp-eval.mjs 9301 "<expression JS>"` ;
   couche vidéo : `__shell.invoke('pont.debug.surface')`, couches : `__shell.invoke('shell.debug.layers')`.
6. **Bancs scriptés** : `web/shim/dev/scenario-video.mjs "<titre>"` et `scenario-robustesse.mjs`
   (pont, port 9303), `web/shim/octave-cef.mjs` (octave, 9304), `scripts/banc-socle.sh` et
   `scripts/banc-socle-edr.sh` (socle), `bench/hdr/run-when-unlocked.sh x2` (EDR).
   Lecteur (lot « app CEF ») : `bench/lecteur/son.sh` (son sans rien entendre, sonde CoreAudio),
   `bench/lecteur/pistes.sh [n]` (bascules ; `LECTEUR_DEBIT=212000 LECTEUR_VARIANTES=1` : à débit
   limité, titres réalistes), `bench/lecteur/lecture.mjs` (vitesse, épisode suivant, reprise),
   `bench/lecteur/adieu.sh` (fermeture en pleine lecture : Jellyfin ne la voit plus en cours).
   ⚠️ Session macOS verrouillée : plus de vsync, donc plus de BeginFrame ; la page ne peint plus
   et Chromium jette les appuis souris (CDP comme SDL), seul le survol passe. Un clic CDP n'y
   prouve rien (`octave-scenario.mjs` rejoue alors le geste dans la page, et le dit).

## Comment reprendre

1. Lire `.claude/PROTO-BRIEF.md` (règles non négociables : Tentacle-TV en lecture seule, rien sur
   GitHub, son coupé, un seul verrou d'écran) puis la fin de `.claude/lot/INTEGRATION.md`.
2. Voir ce que les axes ont ajouté depuis : `git log proto/cef-mpv-sdl3..claude/proto-hdr-bbcaf3`
   (idem socle, pont) ; intégrer une branche à la fois (`git merge` dans `proto/cef-mpv-sdl3`),
   puis `scripts/build.sh integration`.
3. Suite possible : mesurer RAM et GPU, proto contre bureau Electron 1.42.0 (build de production,
   même Mac) — accueil au repos 30 s, puis lecture HDR10 60 s (`sudo powermetrics --samplers
   gpu_power -i 1000 -n 10`) ; ensuite Linux (Wayland : sous-surface, sans doute sans SDL3, comme
   jellium `99bf6c6`) et Windows (DirectComposition, jellium `e47d468`).
4. Fin : rapport (ce qui marche / ne marche pas / bidouilles par rapport à jellium), tout sur
   `proto/cef-mpv-sdl3`, aucun push.
