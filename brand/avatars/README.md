# La troupe des avatars

Les photos de profil qu'on choisit dans la galerie (bureau et web, menu de l'avatar
ou page Profil) : des PERSONNAGES, chacun avec son nom et son histoire de cinéphile
(`packages/shared/src/i18n/locales/*/avatars.ts`), rangés en trois collections
(`packages/shared/src/avatars/avatarCatalog.ts` : ordre, couleur d'attente,
tempérament au survol).

Aucune image n'est générée par une IA : chaque personnage est DESSINÉ ici, en
formes vectorielles (`characters/<id>.py`), puis « imprimé » par `riso.py` comme
une risographie — encres plates qui se multiplient en se superposant, trames de
points, grain et mouchetures, bords coupés à la main, passages décalés. Le
hasard est tiré du nom du personnage : le rendu est le même à chaque fois.

## Régénérer

```bash
python3 brand/avatars/generate.py                       # toute la troupe
python3 brand/avatars/generate.py lanterne bulle        # quelques-uns
python3 brand/avatars/generate.py --preview /tmp/avatars  # PNG ronds + planche, sans rien écrire
```

Il faut numpy, Pillow (avec WebP) et `rsvg-convert` (`brew install librsvg`). Sorties :
`apps/web/public/avatars/<id>.webp` (512 px, l'image envoyée à Jellyfin) et
`apps/web/public/avatars/thumbs/<id>.webp` (192 px, la grille). Elles ne se retouchent
jamais à la main.

## Dessiner un personnage

`characters/<id>.py` expose `draw()`, qui rend la liste des calques d'encre. Le plus
simple est une `Scene` (`scene.py`), dessinée de BAS en HAUT sur une toile 1000×1000 :

- `s.fill(encre, *formes)` — aplat ; il réserve (efface) tout ce qu'il recouvre ;
- `s.stroke(encre, épaisseur, *formes)` — trait ;
- `s.paper(*formes)` — le blanc du papier (blancs des yeux, reflets, rayures) ;
- `s.over(encre, *formes)` — aplat SURIMPRIMÉ : taches, verre coloré ;
- `s.tint(encre, densités, screen=…)` — trame surimprimée ; la densité vient de
  `shade()`, `lin()`, `rad()` ou `T(alpha, formes)` (`kit.py`).

Les encres sont celles de `riso.INKS`. Règles de la troupe :

1. Affiché en ROND, souvent entre 36 et 96 px : l'essentiel tient dans un cercle de
   rayon ~420 autour du centre ; vérifier à 72 px.
2. Un fond d'une seule encre (+ une trame d'ambiance, quelques motifs) ; le personnage
   en 2 à 4 encres et le papier ; une ombre tramée sur sa forme principale.
3. Les yeux portent la vie : blancs papier, pupille, reflet, et une expression par les
   paupières, les sourcils, le regard — jamais le même sourire générique.
4. Un accessoire (deux au plus) qui raconte son histoire, lisible en petit.
5. Pas de texte, pas de contour généralisé, pas de dégradé lisse (des trames).

Un nouveau personnage : son fichier ici, son entrée dans `avatarCatalog.ts` (identifiant
définitif — il nomme des fichiers et des clés de traduction), son nom et son histoire
dans les deux langues, puis `generate.py <id>`.
