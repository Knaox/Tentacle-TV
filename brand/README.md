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

## Régénérer les dérivés

```bash
./brand/generate.sh
```

Le script exige `rsvg-convert` (`brew install librsvg`), plus `magick`,
`iconutil` et `sips` (macOS). Il écrase les cibles sans demander : passer par
git pour revenir en arrière.

## Deux règles apprises à leurs frais

- **L'icône d'application doit remplir son cadre.** Play a déjà rejeté une
  livraison au motif que l'icône « ne remplit pas l'espace » : le poulpe
  occupe 86 % de la largeur, sur un fond plein — jamais de transparence, jamais
  de marge décorative. L'`ic_launcher_foreground` adaptatif Android est cadré
  plus large encore, le système en rogne les bords.
- **Le nom des fichiers publics ne change pas.** `tentacle-logo-pirate.svg` est
  chargé par URL depuis les iframes de plugins — y compris des plugins déjà
  publiés, hors de ce dépôt. Renommer le fichier casserait leur affichage en
  silence. On remplace le contenu, jamais le nom.

## Le mono n'est pas un filtre

`filter: brightness(0) invert(1)` sur `logo-color.svg` ne produit PAS
`logo-mono.svg` : il aplatirait le tube, les yeux et le corps dans la même
valeur, et la mascotte deviendrait une tache. Le mono creuse ses détails au
masque et détache chaque tentacule d'un liseré — sans quoi les cinq bras
fusionnent en une masse informe.
