# android-perf — la fluidité d'Android TV, animation par animation

Chaque animation de la refonte rejouée sur l'appareil, mesurée par le **mode
de mesure** de l'app (`debug.tentacle.perf`, journal `[perf-json]` :
FrameMetrics de chaque image, phases, rendus React) et par le temps
processeur de chaque fil (`/proc/<pid>/task/*/schedstat`). Aucun compte
réel : le faux backend de nav-golden, derrière un relais qui sert les images
**à la taille demandée**, comme Jellyfin (`lib/imageProxy.mjs`).

```bash
# l'émulateur d'abord, sous verrou (A6 : TENTACLE_EMULATOR_OWNER=…)
pnpm tv:refonte:android --sans-backend
# deux APK de la même clé : la release mesurée, une debug (pour écrire la session)
TENTACLE_TV_REDESIGN=1 ./gradlew assembleRelease assembleDebug -x lint -PreactNativeArchitectures=arm64-v8a
node apps/tv/harness/android-perf/bench.mjs run --apk <release.apk> --debug-apk <debug.apk> --tag avant [--only focus-rangee,grille] [--rounds 3] [--trace]
node apps/tv/harness/android-perf/bench.mjs compare avant apres
```

Scénarios (`lib/scenarios.mjs`) : démarrage à froid, focus d'une carte pas à
pas, rangée tenue, accueil pas à pas et tenu, rail, rotation du héros, grand
panneau et échelle de note, fiche, grille tenue. Chacun part de l'accueil
fraîchement lancé, se place sans mesure, attend le repos, puis joue son
geste. `--trace` ajoute une trace `atrace` (gfx · view · input) par passe :
les textures envoyées au GPU (« Upload WxH Texture ») et les tranches du
RenderThread.

**Lire les chiffres de l'émulateur.** L'émulateur rend par le GPU du Mac,
mais tout envoi de texture y traverse le tuyau de l'émulation (des dizaines
de millisecondes par mégaoctet) : la phase « sync » y est démesurée. Ce qui
se compare d'un passage à l'autre, et prédit la Shield : le TRAVAIL (rendus
React, vues créées, octets de textures, temps processeur par fil), pas la
durée brute d'une image. Le processeur de l'émulateur (Apple M4) va environ
huit fois plus vite qu'un cœur de la Shield (Tegra X1+, Cortex-A57) : un
travail de 2 ms ici en vaut ~16 là-bas. Sur la Shield elle-même, le mode de
mesure suffit : `docs/tv-navigation/android-perf.md`.

`keys/Keys.java` : une séquence de touches à temps précis en un seul
processus (`input keyevent` coûte un lancement par touche), compilée et
poussée par le banc (javac + d8 du SDK).
