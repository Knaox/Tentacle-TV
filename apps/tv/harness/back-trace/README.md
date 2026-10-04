# Banc de traces du Retour — la portée de chaque écran, sans simulateur

La portée du Retour (`redesignWiring/back/BackScope`) est posée par le
navigateur autour de CHAQUE écran (`navigation/AppNavigator.tsx`, partagé avec
Android TV). Ce banc la monte sans DOM ni simulateur (react-dom 19 sur un
conteneur factice, react-native et react-navigation en doublures), inscrit des
couches comme le font les écrans, simule des appuis Menu, et relève une trace :

- la vue native rendue et son `enabled` — la décision d'AVANCE de tvOS ;
- à chaque appui, qui le reçoit (l'app, ou la plateforme : UIKit, qui quitte)
  et ce qui se passe (couche appelée, `goBack`) ;
- tout appel à BackHandler ou à la navigation globale (il n'y en a aucun).

Les mêmes scénarios (`harness.tsx`) tournent pour iOS ET pour Android, sur le
SHA de référence et sur l'arbre courant :

```bash
node apps/tv/harness/back-trace/bench.mjs record   # 84f3cedd0 → traces/84f3cedd0.json
node apps/tv/harness/back-trace/bench.mjs verify   # arbre courant : traces identiques exigées
```

`verify` exige aussi que `useBackLayers` (couches déclarées en liste) redonne,
scénario par scénario, la trace des couches inscrites une à une
(`useBackLayer`).

Scénarios : accueil à la racine (rail, Réglages, sortie), page du rail
au-dessus de l'accueil, fiche poussée (panneau, recul), étagère poussée avec
rail, lecteur (menu > habillage > page), rang égal (le plus récemment activé,
mise à jour sans changer de rang), jumelage à la racine, appui pris puis
couche désactivée avant le relâchement (relevé B3), couche démontée.

**Android refondu** (lot « Android TV = Apple TV ») : `verify` construit en plus
le banc pour Android avec l'aiguillage de la refonte forcé à vrai — la portée
d'Android TV (`platform/androidtv/back/AndroidBackScope`), l'appui Retour rejoué
comme Android le donne (écouteurs de BackHandler du dernier au premier). Chaque
appui des scénarios communs doit produire le MÊME effet qu'iOS ; là où UIKit
quitte, Android appelle `exitApp`. Deux écarts voulus, écrits dans `bench.mjs`
(`ANDROID_EXPECTED`) : l'appui pris d'avance puis avalé (B3) n'existe pas sur
Android, qui décide au relâchement ; un écran qui n'est pas devant laisse passer
l'appui (`ecran-derriere`, scénario propre à Android). Contre-épreuve : une
sortie rendue à la plateforme (`return false`) fait échouer quatre scénarios.

Contre-épreuve faite à la mise en place : retirer `Library` des pages du rail
fait échouer `verify` sur iOS.

L'arbre de référence et les bundles vont dans `out/` (ignoré par git).
