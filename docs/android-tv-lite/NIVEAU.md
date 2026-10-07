# Mode Lite — le niveau de rendu de l'appareil (L2)

Le niveau de rendu vaut `normal` (la refonte telle quelle) ou `lite` (mêmes
écrans, mêmes gestes, des effets sobres). C'est un TRAIT : l'Apple TV vaut
toujours `normal` et ne lit aucun module natif.

## Qui décide quoi

| Couche | Fichier | Rôle |
|---|---|---|
| Règle (pure) | `packages/tv-core/src/device/renderTier.ts` | signaux → niveau + raison |
| Cœurs faibles | `packages/tv-core/src/device/cpuCores.ts` | table `implementer:part` |
| Simulation | `packages/tv-core/src/device/signalOverride.ts` | grammaire des propriétés de débogage |
| Retour après rechargement | `packages/tv-core/src/device/reloadReturn.ts` | la pile d'écrans à rouvrir |
| Lecture native | `apps/tv/android/…/device/` | `DeviceSignals`, `CpuProbe`, `MicroBench`, `RenderTierStore`, `DeviceModule` (`TentacleDevice`) |
| Point d'entrée JS | `apps/tv/src/platform/renderTier/` | `index.ts` (Apple TV : normal), `index.android.ts` |
| Réglage | `redesign/screens/settings/LiteModeSection.tsx`, `redesignWiring/settings/useRenderTierSetting.ts` | Réglages › Apparence, Android TV seulement |

## Quand

1. **Avant la première image** : `Application.onCreate` lance la lecture des
   signaux sur un fil à part (9 à 22 ms sur la Shield) ; le JS les lit en
   constantes au chargement et la règle de tv-core décide. Le premier écran
   est déjà dans le bon mode.
2. **Le micro-test** tourne 8 s après le lancement, hors du fil d'interface,
   250 ms au plus, une fois par signature (empreinte du système + résolution
   de sortie). Son score ne vaut qu'au lancement SUIVANT ; il ne peut que
   faire passer en Lite, jamais l'inverse. Une signature changée le fait
   refaire ; l'ancien score vaut en attendant. Jamais gardé dans une build
   debuggable (ART n'y emploie pas le code précompilé du système : score ~0).
3. **Le réglage** (`auto` / `on` / `off`) vit dans le natif
   (`SharedPreferences tentacle_render_tier`). Le changer REDÉMARRE l'app
   (activité relancée dans une tâche neuve, processus terminé : caches
   natifs vidés) et rouvre la pile quittée — Accueil → Réglages › Apparence,
   le focus sur l'onglet — par l'état initial de la navigation ; la session
   reste. Recréer seulement le contexte React laissait deux écrans Réglages
   superposés ; rejouer la pile par `push` laissait le focus à l'accueil
   recouvert (relevés à l'émulateur).

## Les seuils

| Critère (dans l'ordre) | Lite si | Raison |
|---|---|---|
| Déclaration du fabricant | `isLowRamDevice()` | `lowRamDevice` |
| Mémoire | RAM vue ≤ 2 560 Mio (2 Go nominal ≈ 1,8-1,9 Gio ; 3 Go ≈ 2,7-2,9) | `lowRam` |
| Processeur | TOUS les cœurs reconnus faibles (A5/7/8/9/32/35/53/55/510/520, Brahma-B53, Kryo Silver) | `weakCores` |
| Micro-test (lancement précédent) | score < 0,7 unité/ms | `slowBench` |
| Sinon | normal | `capable` / `unknown` |

Le forçage de débogage passe avant le réglage, qui passe avant l'automatique.

## Les appareils de référence

| Appareil | Verdict | Pourquoi |
|---|---|---|
| Shield TV Pro (lue le 07/10 : 2 946 Mio, 4 × A57, micro-test 1,06) | normal | `capable` |
| Box net+ (BCM7271, 2 Go, 4 × B53) | Lite | `lowRam` (et ses cœurs seraient aussi `weakCores`) |
| Android TV à 1 Go | Lite | `lowRamDevice` |
| Appareil inconnu (rien de lu) | normal | `unknown` — le micro-test est le filet |
| Puissant à 2 Go | Lite | la mémoire est la limite dure ; « Désactivé » reste offert |
| big.LITTLE dont `/proc/cpuinfo` ne montre que les petits cœurs | normal | il faut l'identité de TOUS les cœurs |

Tableau complet : `renderTier.test.ts`.

## L'API (pour L5, L6)

```ts
import { RENDER_TIER, useRenderTier, useRenderTierState } from "../../platform/renderTier";
const tier = useRenderTier(); // "normal" | "lite" — constant pour la vie du JS
```

Le niveau ne change jamais en cours de session : une constante suffit,
aucun abonnement. `useRenderTierState()` donne aussi la raison, le réglage et
le verdict de l'automatique.

La refonte (`apps/tv/src/redesign/`) n'importe pas l'app : son profil de
rendu relit le niveau dans les constantes de `TentacleDevice` par le MÊME
calcul pur (tv-core `tierFromDeviceConstants`, aussi employé par
`platform/androidtv/renderTier`).

## Ce que le niveau change à l'écran (L5a : les effets)

Le profil de rendu Lite (tv-core `render/liteProfile.ts`, `LITE_PROFILE`,
choisi par `renderProfileFor("androidtv", tier)`) — une variante du profil
d'Android TV ; les vues lisent ses champs, jamais le niveau :

| Champ | Normal | Lite |
|---|---|---|
| `motionStyle` | ressorts et fondus de `TV_MOTION` | `brief` : sans ressort, 150 ms au plus, l'accessoire posé (`liteMotion.ts`) |
| `cardFocus` | × 1,08, ombre ou lueur, reflet | `outline` : liseré #8B5CF6 de 4 px, à la taille de la carte (`CARD_FOCUS_SCALE` = 1) |
| `ambient` | trois lumières de l'œuvre | `tint` : une teinte statique venue d'en haut, un fondu de 150 ms |
| `shadows` | `mask` (masque flouté) | `border` : bord blanc à 10 % |
| `glass` | voile, reflet, liserés | `flat` : l'aplat de la même teinte, bord fin |
| `gradients` | tous les arrêts | `twoStop` (`twoStopGradient.ts`) |
| `pageTransition` | fondu de 320 ms | `cut` |
| `heroDelayFactor` / `heroTextSwap` | 8 s, texte en fondu | 12 s, texte posé, l'image seule fond |

Les halos (flous) sont gardés : ils ne coûtent rien (masque natif). Apple TV :
aucun Lite (`renderProfileFor("tvos", …)` rend toujours son profil).
Différentiel visuel : banc `lite.mjs parcours run … --tier normal|lite --shots
--only vue-fiche,vue-rail,…`.

## Débogage et banc

```bash
adb shell setprop debug.tentacle.lite 1             # Lite forcé (0 : normal forcé)
adb shell setprop debug.tentacle.lite.signals netplus   # profils : netplus, 1gb, shield, unknown
adb shell setprop debug.tentacle.lite.signals "lowram=1,ram=900,parts=0x41:0xd03*4,bench=0.5"
adb shell setprop debug.tentacle.lite.bench rerun   # now : aussitôt · rerun : après 8 s · 0 : jamais
adb shell "setprop debug.tentacle.lite.signals ''"  # revenir aux vrais signaux
adb logcat -s TentacleLite                          # signaux, micro-test, décision
```

Puis relancer l'app. Valable sur toute build (aucun réglage système : ce ne
sont que des entrées de la règle). `isLowRamDevice()` reste faux aux
émulateurs Android TV (images `user`) : `lowram=1` le simule.
