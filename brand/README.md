# Sources de marque — la mascotte Tentacle TV

Source unique de vérité pour le logo. Tout PNG/ICNS/ICO/WEBP du dépôt est
**dérivé** de ces fichiers ; aucun ne se retouche à la main.

| Fichier | Rôle |
|---|---|
| `logo-color.svg` | Le logo officiel : poulpe-téléviseur coiffé du tricorne. viewBox 240×240, fond transparent. |
| `logo-mono.svg` | Version monochrome, une seule masse en `currentColor`, détails creusés au masque. Pour fond de marque, gravure, filigrane, monochrome imposé. |
| `logo-color-nohat.svg` | Sans le chapeau. **À servir sous 24 px** (favicon, badge) : le tricorne y devient une masse indistincte. |
| `app-icon-color.svg` | Icône d'application, 1024², poulpe couleur sur fond cinéma. |
| `app-icon-mono.svg` | Icône d'application, 1024², mono blanc sur dégradé de marque. |
| `app-icon-rounded.svg` | La même, **à coins continus**, pleine cadre. Windows et Linux, qui posent l'image telle quelle. |
| `app-icon-macos.svg` | La même au gabarit macOS : le squircle tient 824 sur 1024, marge comprise. |
| `tvos-back.svg` · `tvos-light.svg` · `tvos-body.svg` · `tvos-front.svg` | Les quatre COUCHES de l'icône Apple TV (400×240 ; l'App Store la prend à 1280×768), de l'arrière vers l'avant : fond, lumière de la marque, poulpe, bras avant. Composées dans `tvos.py`. |
| `banner-topshelf.svg` · `banner-topshelf-wide.svg` | Le Top Shelf Apple TV : la nuit et la lumière de l'icône, la mascotte au centre. |
| `launch-logo.svg` | Le logo de l'écran de lancement Apple TV : la mascotte du démarrage (`BootView`) dans sa lueur — ils se retouchent ensemble. |
| `logo-server.svg` · `logo-server-nohat.svg` | Le logo de **Tentacle Server pour Windows** : la même mascotte, et un badge « serveur » (deux unités de baie) détouré en bas à droite. Composé dans `server.py` ; sans chapeau sous 24 px. Recopié chez l'hôte : `apps/server-windows/assets/logo.svg`. |

## Régénérer

Les SVG **et** les constantes TypeScript du composant web sont générés :

```bash
python3 brand/generate-svg.py brand
```

Le script écrit `apps/web/src/components/ui/tentacleArmPaths.generated.ts` en
même temps que les SVG (et `apps/server-windows/assets/logo.svg`). Les bras sont des spirales échantillonnées : elles ne
s'écrivent pas à la main, et deux copies auraient fini par diverger. Après
régénération, recopier les fichiers publics :

```bash
cp brand/logo-color.svg apps/web/public/tentacle-logo-pirate.svg
cp brand/logo-mono.svg apps/web/public/tentacle-logo-mono.svg
cp brand/logo-color-nohat.svg apps/web/public/tentacle.svg
cp brand/logo-color.svg apps/tv-webos/shell/images/tentacle-logo-pirate.svg
```

`tentacleGeometry.ts` n'écrit plus rien à la main : depuis « l'Étreinte »
(2026-09), il ne fait que réexporter le module généré — bras, tête, écran,
visage et chapeau. Le composant web existe séparément du fichier statique parce
que lui seul résout les variables CSS : une couleur de marque redéfinie par un
administrateur doit se propager au logo.

Les binaires (PNG, WEBP, ICO, ICNS) :

```bash
python3 brand/generate-icons.py --write              # tout
python3 brand/generate-icons.py --write msix server-windows/assets   # Windows seulement
```

Il faut Pillow et un moteur SVG : `rsvg-convert` (brew install librsvg) ou,
sous Windows où librsvg ne s'installe pas, `resvg-py` (pip install resvg-py).

## Windows : les paquets MSIX et leur `resources.pri`

`windows.py` tient la table des visuels des DEUX paquets (bureau, Tentacle
Server) : chaque visuel du manifeste à 100, 125, 150, 200 et 400 %, et
l'icône de la liste (`Square44x44Logo`) à ses 14 tailles cibles, chacune en
trois habits — sur plaque, `altform-unplated` (thème sombre),
`altform-lightunplated` (thème clair). Ils sont CRÉÉS d'après la table, la
mascotte seule sur transparent, recadrée en vectoriel autour de son
encombrement mesuré : 92 % du cadre sans plaque, 78 % sur plaque, 62 % pour
les tuiles et l'écran de lancement. Le manifeste garde les noms nus
(`Assets\Square44x44Logo.png`) : c'est `resources.pri`
(`.github/scripts/msix-resources.mjs`, lancé par les deux assemblages) qui les
résout vers leurs variantes.

## Cinq règles apprises à leurs frais

- **Huit bras, pas sept.** Deux sont dressés en antennes : il en faut donc six en
  dessous. La première version n'en posait que cinq.

- **L'icône d'application doit remplir son cadre.** Play a déjà rejeté une
  livraison au motif que l'icône « ne remplit pas l'espace » : le poulpe
  occupe 86 % de la largeur, sur un fond plein — jamais de transparence, jamais
  de marge décorative. L'`ic_launcher_foreground` adaptatif Android est cadré
  plus large encore, le système en rogne les bords.

- **Le carré est pour les boutiques mobiles, pas pour les bureaux.** iOS et
  Android masquent l'icône eux-mêmes et exigent donc un carré plein ;
  Windows, Linux, et macOS d'avant Tahoe posent l'image TELLE QUELLE — un carré
  plein y reste un carré dans la barre des tâches. D'où `app-icon-rounded.svg`
  et son gabarit macOS, et la règle de `generate-icons.py` : les icônes de
  l'exécutable (`apps/desktop-electron/icons/`) en dérivent, les boutiques
  mobiles gardent le carré, et les paquets MSIX n'en prennent aucun (règle
  suivante).

- **Windows pose sur une plaque ce qu'il ne trouve pas « unplated ».** Sans
  `Square44x44Logo.targetsize-*_altform-unplated.png` (et sa version
  `lightunplated`) DANS `resources.pri`, la barre des tâches, Démarrer et la
  recherche posent l'icône réduite sur une plaque à la couleur d'accent. Le
  carré à coins continus des deux paquets y débordait d'une bordure bleue —
  relevé sur le Store en 2026-10. Un visuel MSIX est donc la mascotte seule,
  sur transparent, sans aucune plaque peinte ; une tuile garde au moins 16 %
  de marge. Sans l'index, même présentes, les variantes sont invisibles.

- **Le nom des fichiers publics ne change pas.** `tentacle-logo-pirate.svg` est
  chargé par URL depuis les iframes de plugins — y compris des plugins déjà
  publiés, hors de ce dépôt. Renommer le fichier casserait leur affichage en
  silence. On remplace le contenu, jamais le nom.

## La forme des bras : trois approches, une retenue

- **Trait à largeur dégressive sur trajectoire simple.** Produit toujours un tube
  lisse à bout arrondi, dont la forme prêtait à confusion. Écartée.
- **Contour fermé festonné**, ventouses dans la silhouette. Juste en principe,
  mais là où un tentacule s'enroule, le rayon de courbure passe sous la
  demi-largeur et le bord concave se retourne : le bras s'ouvre de fentes. Sans
  enroulement, les bras deviennent des piques. Écartée.
- **Spirale**, retenue. La forme enroulée est la signature du tentacule et lève
  l'ambiguïté par la silhouette. Le trait reste la méthode de rendu, qui ne peut
  produire aucun artefact.

Deux réglages à ne pas défaire :

- **L'enroulement reste SOUS un demi-tour.** Au-delà, la spirale se referme et
  l'extrémité lit « crochet ».
- **`stroke-linejoin="round"` est obligatoire.** Les bras sont des polylignes :
  chaque sommet est une jointure, et la valeur par défaut `miter` projette sur un
  angle aigu une pointe pouvant atteindre quatre fois l'épaisseur du trait. Sans
  lui, de longues piques triangulaires sortent d'entre les tentacules, aux
  jonctions entre la descente et la spirale.
- **Le relief vient des ventouses, pas d'une arête lumineuse.** Une bande claire
  décalée le long du bras le délave au lieu de l'arrondir. Chaque ventouse est
  posée sur son ombre, et l'opacité vit sur le GROUPE — sur chaque cercle, les
  recouvrements des paliers de `dasharray` la cumulent et doublent l'effet.

## Le mono n'est pas un filtre

`filter: brightness(0) invert(1)` sur `logo-color.svg` ne produit PAS
`logo-mono.svg` : il aplatirait le tube, les yeux et le corps dans la même
valeur, et la mascotte deviendrait une tache. Le mono creuse ses détails au
masque et détache chaque tentacule d'un liseré — sans quoi les cinq bras
fusionnent en une masse informe.
