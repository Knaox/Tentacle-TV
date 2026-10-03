# Banc de traces des panneaux et des cartes — sans simulateur

La preuve que le branchement de T6 (lot « extraction de la navigation Apple
TV ») ne change rien. Le banc monte les VRAIS modules de chaque arbre sans DOM
ni simulateur (react-dom 19 sur un conteneur factice, `act`), rejoue les mêmes
scénarios et relève une trace par unité :

| Unité | Ce qui est monté | Ce qui est relevé |
|---|---|---|
| `choiceEntry` | `useChoiceEntry` sur un vrai magasin de focus | verrous posés et levés (liaisons et nœuds), libérations, filet de 800 ms |
| `sheetFocus` | `useSheetFocus` (l'applicateur, où qu'il vive) et ses trois guides | garde de chaque cible, verrous, ce que vise chaque `TVFocusGuideView` |
| `focusTarget` | `FocusTarget` sous une liaison gardée ou libre | OK comptés ou ignorés, appui visible |
| `sheetRows` | `sheetRows` sur 96 combinaisons | les pictos (ordre, libellés, état, complément) |
| `ratingPanel` | `RatingPanel` + `RatingRuler` | textes, étoiles, crans (distance, retrait, désactivés), glissement |
| `offline` | `OfflineOverlay` | le double appui de « Déjumeler », les clés |
| `cardActions` | `useCardActions` | la note (posée, en attente, rien), le survol, la lecture, l'effet de chaque picto |
| `actionSheet` | `ActionSheetRedesign` dans la portée du Retour | Modal présentée, sortie, fermeture, Menu pris d'avance, mode « Noter » |
| `seasons` | `SeasonsSheetRedesign` dans la portée du Retour | présentation, verrous, cocher, Lecture/Pause, Menu, filet |
| `absentSheet` | `AbsentSheetRedesign` dans la portée du Retour, ses cibles montées par la doublure de la vue | présentation (état su, filet de 900 ms), entrée et verrous, « Demander » après la sortie (noté, jamais envoyé), Menu par la Modal et par la portée, la croix, titre déjà demandé, arrivé, sans offre, en échec ; clé et options de la lecture de l'état |

```bash
node apps/tv/harness/panels-trace/bench.mjs record   # 84f3cedd0 → traces/84f3cedd0.json
node apps/tv/harness/panels-trace/bench.mjs verify   # arbre courant : traces identiques exigées
```

Les doublures (`stubs/`) remplacent react-native (les vues natives notent leurs
props, `TVEventHandler` reçoit des événements du banc), reanimated (animations
instantanées), react-i18next (les clés), la navigation, l'api-client (l'état
que pose le scénario, chaque écriture notée), react-query (`useQuery` rend
l'état posé et inscrit ses options), le direct des demandes Vigie (éteint) et
les vues qui ne font que dessiner — les mêmes pour les deux arbres. Une
horloge factice joue les filets dans l'ordre.

Contre-épreuve faite à la mise en place : `RATING_ENTRY` à 6, la garde
anti-clic fantôme désarmée et le filet de la feuille des saisons à 1 400 ms
font échouer `verify` (sheetFocus, ratingPanel, focusTarget, seasons). Pour
`absentSheet` (ajoutée ensuite, les neuf autres traces inchangées) : le filet
du panneau absent à 950 ms, sa couche du Retour coupée pendant la sortie, la
croix sortie des verrous d'entrée, l'entrée qui n'attend plus le filet — chacune
fait échouer `verify` (absentSheet ; sheetFocus aussi pour les verrous).

L'arbre de référence et les bundles vont dans `out/` (ignoré par git).
