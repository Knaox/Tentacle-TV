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

Contre-épreuve faite à la mise en place : retirer `Library` des pages du rail
fait échouer `verify` sur iOS.

L'arbre de référence et les bundles vont dans `out/` (ignoré par git).
