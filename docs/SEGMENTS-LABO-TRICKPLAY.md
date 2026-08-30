# Segments et vignettes trickplay — relevés du labo (30.08.2026)

Ce document fixe ce qu'un labo d'une journée a MESURÉ sur les vignettes
trickplay (320 px, une image toutes les 10 s) d'un corpus réel de dix-neuf
médias, ce qui en a été retenu dans le code, et surtout les pistes FERMÉES
avec preuves — pour que personne ne les re-creuse de bonne foi.

## Corpus

Cinq films (Far From Home, Homecoming, Brave New World, No Way Home,
Deadpool & Wolverine) et quatorze épisodes (Re:Zero S4 E1–E6 et S2 E1–E3,
La Flamme S2 E1–E3, Cauchemar en cuisine S1 E1–E2). Pour chaque vignette :
part de noir, saturation, part de clair, densité d'arêtes, dHash 64 bits,
variance de luma, concentration de teinte. Vérité terrain établie à l'oeil
sur des planches-contact.

## La structure réelle d'un générique Marvel

    [film] → [crédits ILLUSTRÉS 2-3 min] → (scène mi-générique) →
    [crawl noir 6-8 min] → [scène post-générique] → [cartes/logos]

Far From Home : illustrés 115:30→117:50 (CLAIRS — collage), scène Daily
Bugle 117:50→119:10, crawl 119:10→127:20, scène 127:30→128:50.
Homecoming : illustrés 123:00→125:00 (comic art SATURÉ), scène prison
125:10→126:00, crawl, scène PSA grise 132:25→132:55. Brave New World :
illustrés 108:00→110:35 (SOMBRES, barres de couleur sat 8,7→27,2), crawl,
scène sombre 117:40→118:25.

Le spectateur ne RATE jamais la scène mi-générique : elle se joue toute
seule avant le crawl. Le seul enjeu du début des crédits est la date
d'apparition du bouton.

## Ce qui a été retenu (règles générales, aucun titre en dur)

1. **La borne de saut recule d'une vignette** : la transition vraie vit dans
   `(dernière vignette de générique, première vignette de scène]` — sauter
   sur la seconde arrivait jusqu'à 10 s APRÈS le début de la scène (3-5 s
   rapportés). Vérifié sur les cinq films : le saut atterrit désormais sur
   la dernière vignette du générique.
2. **SATURATION_MAX 18 → 28** : les cartes illustrées sombres de Brave New
   World montent à 27,2 — seule borne du corpus à bouger, les scènes de
   nuit restent loin (bataille de No Way Home : 9), les quatorze épisodes
   restent muets. Le NOYAU (défilement sur noir, sat ≤ 3) reste l'unique
   clef d'entrée d'un verdict.
3. **Accord des fins** (`END_AGREEMENT_MS`) : des fournisseurs qui posent le
   même Outro avec des fins à plus de 15 s d'écart ne décrivent pas la même
   chose — le candidat « révélateur » n'est plus préféré (Re:Zero S4E2 :
   fins à 42 s d'écart, contenu SOUS les crédits, faux post-générique).
4. **Gardes de vraisemblance** (`claimGuards.ts`) : aucune intro ne commence
   passé la moitié du média (S4E4 : l'opening joué pendant l'épilogue
   matchait l'empreinte audio → « Intro » à 82 % du fichier) ; un Outro
   chevauchant une intro ainsi écartée tombe avec elle.

## Les pistes FERMÉES, avec les chiffres

1. **Crédits illustrés CLAIRS (Far From Home, Homecoming) : indissociables
   du film par vignette.** Sept axes testés, distributions chevauchantes —
   FFH stylisé vs film : dark 0,03 vs 0,16 (p50), sat 38,6 vs 16,9 MAIS
   film p90 = 26,5 et scène mi-générique à 25,2 ; arêtes 0,088 vs 0,062 ;
   variance 768 vs 1326 ; mouvement dHash consécutif 29 vs 31 ; teinte
   0,94 vs 0,82. Aucun seuil sans faux positifs sur les scènes.
2. **Correspondance inter-épisodes (dHash) MORTE à 10 s d'intervalle** : le
   même ED d'une même saison matche à 0/8 vignettes (distance min 17/64)
   entre deux épisodes — la grille échantillonne l'animation à des phases
   différentes. Seules les CARTES STATIQUES exactes matchent (carte-titre
   de La Flamme : d = 4). Valider un ED ou une intro par similarité
   visuelle inter-épisodes ne marche PAS sur ce substrat.
3. **Récaps indétectables par hachage** : distances minimales de la zone
   récap de La Flamme S2E3 vers E1+E2 (p50 = 17) identiques à celles du
   contenu neuf (p50 = 17-18). Les récaps sont re-montés, re-cadrés,
   re-habillés — rien ne survit au dHash à cette granularité. La détection
   de récap sans greffon exige un autre substrat (audio, image pleine
   résolution).
4. **Extension corroborée par chapitres : abandonnée volontairement.** Les
   chapitres réels marquent parfois le début exact des crédits (BNW :
   107,93 ; Deadpool : 119,82) — mais ils marquent AUSSI les débuts de
   scènes, et une scène finale sombre contiguë au générique (profil mesuré
   de la bataille NWH : dark 0,88, sat 9, var 59 — indissociable de cartes
   illustrées) aurait produit un départ d'outro DANS la dernière scène,
   c'est-à-dire un auto-saut de contenu avec `outroFilm = auto`. Le silence
   vaut mieux qu'un faux bouton.

## La voie d'après (si on veut un jour le stylisé clair et les récaps)

Le bon substrat est l'AUDIO côté serveur (rupture musique/silence à l'entrée
des crédits, comme Intro Skipper le fait pour les épisodes) ou l'édition
manuelle (Segment Editor). Pas les vignettes.
