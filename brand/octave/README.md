# Octave — le logo du mode musique

La mascotte de Tentacle, **sans chapeau**, qui montre sur son écran la note
d'Octave à la place du play ; et le **glyphe**, cette même note seule, pour
l'interface. Rien ici ne se retouche à la main :

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
| `glyph-octave.svg` | Le glyphe au dégradé des bras : le logo couleur SOUS 24 px. |
| `glyph-octave-on-dark.svg` | Le glyphe monochrome blanc (fond sombre), `currentColor`. |
| `glyph-octave-on-light.svg` | Le glyphe monochrome encre `#241040` (fond clair), `currentColor`. |

Le web consomme `apps/web/src/components/ui/octaveLogo.generated.ts` :
`OctaveGlyph` (`components/ui/OctaveGlyph.tsx`, en ligne, `currentColor` — la
bascule, un onglet, la navigation) et `octaveLogoSvg(variant, taille, surFondSombre)`
/ `octaveLogoDataUri(…)` pour un `<img>` (composant `OctaveLogo` du mode musique).
Noms d'export stables : `OCTAVE_GLYPH_PATHS`, `OCTAVE_GLYPH_VIEWBOX`,
`octaveLogoSvg`, `octaveLogoDataUri`.

## Le glyphe

`octave_glyph.py` : une croche dont le crochet est un BRAS de la mascotte —
même spine (`arm_spine`, Bézier puis spirale), même effilement (`tapered`) que
les bras du logo —, qui s'enroule vers l'intérieur. On lit d'abord une note
(c'est ce qu'il faut comprendre dans une bascule), puis le tentacule. Poids
d'une icône Lucide à 24 px : la hampe a la largeur de leur trait. Une seule
couleur, aucun visage.

## Le logo

Le corps du logo de Tentacle (`BODY`), dans le même ordre, le play remplacé par
le glyphe — posé par son centre optique au centre de l'écran, 76 de côté de
repère, au dégradé du play (`gP`). La spirale du bras gauche passe sur la tête
de la note : la pieuvre la tient.

## Ce qui a été retiré (25/10) et pourquoi

Le dessin d'avant — une double-croche géante À LA PLACE de l'écran, le tricorne
à tête de mort, un monochrome aux orbites creusées — était « en mode
Halloween » (les logos d'Halloween, c'est fini), la note « trop grosse », le
rendu pas « natif ». Donc :

- **plus jamais de chapeau** ni rien de saisonnier, à aucune taille ;
- **la note à la proportion du play**, sur l'écran que la pieuvre enlace ;
- **pas de mascotte monochrome** : réduite à une masse, ses yeux creusés
  lisent « tête de mort » (déjà payé sur l'Apple TV, 2026-10-02). Le
  monochrome, c'est le glyphe.
