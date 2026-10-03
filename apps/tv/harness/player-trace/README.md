# Banc de traces du lecteur TV

Le filet d'équivalence de l'extraction du lecteur (lot « extraction de la
navigation Apple TV », T5 ; `docs/tv-navigation/lecteur.md`). Il monte les
VRAIS crochets du lecteur — `useTVPlayerControls` (défilement, maintien,
décompte, pavé, badge, gardes), `useTVPlayerBack`, `usePlayerBackLayers`,
`useOsdPin`, `usePlayerChromeActions` — dans React sans DOM, sur une horloge
factice, leur envoie des gestes tels que tvOS ou Android TV les émettent, et
relève tout ce qui en sort : seeks, pauses, sorties, Retour, et chaque
changement d'état (habillage, épingle, défilement, cible, vitesse, décompte,
badge, couches). Aucune vidéo, aucun simulateur : quelques secondes.

Les traces de référence (`../nav-golden/scenarios/lecteur/traces/{ios,android}`)
ont été enregistrées sur `84f3cedd0` (avant toute extraction). Un code qui
rejoue la même trace se comporte à l'identique, à la milliseconde.

## Commandes (depuis la racine du dépôt)

```bash
node node_modules/vitest/vitest.mjs run --config apps/tv/harness/player-trace/vitest.config.mjs
```

```bash
TRACE_PLATFORM=android node node_modules/vitest/vitest.mjs run --config apps/tv/harness/player-trace/vitest.config.mjs
```

Ajouter un scénario : l'écrire dans `scenarios.ts`, puis l'ENREGISTRER sur la
référence — jamais sur le code en cours d'extraction :

```bash
TRACE_WT="$(apps/tv/harness/player-trace/reference.sh)" TRACE_MODE=record node node_modules/vitest/vitest.mjs run --config apps/tv/harness/player-trace/vitest.config.mjs
```

(`reference.sh [commit]` extrait le code dans `~/Library/Caches/tentacle-player-trace`,
node_modules du dossier principal prêtés.) Une trace ne se retouche jamais à la
main.

## Ce que le banc simule

- `react-native` (`mocks/react-native.ts`) : `TVEventHandler` et
  `useTVEventHandler` (réinscrit à chaque nouveau gestionnaire, comme
  react-native-tvos), `TVEventControl` (pan tenu), `BackHandler` (Android),
  `Platform` (`TRACE_PLATFORM`). `require("react-native")` y est renvoyé
  (`setup.ts`).
- La portée du Retour (`mocks/BackScope.ts`) : la même pile vivante
  (`createBackLayers`) ; Menu = ce que fait `onMenuPress`.
- Le câblage de `PlayerScreen` / `PlayerRedesignStage` / `usePlayerChrome`
  (`rig.ts`) : `panelOpen`, fond focalisable, `osdShown`, panneaux, surfaces.
- tvOS : un appui n'arrive qu'au relâchement (a=1) ; un maintien dit son début
  (a=0) et sa fin (a=1) ; le pan n'arrive que s'il est tenu. Android : key-down
  (répétitions comprises) puis key-up.

Limites : pas de moteur de focus natif (le fond est réputé focalisé quand il
est focalisable et qu'aucune pilule n'est là), pas des vues ; les écrans
Android à leur propre `BackHandler` (affiche de fin, carte) ne sont pas montés.
