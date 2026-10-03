# Scénarios de référence — focus, sections et rangées (T3)

`home-sections.json`, `home-hero.json`, `foryou.json` : les scénarios du
domaine « focus », au format figé par T2 (`.claude/nav-lot/FORMAT-SCENARIOS.md`).
Chacun cite dans `rules` les identifiants du relevé
(`docs/tv-navigation/focus.md`). Ils s'enregistrent sur le SHA de référence
`84f3cedd0`, puis doivent repasser à l'identique après l'extraction.

Les attentes de géométrie absentes (une carte « au centre le plus proche »)
se relèvent à l'enregistrement, et se relisent : le `why` de l'étape dit ce
que la valeur relevée doit être. Les jeux de données
vivent dans `fixtures.mjs` (`focus/home` : un filtre de plateformes sur la rangée
« Pour vous » de l'accueil et « Synopsis du héros N » sur les cinq reprises du
héros ; `focus/foryou` : le filtre sur la 1re étagère), par-dessus le jeu de
base du banc (Reprendre ×12, À suivre ×12, Déjà vus ×16, Ma liste ×1) ; les
`*.golden.json` ne s'écrivent jamais à la main : `record` les produit.

Couverts par d'autres domaines : C1 `claimAfterRestore` (T4 : déplacement
annulé dans le rail ; T7 : réglages › navigation), G1 `createEntryGuide`
(T6 : panneaux ; T7 : bibliothèque), K1 `useKeepFocusWithin` (T6 : voile
hors ligne), E1-E3 entrées de section (T7 : la fiche). Ce qu'un appui ne
sait pas montrer — le glisser du pavé, le pan, la parallaxe — se relit sur
l'Apple TV « Chambre ».
