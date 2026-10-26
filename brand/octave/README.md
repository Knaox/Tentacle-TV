# Octave — le logo du mode musique

La mascotte de Tentacle, **son tricorne de pirate sur la tête** (celui de
`tentacle-logo-pirate.svg`), qui montre sur son écran la note d'Octave à la
place du play ; et le **glyphe**, cette même note seule, pour l'interface. Rien ici ne se retouche à la main :

```bash
python3 brand/octave.py              # brand/octave/ + le module TS du web
python3 brand/octave.py /tmp/apercu  # aperçu ailleurs, sans le module TS
```

`octave.py` LIT les pièces du logo dans `generate-svg.py`, exécuté vers un
dossier jetable : le logo d'origine et ses fichiers ne sont jamais réécrits
(`git diff --stat brand/` ne montre que les fichiers d'Octave). Une retouche du
poulpe se fait dans `generate-svg.py`, puis `octave.py` se relance.

| Fichier | Rôle |
|---|---|
| `logo-octave.svg` | Le logo couleur, à partir de 24 px, sur fond clair comme sombre : la vitre sombre dans son cadre au dégradé se lit sur les deux (comme le logo de Tentacle). |
| `logo-octave-small.svg` | Le logo couleur SOUS 24 px (16 → 23 px) : le même dessin, le tricorne cerné d'un liseré au dégradé du cadre, sans ventouses ni reflets. |
| `glyph-octave.svg` | Le glyphe au dégradé des bras, la note seule. |
| `glyph-octave-on-dark.svg` | Le glyphe monochrome blanc (fond sombre), `currentColor`. |
| `glyph-octave-on-light.svg` | Le glyphe monochrome encre `#241040` (fond clair), `currentColor`. |

Le web consomme `apps/web/src/components/ui/octaveLogo.generated.ts` :
`OctaveGlyph` (`components/ui/OctaveGlyph.tsx`, en ligne, `currentColor` — un
onglet, la navigation, le monochrome, et le POUCE de la bascule « Mode musique » — la note, pas la mascotte : Damien, 26/10) et `octaveLogoSvg(variant, taille, surFondSombre)`
/ `octaveLogoDataUri(…)` pour un `<img>` (composant `OctaveLogo` du mode musique).
Noms d'export stables :
`OCTAVE_GLYPH_PATHS`, `OCTAVE_GLYPH_VIEWBOX`, `octaveLogoSvg`, `octaveLogoDataUri`.

## Le glyphe

`octave_glyph.py` : une croche dont le crochet est un BRAS de la mascotte —
même spine (`arm_spine`, Bézier puis spirale), même effilement (`tapered`) que
les bras du logo —, qui s'enroule vers l'intérieur. On lit d'abord une note
(c'est ce qu'il faut comprendre dans une bascule), puis le tentacule. Poids
d'une icône Lucide à 24 px : la hampe a la largeur de leur trait. Une seule
couleur, aucun visage.

**Un seul tracé** : hampe, crochet et tête sont trois sous-tracés du même sens
(antihoraires à l'écran) dans UN `<path>`. Trois tracés superposés composaient
une couleur translucide (l'entrée de la barre à 0,78 d'alpha, le verre) trois
fois sur leurs jonctions (défaut O1-1) ; un seul est peint une fois. Le test
`octaveLogo.test.ts` tient la règle.

## Le logo

Le logo de Tentacle (`BODY`, `HAT_G`, `FRONT_G`), dans le même ordre, le play
remplacé par le glyphe — posé par son centre optique au centre de l'écran, 76 de côté de
repère, au dégradé du play (`gP`). La spirale du bras gauche passe sur la tête
de la note : la pieuvre la tient.

## Le chapeau, à toutes les tailles (25/10 au soir)

Le tricorne est la marque de toujours, pas un déguisement : sans lui, la
mascotte d'Octave est « chauve, ça rend moche » (Damien). Il est sur le logo
à toutes les tailles. Le favicon de Tentacle l'ôte parce qu'à 16 px sa calotte
sombre se fond dans un fond sombre ; Octave le garde en le CERNANT, sous 24 px,
d'un liseré au dégradé du cadre (`SMALL_HAT_RIM`, un pixel plein à 20 px) — il
se lit sur l'encre comme sur la nacre.

## Ce qui a été retiré (25/10) et pourquoi

Le dessin d'avant — une double-croche géante À LA PLACE de l'écran, le tricorne
penché à tête de mort géante, un monochrome aux orbites creusées — était « en
mode Halloween », la note « trop grosse », le rendu pas « natif ». Donc :

- **la note à la proportion du play**, sur l'écran que la pieuvre enlace ;
- **le chapeau de Tentacle tel quel** (celui du logo de toujours), jamais un
  autre ;
- **pas de mascotte monochrome** : réduite à une masse, ses yeux creusés
  lisent « tête de mort » (déjà payé sur l'Apple TV, 2026-10-02). Le
  monochrome, c'est le glyphe.
