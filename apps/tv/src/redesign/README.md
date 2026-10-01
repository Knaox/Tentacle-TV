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
- **La marque en touches.** La lumière du FOND vient de l'œuvre, teintée par
  son BlurHash (`color/artworkPalette.ts`), ses violets ramenés au neutre. La
  marque, violet → rose (`TV_ACCENT`, `brand/`), se pose en touches : lecture
  écrite (`BrandPill`), progression, étoiles, échelle de note, surtitres — et
  le halo, seule lumière à la porter (`brandLight`), discret.
- **Très grand** : rien sous 22 pt, texte courant 26–30, titres de rangée 36,
  titre d'écran 56, titre du héros 58 à 76 selon sa longueur (ou le LOGO de
  l'œuvre).
- **Plein cadre** : fonds et lumières bord à bord ; texte et focalisables
  dans la marge de sécurité (`TV_STAGE.safe` : 96 × 54). Le contenu commence
  à `TV_STAGE.contentLeft` (176), après la navigation repliée.
- **Focus Apple TV, sans contour** : agrandissement, soulèvement (deux
  ombres en fondu), reflet ; les boutons de verre deviennent BLANCS, texte
  noir. Ce qui n'a pas le focus recule un peu.
- **N'animer que `transform` et `opacity`.** Aucune boucle infinie.
- **Le mouvement est celui d'Apple TV, et d'Apple TV seulement** (`motion/`,
  jetons `TV_MOTION`) : le focus arrive sur un ressort vif et repart plus
  vite qu'il n'est venu, ce qui paraît sort avant de se démonter, un contenu
  qui change passe en fondu enchaîné. Tout se joue sur le fil d'interface ;
  hors Apple TV, et animations réduites, tout est instantané.

## Les briques (à composer, pas à recopier)

| Brique | Rôle |
|---|---|
| `theme/tokens.ts` | `colors`, `fonts`, `text` (display, title, heading, rowTitle, body, meta, kicker, caption), `scrim()`, `white()`, `stage`, `type` |
| `focus/FocusTarget` | Le seul Pressable : `focusKey`, `onPress`, `onLongPress`, `onFocusChange`, enfant `(focused) => …` |
| `focus/FocusGroup` | Un groupe nommé (`focusKey`) : une View tant que l'intégration ne lui donne pas de conteneur (`focusBinding`) |
| `focus/useFocusProgress` | 0 → 1 au focus (Reanimated), pour les styles animés — le mouvement du focus par défaut, un préréglage ou une durée sinon |
| `motion/motion` | `MOTION_ENABLED` (Apple TV), `EASE`, `motionTo(cible, préréglage)` : `focus`, `recede`, `reveal`, `veil`, `panel`, `unfold`, `press`, `ambient`, `hero`, `page`, `settle`, `imageIn`, `chrome` |
| `motion/useMotion` | `useMotion(on, préréglage)` : 0 → 1 lancé dans la tâche du rendu ; `usePresence(shown, préréglage)` : monté le temps de sa sortie |
| `motion/useCrossfade` | Fondu enchaîné sur deux calques (`dissolve` : images opaques ; `blend` : lumières), les changements en rafale regroupés |
| `motion/useSwap` | L'échange d'un contenu unique (sortie, changement invisible, entrée) : le texte du héros |
| `motion/useRowRecede` | `useRowFocus` (l'index focalisé d'une rangée, en valeur partagée) et `useRecede(place)` : les voisines reculent sans qu'aucune carte se redessine |
| `motion/pressProgress` | L'appui (OK enfoncé) tenu par `FocusTarget` : `usePressProgress()`, `pressScale()` |
| `motion/Reveal` | Ce qui paraît après un temps d'arrêt du focus (`delayMs`), en fondu, et s'en va en fondu plus bref |
| `motion/useStagedMount` | Ce qui ne se voit pas encore, monté APRÈS l'entrée de la page, un rang par image (sections de la fiche : `SectionStage`) |
| `glass/GlassSurface` | Le verre (`radius`, `tone` regular/strong/clear, `elevated`) ; suit l'interrupteur Liquid Glass — natif (`UIGlassEffect`) sur tvOS 26, simulé ailleurs |
| `glass/glassBacking` | Le fond sous un verre qui flotte : `useNativeGlassBacking(tone)` remplace, sous le verre natif seulement, le fond qu'une vue dessine (strong : aucun, regular 0,1, clear 0,55) |
| `background/AmbientBackdrop` | Le fond vivant (`palette`) |
| `background/ArtworkHalo` | La lumière autour d'un cadre (`width`, `height`, `radius`, `palette`) |
| `background/SoftGradient` | Un dégradé linéaire dessiné au huitième puis agrandi par le GPU (`width`, `height` connus) — jamais un `LinearGradient` plein cadre ou de la taille d'une carte : il se peint sur le processeur |
| `controls/PillButton` | Pilule `primary` (blanche) ou `glass`, `progress` pour « Reprendre » |
| `controls/RoundButton` | Rond de verre (Ma liste, favori, vu, note), libellé au focus |
| `controls/Chip` | Pastille (filtres, genres, choix), `selected`, `detail`, `trailingIcon` |
| `cards/MediaCard` | Carte `landscape` (16:9) ou `poster` (2:3), marqueurs du modèle partagé ; aucune action sur la carte : l'appui maintenu ouvre le grand panneau |
| `cards/MorphCard` | La carte qui se redresse (16:9 → affiche), ses marqueurs sur les deux faces |
| `cards/CardFocusFooter` | Sous la légende d'une carte focalisée, en absolu : la raison d'une reco (`CardFocusNote`) puis « Maintenir OK : plus d'options » (`CardHoldHint`) — sur toute carte qui s'ouvre par l'appui maintenu, un temps après le focus |
| `cards/ToggleGlyph` | Le glyphe d'un état (Ma liste, favori, vu), plein ou au trait : pastille, grand panneau |
| `rating/RatingStars` | Une note en cinq étoiles, demi-étoiles comprises, au rose de la marque — affichage seul |
| `screens/sheet/RatingRuler` | L'échelle HORIZONTALE de la note (GAUCHE / DROITE, ½ à 5 étoiles, la valeur visée au centre, « Retirer la note » au bout) : la seule saisie de note sur Apple TV — sous les étoiles en grand (`RatingPanel`) |
| `screens/sheet/SheetPictos` | Les pictos du grand panneau, dans l'ordre du modèle partagé, chacun son geste écrit dessous ; la lecture et « Demander » au dégradé (`BrandPill`) |
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
