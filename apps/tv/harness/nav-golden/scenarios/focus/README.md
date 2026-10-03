# Scénarios de référence — focus, sections et rangées (T3)

`scenarios.json` : les scénarios du domaine « focus », au format de T6 que
reprend le banc nav-golden de T2 (`do` / `expect` / `settleMs` / `why`).
Chacun cite dans `rules` les identifiants du relevé
(`docs/tv-navigation/focus.md`). Ils s'enregistrent sur le SHA de référence
`84f3cedd0`, puis doivent repasser à l'identique après l'extraction.

Les attentes de géométrie absentes (une carte « au centre le plus proche »)
se relèvent à l'enregistrement, et se relisent : le `why` de l'étape dit ce
que la valeur relevée doit être. Les jeux de données (`fixtures` du JSON)
vivent dans `fixtures.mjs`, à écrire au format du banc de T2.

Couverts par d'autres domaines : C1 `claimAfterRestore` (T4 : déplacement
annulé dans le rail ; T7 : réglages › navigation), G1 `createEntryGuide`
(T6 : panneaux ; T7 : bibliothèque), K1 `useKeepFocusWithin` (T6 : voile
hors ligne), E1-E3 entrées de section (T7 : la fiche). Ce qu'un appui ne
sait pas montrer — le glisser du pavé, le pan, la parallaxe — se relit sur
l'Apple TV « Chambre ».
