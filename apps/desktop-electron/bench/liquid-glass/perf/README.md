# Banc de fluidité du Liquid Glass (lot lg5)

Les IMAGES, une par une, sur un **build de production** du bureau (`pnpm --filter
@tentacle-tv/desktop-electron build`), jamais `dev` et son compteur d'images. Même
Jellyfin et même backend jetables que le banc de recette (`../README.md`).

```bash
export BANC_STATE=<état du banc> BANC_PORT_BACKEND=3115 BANC_PORT_CDP=9337 BANC_PORT_MAIN=9437
node perf/run.mjs [--configs dark-on,dark-off,light-on,light-off] [--only menus,navigation] [--player] [--admin] [--dump]
node perf/ablate.mjs --scenario repos-accueil,menus [--only reference,sans-lentille] [--rounds 2]
node perf/snap.mjs avant|apres [--theme dark|light]      # le rendu ne bouge pas : captures à comparer au pixel
node perf/analyze.mjs <dossier>                           # verdict recalculé des traces gardées (--dump)
```

## Ce qu'il mesure

- **Images** : trace Chromium par CDP (`Tracing`), tranches `PipelineReporter`. Le
  verdict est celui de Chromium : une image ATTENDUE (une mise à jour voulue) qui n'a
  pas été présentée est **abandonnée** (`STATE_DROPPED`) — indifférent à la cadence
  voulue (le travelling du héros est bridé à 30 i/s, `heroMotion.css`). Rafale = deux
  abandons d'affilée ou plus. Bornes du geste : `performance.mark("lg5:start|end")`.
- **Étapes** (`stages.mjs`) : fil principal (`SendBeginMainFrameToCommit`),
  rastérisation (`EndCommitToActivation`), envoi au processus GPU
  (`SubmitToReceiveCompositorFrame`), **dessin GPU** (`StartDrawToSwapStart`).
- **À côté** (`probes.mjs`) : CPU de chaque processus (`app.getAppMetrics`), appels du
  pont du verre (mesures de ton, régions natives), longues images (LoAF ≥ 50 ms).
  Le temps GPU par processus (`ioreg`, AGX) reste à 0 pour le processus GPU de
  Chromium sur macOS 26 (il ne voit que mpv) : « Device Utilization » de la machine
  à la place, comparable dans une même passe seulement.
- **Ablations** (`ablations.mjs`) : un effet du verre retiré à la fois par une feuille
  ou un patch des filtres injectés — un instrument, jamais une proposition de rendu.

## Pièges payés (22-23/10)

- **Écran verrouillé** : macOS ne compose plus la fenêtre, une passe est VIDE.
  `run.mjs` attend le déverrouillage ; `--locked-ok` (et `ablate.mjs`, `snap.mjs`)
  pose `setBackgroundThrottling(false)` : la page peint quand même — dessin GPU
  vérifié identique à une passe déverrouillée (4,5-4,6 ms au repos), les abandons
  sans WindowServer, eux, sont à confirmer écran ouvert.
- **Banc partagé** : on attend qu'AUCUN slot `electron-slot-*` ne soit pris.
- **Shaders à froid** : le profil est neuf à chaque passe ; la première visite d'une
  page compile ses filtres (une image de 270 ms au premier passage). Juger la
  navigation sur un second passage.
- **Couleurs des `feImage`** : Chromium convertit leurs pixels vers l'espace de
  l'écran, ce qui MÉLANGE les canaux. Une carte de déplacement doit garder un gris
  neutre exact (128, 128, 128) partout où rien ne bouge ; y loger autre chose (la
  lumière dans le bleu) décale tout le dessous.
