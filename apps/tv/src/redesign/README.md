# La refonte de l'UI TV — mode d'emploi des vues

Des VUES, rien que des vues : des props en entrée, des callbacks en sortie.
L'app ne les importe pas encore ; le banc (`apps/tv/harness/ui-bench`) les
monte sur un instantané réel du compte de test Knaoxtest.

## Interdits (le lint les refuse)

`@tentacle-tv/api-client`, `@react-navigation/*`, `react-native-video`, le
stockage, et toute logique de focus : `TVFocusGuideView`, `nextFocus*`,
`hasTVPreferredFocus`, `autoFocus`, `trapFocus*`, `destinations`,
`useTVEventHandler`, `BackHandler`. Aucun import relatif ne sort de
`redesign/` (seule exception : `brand/BrandMark.tsx`, qui trace le logo de
`brand/`). Pas de `UserData` lu dans une vue : l'intégration résout.

## La direction

- **Le bureau, à 3 m** : fonds noirs (#000 → #070710), textes blancs et gris
  translucides, pilule primaire BLANCHE texte noir, verre neutre, rayons
  généreux, ombres en deux calques. Police Inter.
- **Pas de violet.** La lumière vient de l'œuvre : halos et fond teintés par
  son BlurHash (`color/artworkPalette.ts`). L'accent ambre (`TV_ACCENT`) ne
  sert qu'aux petites touches : surtitre, jauge, cœur, pastille de profil.
- **Très grand** : rien sous 22 pt, texte courant 26–30, titres de rangée 36,
  titre d'écran 56, titre du héros 96 (ou le LOGO de l'œuvre).
- **Plein cadre** : fonds et lumières bord à bord ; texte et focalisables
  dans la marge de sécurité (`TV_STAGE.safe` : 96 × 54). Le contenu commence
  à `TV_STAGE.contentLeft` (176), après la navigation repliée.
- **Focus Apple TV, sans contour** : agrandissement, soulèvement (deux
  ombres en fondu), reflet ; les boutons de verre deviennent BLANCS, texte
  noir. Ce qui n'a pas le focus recule un peu.
- **N'animer que `transform` et `opacity`.** Aucune boucle infinie.

## Les briques (à composer, pas à recopier)

| Brique | Rôle |
|---|---|
| `theme/tokens.ts` | `colors`, `fonts`, `text` (display, title, heading, rowTitle, body, meta, kicker, caption), `scrim()`, `white()`, `stage`, `type` |
| `focus/FocusTarget` | Le seul Pressable : `focusKey`, `onPress`, `onLongPress`, `onFocusChange`, enfant `(focused) => …` |
| `focus/FocusGroup` | Un groupe nommé (`focusKey`) : une View tant que l'intégration ne lui donne pas de conteneur (`focusBinding`) |
| `focus/useFocusProgress` | 0 → 1 au focus (Reanimated), pour les styles animés |
| `glass/GlassSurface` | Le verre (`radius`, `tone` regular/strong/clear, `elevated`) ; suit l'interrupteur Liquid Glass — natif (`UIGlassEffect`) sur tvOS 26, simulé ailleurs |
| `background/AmbientBackdrop` | Le fond vivant (`palette`) |
| `background/ArtworkHalo` | La lumière autour d'un cadre (`width`, `height`, `radius`, `palette`) |
| `controls/PillButton` | Pilule `primary` (blanche) ou `glass`, `progress` pour « Reprendre » |
| `controls/RoundButton` | Rond de verre (Ma liste, favori, vu, note), libellé au focus |
| `controls/Chip` | Pastille (filtres, genres, choix), `selected`, `detail`, `trailingIcon` |
| `cards/MediaCard` | Carte `landscape` (16:9) ou `poster` (2:3), marqueurs du modèle partagé ; au focus, le plateau de `card.tray` |
| `cards/MorphCard` | La carte qui se redresse (16:9 → affiche) ; son plateau se pose sur l'affiche |
| `cards/tray/CardTray` | Le plateau du focus — le survol du bureau : étoiles entières, capsule (action primaire, Ma liste, favori, vu, extras), bulle de ce que fera OK ; son en-tête dit le parcours à la télécommande et les clés (`<carte>:tray…`) |
| `cards/ToggleGlyph` | Le glyphe d'un état (Ma liste, favori, vu), plein ou au trait : pastille, plateau, feuille |
| `rating/RatingStars` | Une note en cinq étoiles, demi-étoiles comprises, au rose de la marque — affichage seul |
| `screens/sheet/RatingScale` | L'échelle VERTICALE de la note (HAUT / BAS, ½ à 5 étoiles, « Retirer la note ») : la seule saisie de note sur Apple TV |
| `cards/CardFrame` | Le cadre et son focus, pour une carte sur mesure |
| `rows/MediaRow` | Titre + cartes horizontales, les voisines reculent |
| `hero/HeroBanner`, `MetaLine`, `TitleArt` | Le héros, la ligne de métadonnées, le logo-titre |
| `nav/NavRail` | La navigation flottante (repliée / ouverte sous un voile) |
| `brand/BrandMark` | La mascotte (haut à droite, écrans d'erreur) |
| `screens/shared/StatusPanel` | Chargement, erreur, vide |
| `icons/Icon` | Pictogrammes (`iconPaths.ts`, grille 24, trait 2) |

## Une vue finie

Ses scènes au banc dans tous ses états, une planche 1920 × 1080
(`pnpm --filter @tentacle-tv/tv bench:ui planche <préfixe> --focus`), son
contrat de props commenté avec les hooks qui l'alimenteront, sa tâche de
branchement, son commit.
