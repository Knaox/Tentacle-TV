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

## Régénérer les SVG

Les cinq fichiers ci-dessus sont **générés**, jamais édités à la main :

```bash
python3 brand/generate-svg.py brand
```

Une seule géométrie y produit les cinq variantes : elles ne peuvent donc plus
divergerentre elles. Après régénération, recopier les fichiers publics :

```bash
cp brand/logo-color.svg apps/web/public/tentacle-logo-pirate.svg
cp brand/logo-mono.svg apps/web/public/tentacle-logo-mono.svg
cp brand/logo-color-nohat.svg apps/web/public/tentacle.svg
cp brand/logo-color.svg apps/tv-webos/shell/images/tentacle-logo-pirate.svg
```

⚠️ **Le composant web porte une COPIE de cette géométrie**, dans
`apps/web/src/components/ui/tentacleGeometry.ts` — il lui faut des variables CSS,
que le fichier statique ne peut pas résoudre. Toute retouche du dessin se fait
donc aux DEUX endroits. Contrôle de non-divergence :

```bash
python3 - <<'EOF'
import pathlib, re
f = lambda p: set(re.findall(r'"(M \d[^"]*)"', pathlib.Path(p).read_text()))
a = f("apps/web/src/components/ui/tentacleGeometry.ts"); b = f("brand/generate-svg.py")
print("identiques" if a == b else f"DIVERGENCE: {a ^ b}")
EOF
```

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

## La forme des bras n'est pas indifférente

Une tige d'épaisseur presque constante finissant sur un enroulement serré
reforme une masse au bout — le trait y repasse sur lui-même — et cette masse
prête à confusion. D'où l'effilement en QUATRE paliers jusqu'à une pointe fine,
des pointes qui s'incurvent sans jamais se refermer en boucle, des longueurs
inégales, et des ventouses : elles disent « tentacule » mieux que la silhouette
seule.

## Le mono n'est pas un filtre

`filter: brightness(0) invert(1)` sur `logo-color.svg` ne produit PAS
`logo-mono.svg` : il aplatirait le tube, les yeux et le corps dans la même
valeur, et la mascotte deviendrait une tache. Le mono creuse ses détails au
masque et détache chaque tentacule d'un liseré — sans quoi les cinq bras
fusionnent en une masse informe.
