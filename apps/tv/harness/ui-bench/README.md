# Banc UI — la refonte TV, écran par écran, sans compte ni navigateur

Les VUES de `src/redesign/` montées sur un instantané du compte de test
Knaoxtest, dans un simulateur Apple TV à soi. Aucune session, aucune
navigation de l'app, aucun lecteur : une scène = un écran dans un état. On
regarde dans Simulator.app, ou on reçoit des planches (captures assemblées).

## Commandes

Depuis `apps/tv` (`pnpm bench:ui <commande>` ou `node harness/ui-bench/bench.mjs <commande>`) :

| Commande | Effet |
|---|---|
| `up` | Metro (8094) + relais du banc (8093), au premier plan. À laisser tourner. |
| `sim` | Simulateur « Banc UI TV (Claude) » : cloné une fois du modèle 1080p, branché sur le relais, démarré, app lancée. |
| `launch` | Relance l'app du banc. |
| `list [préfixe]` | Les scènes du catalogue. |
| `scene <id>` · `menu` · `next` · `prev` | Ouvrir une scène, revenir au catalogue, passer à la suivante. |
| `focus <clé>` · `focus off` | Figer le focus sur un élément, ou rendre la main au focus natif. |
| `glass on\|off` · `lang fr\|en` | Liquid Glass demandé ou coupé (verre enrichi) ; langue. |
| `shot [nom]` | Capture 1920×1080 de l'écran courant dans `out/`. |
| `planche [préfixe] [--focus] [--lang=fr,en] [--glass=on,off]` | Toutes les scènes du préfixe, dans chaque variante demandée, capturées puis assemblées dans `out/<date>-<préfixe>/planche-NN.png`. |
| `snapshot` | Tire l'instantané Knaoxtest (voir plus bas). |

Chaque commande attend que le banc ait AFFICHÉ l'état demandé (images
préchargées, animations posées) avant de rendre la main : une capture ne
montre jamais un état intermédiaire.

## Regarder dans le simulateur

Clavier du Mac dans la fenêtre Simulator : flèches = pavé, Entrée = OK,
Échap = Menu. Le catalogue liste toutes les scènes par écran ; Menu revient au
catalogue. Dans une scène, Lecture/Pause (fenêtre « Apple TV Remote ») fige le
focus sur l'élément suivant, puis rend la main au focus natif après le
dernier. L'enregistrement d'un fichier se voit aussitôt (Fast Refresh à
travers le relais) ; un rechargement complet rouvre la scène en cours, dont
l'état vit dans le relais.

## Ajouter une scène

Un fichier par écran dans `scenes/` (ex. `scenes/homeScenes.tsx`), ajouté à
`scenes/index.ts`. Une scène tire les props de sa vue de l'instantané
(`BenchData`) avec les MÊMES fonctions partagées que l'app (`cardMarkers`,
`cardOverlay`…) et déclare ses `focusKeys` : ce sont les `focusKey` que la vue
passe à `useFocusVisual` (`src/redesign/focus/focusPreview.tsx`).

Les vues vivent dans `src/redesign/` et n'importent ni l'api-client, ni la
navigation, ni le stockage, ni le lecteur, ni aucune logique de focus : le
lint le refuse (`eslint.config.js`, bloc « refonte de l'UI TV »).

## L'instantané

`snapshot/` (ignoré par git) : `snapshot.json` + les images Primary, Thumb,
Backdrop et Logo de ~80 titres — films, séries à plusieurs saisons, animés,
épisodes, personnes, sagas — avec leurs états réels (reprise, vu, favori, Ma
liste, notes). Format : `data/snapshotFormat.ts`. Compte **Knaoxtest**, et lui
seul, par une session à jeton d'appareil sur le backend de DÉVELOPPEMENT ;
jamais un mot de passe. Sans instantané, le banc tourne quand même : les
scènes montrent leurs états vides.

## Pièges

- **Menu au catalogue quitte l'application** (racine de la pile) : `launch`.
- **Inter n'est pas embarquée dans l'app tvOS** : ni `.ttf` dans le paquet, ni
  `UIAppFonts`. Le simulateur rend en San Francisco tant que la police n'est
  pas ajoutée au projet natif (tâche à part : il faut reconstruire l'app).
- Le simulateur du banc est un clone : les autres sessions gardent les leurs.
  Pour repartir de zéro : `xcrun simctl delete "Banc UI TV (Claude)"` puis `sim`.
- Le relais écoute sur 127.0.0.1 seulement ; ports par `BENCH_PORT` et
  `METRO_PORT` si une autre session les occupe.
