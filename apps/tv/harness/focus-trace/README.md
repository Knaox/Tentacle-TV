# Banc de traces du focus — les applicateurs, sans simulateur

Les applicateurs du focus de l'Apple TV (`platform/tvos/focus/`, réexportés
aux anciens chemins de `redesignWiring/`) montés sans DOM ni simulateur
(react-dom 19 sur un conteneur factice ; react-native, react-navigation et
Reanimated en doublures ; une horloge factice qui tient minuteurs et
`Date.now`). Chaque scénario relève une trace — ce que les applicateurs posent
sur les nœuds natifs (`setNativeProps`, `requestTVFocus`), les destinations des
guides, les clés suivies, les appels « au-delà », les titres du héros — sur le
SHA de référence et sur l'arbre courant :

```bash
node apps/tv/harness/focus-trace/bench.mjs record   # 84f3cedd0 → traces/84f3cedd0.json
node apps/tv/harness/focus-trace/bench.mjs verify   # arbre courant : traces identiques exigées
```

| Scénario | Ce qu'il éprouve |
|---|---|
| `storeTracking` | la clé courante et la dernière, un flou en retard |
| `storeClaims` | la réclamation tvOS (40 / 50 / 120 ms), en attente du montage, annulée |
| `restoreClaims` | la reprise après restauration : 300 ms, 850 ms, 950 ms, la cible d'abord |
| `entryGuides` | le guide d'entrée d'un groupe, avec et sans mémoire |
| `keepWithin` | la garde d'une surface : voisin à 20 ms, à 70 ms, écran d'en dessous, nulle part |
| `entryFocus` | l'arrivée (préférence, réclamation, clôture à 400 / 550 / 650 / 1 200 ms), le retour |
| `beyondEdge` | au-delà du bord : le geste qui y amène, 360 ms, les appuis, glisser, maintiens |
| `heroRotation` | la rotation du héros : gestes, Menu, pas du focus, maintiens, hors champ, inactive |
| `detailEntries` | les entrées de la fiche : la règle d'origine contre `useFirstVisitEntry` |

Ce qui diffère entre les deux arbres est aiguillé par `bench.mjs` (chemin
déplacé, direction « right » → « droite », Menu par l'entrée unique, entrées
de la fiche par la primitive). Contre-épreuves faites à la mise en place, une
à une : reprise à 800 ms, garde à 100 ms, arrivée à 600 → 700 ms, bord à
300 ms, Retour qui relance la rotation, première visite jamais désarmée,
groupe sans mémoire — chacune fait échouer `verify`.

L'arbre de référence et les paquets vont dans `out/` (ignoré par git).
