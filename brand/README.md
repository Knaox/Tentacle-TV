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

## Régénérer

Les cinq SVG **et** les constantes TypeScript du composant web sont générés :

```bash
python3 brand/generate-svg.py brand
```

Le script écrit `apps/web/src/components/ui/tentacleArmPaths.generated.ts` en
même temps que les SVG. Les bras sont des spirales échantillonnées : elles ne
s'écrivent pas à la main, et deux copies auraient fini par diverger. Après
régénération, recopier les fichiers publics :

```bash
cp brand/logo-color.svg apps/web/public/tentacle-logo-pirate.svg
cp brand/logo-mono.svg apps/web/public/tentacle-logo-mono.svg
cp brand/logo-color-nohat.svg apps/web/public/tentacle.svg
cp brand/logo-color.svg apps/tv-webos/shell/images/tentacle-logo-pirate.svg
```

`tentacleGeometry.ts` ne garde que ce qui se dessine à la main — corps, visage,
chapeau — et réexporte les bras depuis le fichier généré. Le composant web existe
séparément du fichier statique parce que lui seul résout les variables CSS : une
couleur de marque redéfinie par un administrateur doit se propager au logo.

## Trois règles apprises à leurs frais

- **Huit bras, pas sept.** Deux sont dressés en antennes : il en faut donc six en
  dessous. La première version n'en posait que cinq.

- **L'icône d'application doit remplir son cadre.** Play a déjà rejeté une
  livraison au motif que l'icône « ne remplit pas l'espace » : le poulpe
  occupe 86 % de la largeur, sur un fond plein — jamais de transparence, jamais
  de marge décorative. L'`ic_launcher_foreground` adaptatif Android est cadré
  plus large encore, le système en rogne les bords.
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
