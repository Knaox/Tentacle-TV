# Banc Lite — une box Android TV faible, imitée sur le Mac

Le banc du chantier « Mode Lite » : l'app Android TV jouée sur un appareil
**contraint** (peu de RAM, peu de cœurs, processeur freiné, mémoire sous
pression), écran par écran, avec des relevés comparables d'une passe à
l'autre. Il prolonge le banc de fluidité `apps/tv/harness/android-perf`
(même faux backend, même mode de mesure, même injecteur de touches).

Appareil de référence : box **net+ UZX4020NPS** (Broadcom BCM7271, 4 ×
Cortex-A53 à 1,6 GHz, 2 Go, Android TV 9 à 11). Plancher : Android TV à 1 Go.

## En bref

```bash
cd apps/tv/harness/android-perf
# 1. les AVD (une fois ; seuls les Lite_* sont créés ou modifiés)
node lite.mjs avd create all
node lite.mjs avd start Lite_API31_2G          # emulator-5642 ; Lite_API31_1G → emulator-5640
node lite.mjs avd check Lite_API31_2G          # RAM, cœurs, tas, faible RAM
# 2. les APK de l'app de MESURE (obligatoire : le banc refuse com.tentacletv.mobile)
(cd ../../android && TENTACLE_TV_REDESIGN=1 ./gradlew assembleRelease assembleDebug -x lint -PtentaclePerfApp=1 -PreactNativeArchitectures=arm64-v8a)
APK=../../android/app/build/outputs/apk
# 3. le parcours mesuré (dossier daté)
node lite.mjs parcours run Lite_API31_2G --apk $APK/release/app-release.apk --debug-apk $APK/debug/app-debug.apk \
  --tag avant [--throttle duty:25] [--only grille,fiche] [--rounds 2] [--cold 3] [--endurance 3] [--perfetto] [--pressure]
node lite.mjs parcours compare <dossier-avant> <dossier-après>     # tableau markdown
# outils à la pièce
node lite.mjs throttle measure Lite_API31_2G --specs ecoe,duty:50,duty:25
node lite.mjs pressure trim Lite_API31_2G RUNNING_CRITICAL
node lite.mjs pressure hog Lite_API31_2G 600 60                    # 600 Mo natifs pris 60 s
node lite.mjs pressure apps Lite_API31_2G                          # les apps Leanback lancées, puis la nôtre
node lite.mjs setup Lite_API31_2G --apk … --debug-apk …            # explorer à la main (Ctrl+C)
```

Ports : relais d'images **3111**, faux backend **3121** (`PERF_PORT` les
déplace, le backend suit à +10). Résultats :
`~/Library/Caches/tentacle-android-perf/lite/<AAAA-MM-JJ_HHMM>-<tag>/`
(`resume.json`, `journal.txt`, traces `.pftrace`).

**Verrous.** Un AVD Lite par session : fichier
`Projet - local/.claude/locks/lite/emulateur-<AVD>.lock` au nom de la session,
supprimé en le rendant. Arrêter SON émulateur par sa console
(`lite.mjs avd stop <AVD>`), jamais un `pkill`.

## La garde des touches (obligatoire)

Incident du 07/10 : des touches d'un banc, envoyées quand l'app de mesure
n'était plus au premier plan, ont ouvert les Paramètres système d'une Shield,
qui a redémarré. Toute séquence passe désormais par la garde
(`lib/keyGuard.mjs`, `keys/Keys.java`) :

- l'app mesurée est l'app de mesure `com.tentacletv.mobile.perf`, sur tout
  appareil ; le banc **refuse** `com.tentacletv.mobile` (jamais l'app, le
  compte ni le profil de l'utilisateur ; sur un appareil réel, un compte de
  test — Knaoxtest, Knaoxtest2 — ou le faux backend nav-golden) ;
- l'app est lancée par `am start`, jamais depuis le lanceur ;
- chaque séquence est coupée après chaque OK et chaque Retour ; avant chaque
  tronçon, `dumpsys activity activities` doit montrer l'app reprise ET
  focalisée ; l'injecteur relit le premier plan (`getTasks`) avant CHAQUE
  appui et sort sans rien envoyer (code 3) sinon ;
- au moindre doute : `ForegroundError`, arrêt net, plus aucune touche — ni
  l'échauffement ni une passe rejouée ne la rattrapent ;
- jamais Accueil, Marche, Menu, Paramètres, Veille, Applis récentes
  (codes 3, 26, 82, 176, 223, 187).

**Prouvée à l'émulateur (07/10)** : en pleine séquence de 30 DROITE, le
lanceur mis au premier plan par `am start` (une activité, pas une touche).
Dernier appui envoyé à 22:54:28,49 ; le focus quitte l'app à 28,84 et entre
dans le lanceur à 29,06 (`logcat -b events -s input_focus`) ; l'appui suivant
n'est jamais parti. Le tronçon suivant est refusé par `dumpsys` avant
l'injecteur ; `tap:3`, `tap:176`, `tap:82`, `hold:26` refusés d'office.
`PERF_KEYS_TRACE=1` affiche l'heure de chaque appui envoyé, pour refaire la
preuve.

## Les AVD

| AVD | Image | RAM | Cœurs | Console | Pour |
|---|---|---|---|---|---|
| `Lite_API31_1G` | Android TV 12 (API 31) ARM64 | 1 Go | 2 | emulator-5640 | le plancher Google (ATV 1 Go) |
| `Lite_API31_2G` | Android TV 12 (API 31) ARM64 | 2 Go | 4 | emulator-5642 | la box net+ (2 Go, 4 × A53) |

Profil `tv_1080p`, densité 320, `-gpu host`, sans instantané (démarrage à
froid à chaque fois), sans son. Relevé de `Lite_API31_2G` : MemTotal 1 968 Mo,
`nproc` 4, MemAvailable ~1 Go au repos.

**Pourquoi l'API 31.** Sur un Mac Apple Silicon, seules les images ARM
tournent accélérées ; Android TV ARM n'existe qu'en API 31 et 34 (les API 28,
29 et 30 ne sont publiées qu'en x86). L'API 31 (Android 12) est la plus proche
des box Android TV 9 à 11.

**Ce que l'émulateur ne sait PAS imiter (mesuré) :**

- **`ro.config.low_ram`** : `-prop` n'accepte que les propriétés `qemu.*`
  (« only 'qemu.*' properties are supported »), et l'image Android TV de
  Google est une build `user` (pas de root, et `debug.force_low_ram` n'est lu
  que sur une build debuggable). `ActivityManager.isLowRamDevice()` y reste
  **faux**. La détection (L2) se simule par ses propriétés `debug.tentacle.lite*`
  (`setprop debug.tentacle.lite.signals netplus|1gb|…`, voir tv-core
  `device/signalOverride.ts`).
- **Le tas Java d'une box** : `dalvik.vm.heapgrowthlimit` 192m et `heapsize`
  512m, ceux de la build, quelle que soit la RAM (`getMemoryClass` = 192).
  Une box à 2 Go a souvent 128m / 384m.
- **Le processeur** : voir « Freiner l'émulateur ».

## Freiner l'émulateur

Le Mac (Apple M4 : 4 cœurs de performance, 6 économes) n'a ni cgroups ni
taskset. Deux leviers, appliqués au SEUL qemu de l'AVD (trouvé par sa
console), pendant la MESURE seulement (installation et échauffement restent
rapides) — `--throttle <spec>` :

- `ecoe` — `taskpolicy -b` : priorité d'arrière-plan, cœurs économes
  seulement (le `--slow` du banc de fluidité) ;
- `duty:N` — qemu suspendu (SIGSTOP) puis relâché (SIGCONT) par
  `lib/lite/dutyCycle.mjs`, N % du temps en marche sur des périodes de 20 ms ;
  l'horloge de la machine virtuelle continue : l'app voit un processeur plus
  lent, pas un temps figé. Qemu est toujours relâché en sortant (signal, fin
  du parent) ;
- combinables : `ecoe+duty:50`.

**`cpulimit` (Homebrew 0.2) est écarté** : sur macOS il lit la consommation
de qemu à 1-2 % quand `ps` en voit 50 à 100 %, ne le suspend donc jamais
(mesuré : `cpu:25` plus rapide que rien).

Effet mesuré le 07/10 sur `Lite_API31_2G` (`throttle measure` : une boucle
de calcul du shell, seule puis sur les 4 cœurs ; médiane de 3 ; facteur par
rapport à `none` mesuré dans la même passe) :

| Freinage | Un cœur | Quatre cœurs | Charge du Mac |
|---|---|---|---|
| `ecoe` | × 13,1 | × 11,7 | 79-82 |
| `duty:50` | × 2,2 | × 1,5 | 47 |
| `duty:25` | × 6,3 | × 4,6 | 47 |
| `ecoe+duty:50` | × 11,4 | × 7,6 | 48 |
| `duty:15` | × 2,3 | × 1,4 | 54 |
| `duty:10` | × 3,1 | × 2,0 | 58 |

À lire avec prudence : **la base elle-même varie de × 3,8 d'une passe à
l'autre** selon la charge du Mac (588 à 2 232 ms pour la même boucle sans
frein), et `duty:15`/`duty:10`, mesurés dans une passe à la base lente,
paraissent moins freinés que `duty:25`. `ecoe` dépend entièrement des autres
sessions (× 13 à charge 80 ; ~× 3 au calme d'après le banc A6). Ordre de
grandeur visé : un Cortex-A53 à 1,6 GHz est ~2 fois plus lent qu'un A57 de la
Shield, lui-même ~8 fois plus lent qu'un cœur du M4 (A6) — soit un facteur
**~10 à 15** sur un cœur. `duty:25` à `ecoe+duty:50` s'en approchent ;
**comparer toujours deux versions sous le MÊME freinage, en alternance, et
noter la charge** (le parcours la relève à chaque mesure et alerte au-delà de
30).

## Le parcours (`parcours run`)

1. **Démarrage à froid** ×`--cold` : `am start -W` (première image de
   l'activité) puis `prêt:accueil` du mode de mesure (accueil interactif,
   compté depuis le lancement du processus).
2. **Mémoire au repos** : l'accueil chargé, 10 s sans rien toucher —
   `dumpsys meminfo` (PSS total, tas Java, tas natif, graphique, vues) et
   `/proc/meminfo` du système. Trace Perfetto du démarrage avec `--perfetto`.
3. **Écran par écran** (`LITE_ROUTE`, scénarios de `lib/scenarios.mjs`, chacun
   relancé à froid, placé sans mesure puis mesuré) : `focus-rangee`,
   `accueil-pas`, `rail` (accueil : rangées et rail), `page-films`, `grille`
   (bibliothèque Films), `fiche`, `saisons-episodes` (« Bleach »),
   `recherche`, `reglages` (onglets et panneau Lecture, sans rien changer),
   `lecteur` (l'habillage du lecteur). Par écran : fenêtres FrameMetrics du
   mode de mesure (phases, fil UI, rendus React), temps processeur PAR FIL
   (`ui`, `js` = `mqt_js`, `render`, `images`, `gc`…), `dumpsys gfxinfo`
   complet (images, ratées, « Slow UI thread », envoi des bitmaps, centiles)
   et la mémoire après le geste.
4. **Endurance** ×`--endurance` : sans relancer, des segments vérifiés (rangées ;
   fiche par « Plus d'infos » ; Films par le rail, grille tenue, retour à
   l'accueil), la mémoire après chaque tour — une fuite se lit à la pente.
   Chaque segment doit finir sur l'écran attendu (et passer par la fiche ou
   la bibliothèque) : une dérive ARRÊTE l'endurance, jamais de touches à
   l'aveugle. Trace Perfetto du premier tour avec `--perfetto`.
5. **Pression** (`--pressure`) : `am send-trim-memory` RUNNING_LOW puis
   RUNNING_CRITICAL (mémoire relevée après chacun), puis un mangeur de
   mémoire native (`keys/Hog.java`, 80 % de la mémoire disponible, montée
   lente) : l'app survit-elle, et quelles morts le lowmemorykiller relève.

`parcours compare` met deux `resume.json` face à face : démarrage, mémoire au
repos et en fin d'endurance, puis par écran images ratées, fil UI lent, p90,
CPU UI / JS / rendu, PSS et graphique — chaque écart en %.

**Images ratées.** Sur Android 12+, `Janky frames` se lit sur la chronologie
de SurfaceFlinger : 0 à l'émulateur (mesuré, contre 99 % en « legacy »). Le
banc prend la définition **legacy** (image au-delà de l'intervalle), la seule
comparable entre l'API 31 de l'émulateur et une box en Android 9 à 11.

## Profil de capacités simulé (BCM7271)

Le format est celui de **L3** (`packages/shared/src/playback/deviceMediaProfile.ts`,
`simulatedDeviceProfiles.ts` → `BCM7271_PROFILE`) : un seul type, une seule
source. Injection dans l'app de mesure (ou une build de développement)
seulement :

```bash
adb -s emulator-5642 shell setprop debug.tentacle.media_profile bcm7271   # puis relancer l'app
adb -s emulator-5642 shell setprop debug.tentacle.media_profile ""        # le vrai profil
```

Hypothèses du profil (à relever sur la vraie box) : HEVC Main / Main 10 4K60,
VP9 Profile 0 / 2 4K60, H.264 jusqu'en 4K30, pas d'AV1, pas de Dolby Vision ;
passthrough HDMI AC3 / E-AC3.

## Limites — ce que le banc NE prouve PAS

- **GPU** : `-gpu host` traduit GLES vers Metal sur le GPU du Mac. Rien à voir
  avec un VideoCore V : remplissage, envoi des textures, flous et dégradés
  coûtent autre chose. La phase `sync` (envoi des textures) passe par le tuyau
  de l'émulation (200-300 ms par image chargée, A6). `dumpsys meminfo` y rend
  **Graphics : 0** (la mémoire GPU de l'hôte n'est pas comptée) : la mémoire
  graphique ne se mesure que sur un vrai appareil.
- **Décodeurs** : ceux de l'émulateur (`c2.goldfish.*`, `c2.android.*`)
  décodent en logiciel ou sur l'hôte, par les cœurs et les bibliothèques du
  Mac (`androidboot.qemu.hwcodec.*` dans le journal de l'émulateur). **Les tests de codecs à l'émulateur
  ne prouvent rien** — ni débit, ni HDR, ni Dolby Vision, ni lecture directe.
  Le profil simulé ne teste que la DÉCISION (ce que l'app demande à Jellyfin),
  pas la lecture.
- **Processeur** : freiné en moyenne, pas en nature (pas de petits cœurs en
  ordre, pas de caches d'A53, pas de throttling thermique) ; et la base varie
  avec la charge du Mac.
- **Mémoire** : RAM totale juste, mais ni `isLowRamDevice`, ni tas de box, ni
  réglages du lowmemorykiller d'un constructeur, ni zram de la box.
- **Réseau** : le faux backend est local (pas de Wi-Fi, pas de débit réel).
- **Système** : pas de lanceur d'opérateur ni de ses services en fond.

## Ce qui ne se valide que sur le vrai matériel

À faire sur la box net+ (ADB en Wi-Fi si l'opérateur le permet, sinon par un
testeur externe), et en partie sur la Shield (baseline, Lite forcé) :

- la fluidité réelle de chaque écran (GPU VideoCore V, A53) et l'autoplay ;
- la mémoire graphique, le budget avant le lowmemorykiller (~100-200 Mo
  attendus), la survie pendant la lecture ;
- `isLowRamDevice`, `getMemoryClass`, SoC (`ro.board.platform`), et la
  décision Auto de L2 ;
- le profil de décodage RÉEL (MediaCodecList) contre le simulé, la matrice
  codecs × conteneurs × son × sous-titres, HDR10, la 4K sur une sortie 1080p ;
- le passthrough HDMI (E-AC3, TrueHD, DTS) selon l'ampli ;
- le Wi-Fi seul (débit, `LoadControl`) ;
- le démarrage à froid avec le lanceur de l'opérateur ;
- le changement de mode (Auto / Activé / Désactivé) sans perte d'état.
