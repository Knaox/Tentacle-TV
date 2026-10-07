# Mode Lite : le montage (L5b)

Ce que les pages montent hors de l'écran : rangées, grille, épisodes,
résultats. Au niveau `normal`, rien ne change (Apple TV, Shield). En `lite`,
on borne ce qui vit hors de l'écran. Disposition, voisins, Retour et
défilement restent identiques : seules changent les vues natives qui existent
hors de la vue.

## Qui décide quoi

| Couche | Fichier | Rôle |
|---|---|---|
| Règle (pure) | `packages/tv-core/src/render/mountProfile.ts` | `MOUNT_PROFILES.normal` / `.lite`, `mountProfileOf(tier)` |
| Échelonnement | `packages/tv-core/src/render/rowStaging.ts` | `nextRelease(rows, tails)`, `rowHeadCards`, `headRelease` |
| Niveau | `apps/tv/src/redesign/render/renderProfile(.ios).ts` | `DEVICE_TIER` : la seule source du niveau dans la refonte (`tierFromDeviceConstants`) |
| Profil de l'appareil | `apps/tv/src/redesign/render/mountProfile.ts` | `MOUNT = mountProfileOf(DEVICE_TIER)` |
| Rangées | `redesign/rows/rowStage.tsx`, `MediaRow.tsx` | têtes, queues à la demande, retour à la tête |
| Grille | `redesign/screens/library/PosterGrid.tsx`, `useGridAhead.ts` | avance de FlashList à l'ouverture, puis élargie |
| Épisodes | `redesign/screens/detail/EpisodeRail.tsx` | fenêtre de la FlatList |
| Recherche | `redesign/screens/search/SearchResults.tsx` | rangées échelonnées, cartes recyclées |

## Les règles du Lite

| Réglage | Normal | Lite | Effet |
|---|---|---|---|
| `rowTails` | `eager` | `demanded` | La queue d'une rangée (au-delà de la tête) ne se monte que quand le focus quitte sa PREMIÈRE carte, deux cartes par image. Descendre de rangée en rangée ne monte aucune queue. |
| `fitRowHeads` | non (8) | oui | La tête est ce que l'écran montre, même en partie : 5 vignettes 16:9, 7 affiches. |
| `retireOffscreenRows` | non | oui | Une rangée remise au début (`rowRewindPort` : sortie de l'écran, page quittée) revient à sa tête, à l'image suivante, jamais sous le focus. |
| `stageSearchRows`, `recycleSearchCards` | non | oui | Les résultats sont échelonnés comme l'accueil ; leurs cartes sont clées par leur place, donc une frappe redessine au lieu de remonter. |
| `gridDrawDistance` | 1 100 | 0 | « Films » s'ouvre sur l'écran seul. À 0, FlashList ne s'étend pas au triple. |
| `gridActiveDrawDistance` / `gridWidenStep` / `gridWidenDelayMs` | 1 100 / — / — | 600 / 200 / 700 | 700 ms après l'arrivée des titres, ou au premier pas hors de la première ligne, l'avance passe à une ligne entière, par demi-ligne et par image. Avec BAS tenu, la ligne suivante est donc toujours montée. |
| `episodes` | 6 / 5 / 10 | 4 / 3 / 2 | `initialNumToRender` / `windowSize` / `maxToRenderPerBatch` de la liste des épisodes. |

Essayé puis écarté : monter la grille ligne par ligne, une par image. En A/B,
le pire temps d'image était de 94 à 148 ms sans cet étalement, et de 163 à
169 ms avec : FlashList refait sa mise en page à chaque ligne ajoutée.

## Mesures (AVD `Lite_L5b_2G`, 2 Go, 4 cœurs, 07/10)

« Avant » : dev avec L5a et L6 (`aeab988e5`), niveau Lite forcé. « Après » :
la même chose avec L5b. Les vues attachées viennent de `dumpsys gfxinfo`,
toutes fenêtres comprises. « Écran seul » compte le sous-arbre du `Screen`
dans `dumpsys activity top`. Charge du Mac entre 2 et 4.

| Lite | Avant | Après |
|---|---|---|
| Accueil au repos : vues attachées / PSS | 1 797 / 233 Mo | **821** / 188 Mo |
| « Films » : vues créées à l'ouverture / pire image | 1 651 / 63 ms | **1 100** / 54 ms |
| « Films » : écran seul | ~1 000 | 590 à 694 (après élargissement) |
| « Films » freiné (`duty:25`) : pire image | 725 ms | **431 ms** |
| Grille, BAS puis HAUT tenus : ratées / p95 / pire | 25,5 % / 69 / 125 ms | 36 % / 22 / 22 ms |
| Saisons : pile attachée / PSS / créées | 3 378 / 298 Mo / 454 | **1 940** / 233 Mo / 371 |
| Fiche de « Bleach » seule | 518 | **438** |
| Défilement tenu de l'accueil : ratées | 36,7 % | 20,8 % |
| Recherche : attachées après 3 frappes | 2 328 | 1 352 |

Au niveau normal, la structure est identique avant et après : 1 810 vues au
repos, 1 715 créées à l'ouverture de « Films », 139 pendant la grille tenue,
175 par frappe, et les mêmes vues attachées sur chaque écran.

La grille tenue rate plus d'images en Lite après qu'avant : 36 % contre
25,5 %. C'est le prix du recyclage. Avec 1 100 points d'avance, triplés à
l'ouverture, « Films » (48 titres) montait toute sa grille d'un coup, et BAS
tenu ne montait plus rien. Avec 600 points, les lignes se recyclent, et leurs
images se remontent. En contrepartie, le p95 et la pire image baissent. Une
avance active de 1 100 points a été essayée en A/B : aucun écart (32-33 %
contre 36 %, mêmes vues créées).

L'essentiel des vues encore attachées vient des écrans RECOUVERTS (accueil,
bibliothèque). Ils sont gardés montés pour que le focus revienne au bon
endroit ; en Lite, L6 les rend invisibles et relâche leurs images.

## Banc

```bash
node lite.mjs parcours run <AVD> … --tier lite|normal   # vues attachées par écran dans le journal et resume.json
```

Le chemin `saisons-episodes` passe désormais par HAUT puis BAS : selon que le
catalogue est arrivé ou non, la page ouverte par le rail pose le focus sur la
première affiche ou sur la barre des filtres, et HAUT puis BAS ramène dans
les deux cas à la première affiche. Avec un faux backend neuf, la mise en
place échoue encore : il sert son premier catalogue en plus de 10 s, et la
grille est vide quand on y arrive. Contournement : un faux backend déjà
chaud (`lite.mjs setup`) et un pilote gardé.
