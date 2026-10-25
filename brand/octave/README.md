# Octave — le logo du mode musique

La mascotte de Tentacle, intacte (bras, tête, visage, tricorne), qui tient une
**note de musique à la place de l'écran**. Rien ici ne se retouche à la main :

```bash
python3 brand/octave.py                              # brand/octave/ + le module TS du web
python3 brand/octave.py --sheet /chemin/planche.png  # en plus, la planche de comparaison
python3 brand/octave.py /tmp/apercu                  # aperçu ailleurs, sans le module TS
```

`octave.py` LIT les pièces du logo dans `generate-svg.py`, exécuté vers un
dossier jetable : le logo d'origine et ses fichiers ne sont jamais réécrits
(`git diff --stat brand/` ne montre que les fichiers d'Octave). Une retouche du
poulpe se fait dans `generate-svg.py`, puis `octave.py` se relance.

| Fichier | Rôle |
|---|---|
| `logo-octave.svg` · `-nohat` | Couleur, pour fond CLAIR : la note a la vitre sombre de l'écran (`gT`). |
| `logo-octave-on-dark.svg` · `-nohat` | Couleur, pour fond SOMBRE : la vitre devient le blanc lavé des yeux (`gN`) — une vitre sombre y laissait un contour vide, illisible à 16 px. |
| `logo-octave-mono-dark.svg` · `-nohat` | Monochrome blanc (fond sombre), `currentColor`. |
| `logo-octave-mono-light.svg` · `-nohat` | Monochrome encre `#241040` (fond clair), `currentColor`. |
| `propositions/` | Les deux propositions écartées, mêmes déclinaisons. |

Sans chapeau **sous 24 px**, comme le logo de l'app.

Le web consomme `apps/web/src/components/ui/octaveLogo.generated.ts` :
`octaveLogoSvg(variant, taille, surFondSombre)` ou `octaveLogoDataUri(…)` pour un
`<img>` — chaque SVG garde ses identifiants de dégradés, aucune collision avec un
autre logo de la page.

## Le glyphe de l'interface

`glyph-octave-on-dark.svg` · `glyph-octave-on-light.svg` (`octave_glyph.py`) :
une croche dont le crochet est un BRAS de la mascotte (même spine, même
effilement que les bras du logo), qui s'enroule vers l'intérieur. C'est lui —
pas la mascotte — qui représente Octave dans l'interface, de 16 à 24 px : la
bascule vers le mode musique, un onglet, une entrée de navigation. Une seule
couleur, `currentColor`, aucun visage. Le web le rend par
`apps/web/src/components/ui/OctaveGlyph.tsx` (`OCTAVE_GLYPH_PATHS`, nom stable).

## La construction

- **La double-croche enlacée (retenue).** Deux têtes gravées (inclinées de
  22°), deux hampes montées à leur droite, une barre qui monte vers la droite.
  Elle prend la place de l'écran : la barre ferme le bas du dôme comme le
  faisait le haut du cadre, les hampes courent sous les bras, et les SPIRALES
  des bras se referment sur les têtes — la pieuvre tient la note par ses
  têtes. Même langage que l'écran : vitre `gT`, cadre au dégradé `gV` posé
  AUTOUR de la forme (une hampe de 11 ne survivrait pas à un cadre de 5
  intérieur), et un éclat rose `gP` sur chaque tête, là où était le play.
- **L'écran musical.** L'écran tel quel, la double-croche à la place du play.
  Le plus fidèle, mais indiscernable du logo de Tentacle à 16 px.
- **La croche-tentacule.** Une croche seule dont le crochet est un bras
  (`geometry.tapered` sur une spirale) ; le bras gauche tient la tête, le
  droit le crochet. Belle en grand, confuse à 16 px.

Le choix s'est fait sur la planche (grand, 48 px, 16 px, clair et sombre) :
seule la double-croche reste une note reconnaissable à 16 px, sur les deux fonds.

## Le monochrome

Une masse, détails creusés au masque comme `logo-mono.svg`. La note est
PLEINE, détachée du dôme par un jour (sinon la barre fond dans la tête) — un
jour assez court pour ne pas mordre le sourire ; les bras s'en détachent par
leur liseré, comme ils se détachaient du cadre.
