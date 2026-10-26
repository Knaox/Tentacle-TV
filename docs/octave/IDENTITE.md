# Octave — l'identité

Octave est **Tentacle quand on écoute** : même encre, même police (Inter), même verre, même façon de
flotter — avec SON accent, le **rose**. Ni une copie de Spotify, ni une autre application : on reconnaît
Tentacle, et on sait qu'on est dans la musique.

Jetons : [`apps/web/src/music/octave/octaveTokens.css`](../../apps/web/src/music/octave/octaveTokens.css)
(`--oc-*`, sombre ET clair) et [`octaveNight.css`](../../apps/web/src/music/octave/octaveNight.css) (la
nuit de la barre de lecture), en classes Tailwind sous `octave-*` (`apps/web/tailwind.config.ts`).

## Les principes

1. **Le rose mène.** L'accent fonctionnel de la musique est le rose (`--brand-accent`) : ce qui est
   actif ou vivant — le titre en cours, la progression, le volume, aléatoire et répétition allumés,
   l'entrée de navigation active, le cœur d'un titre aimé. Le violet n'arrive qu'en OUVERTURE du dégradé,
   jamais seul pour dire « actif ».
2. **Le dégradé en touches, une par zone.** Violet → rose, le rose en tête : le bouton Lecture (dégradé
   PROFOND, lisible sous le blanc), la barre de progression, le mot « Octave », le voile en tête d'une
   vue. Jamais en fond de page, jamais sur du texte courant, jamais deux touches côte à côte.
3. **Rien de blanc qui crie.** Plus de bouton Lecture blanc plein, **jamais une barre de lecture
   blanche**. Les glyphes restent neutres (texte primaire, secondaire) ; la couleur est réservée à ce qui
   vit. En thème clair, aucune surface d'Octave n'est blanc pur : une nacre teintée de prune et de rose.
4. **La barre de lecture est TOUJOURS la nuit.** Dans les deux thèmes, la même capsule de verre sombre —
   encre prune, glyphes clairs, glissières au dégradé et rose — qui flotte au-dessus des pages, comme la
   barre de navigation de Tentacle (le mini-lecteur du téléphone aussi). C'est la signature d'Octave.
   Le reste suit le thème : la barre latérale est un rail posé sur l'encre, sans dalle ni bordure ; un
   panneau (file, « en cours », menu) est un îlot opaque, encre prune en sombre, nacre rosée en clair.
5. **Les pochettes font le décor.** Ni motif ni illustration : la couleur vient des pochettes. Rayons
   doux, ombres qui soulèvent. Une seule exception, qui est la signature d'Octave : **l'océan** (plus bas).
6. **Intuitif d'abord.** Les conventions d'un lecteur de musique sont gardées : navigation à gauche,
   titre en cours à gauche de la barre, transport au centre, volume à droite, ‹ › pour revenir.

## La palette

| Jeton | Sombre | Clair | Usage |
|---|---|---|---|
| `--oc-ink` | `#000` (`--surface-0`) | `#F4F4F7` | la page |
| `--oc-ink-raised` | `#0E0B13`, encre prune | `#F9F3F8`, nacre rosée | file, menus, feuilles |
| `--oc-accent` | `--brand-accent` (`#EC4899`) | `#DB2777` | remplissages : volume, pastille, point actif |
| `--oc-accent-text` | `#F472B6` (7,9:1) | `#B42062` (6,3:1) | texte et petits glyphes roses |
| `--oc-accent-soft` | rose 16 % | rose 10 % | fond d'une puce active |
| `--oc-gradient` | violet → rose → rose clair | idem | progression, marque |
| `--oc-gradient-deep` | `--cta-brand-gradient` | idem | bouton Lecture (blanc dessus, 4,6:1) |
| `--oc-dock-*` | verre de nuit 76 %, flou 20 px | **le même verre de nuit**, 88 % | la barre de lecture (`.octave-night`) |
| `--oc-nav-active-*` | pastille rose → violet | idem, plus légère | l'entrée de navigation active |

Tout dérive des jetons de Tentacle. **La nuit** (`.octave-night`, sur le dock et le mini-lecteur) : le bloc
sombre des jetons vaut pour `:root` ET pour elle, et en thème clair elle reprend les couleurs de base du
thème sombre de Tentacle (texte, remplissages, bordures, marque, statuts), recopiées de `theme/tokens.css` —
`octaveNight.test.ts` en tient la parité. Une surface nouvelle qui doit rester sombre prend `octave-night`,
rien d'autre ; une variable qui en DÉRIVE se redéclare sur la nuit (elle se calcule là où elle est déclarée).

## Les usages

- **Classes** : `text-octave-accent-text` (texte rose), `bg-octave-accent` et `bg-octave-accent/20`
  (le seul avec opacité), `bg-octave-raised`, `bg-octave-hover`, `border-octave-line`.
- **Typographie** : Inter, l'échelle de Tentacle. `.oc-eyebrow` (surtitre rose espacé : « ALBUM »,
  « PLAYLIST », « EN COURS » — le repère d'Octave), `.oc-display` (grand titre serré, 800),
  `.oc-heading` (section), `.oc-meta` (durées, chiffres fixes), `.oc-gradient-text` (le mot « Octave »).
- **Formes** : pochette `--oc-radius-art-xs|sm|art|art-lg` (4 · 6 · 10 · 14), panneau 16, barre de
  lecture 22, capsule pour les boutons et les puces.
- **Ombres** : `--oc-shadow-art` sous une pochette, `-art-lg` en tête de vue, `-panel` sous un îlot,
  `-play` (teintée rose) sous le bouton Lecture seul.
- **Mouvement** : `transform` et `opacity` seulement ; 120 ms (survol, appui), 200 ms (apparition),
  320 ms (panneau) ; une sortie dure deux tiers de son entrée ; `prefers-reduced-motion` coupe tout.
- **Liquid Glass** : la porte `data-liquid-glass` ne change pas. **Le verre change le MATÉRIAU, jamais les
  DIMENSIONS** (Damien, 26/10) : en mode `native`, Octave garde exactement les tailles, espacements et densité du mode
  normal — rail, dock, tête, rangées, boutons —, ce que tient `glass/glassSkinOnly.test.ts` (aucune taille dans les
  feuilles du verre) et qu'un banc a prouvé (boîtes identiques à 1 px près, 7 pages × 2 thèmes). Seule la PEAU change
  (`music/octave/glass/`, matériaux du socle `theme/glass/pane.css`) : sous la coquille de bureau, le fond ambiant
  (`GlassAmbient`, taches violet → rose discrètes) teinté par la pochette en cours ; le dock en `.lg-pane`, ton FORCÉ
  sombre, encre 0,7 (lisible au-dessus d'un blanc pur, `shellGlass.test.ts`) ; ‹ ›, la bascule, le champ, les
  filtres, les onglets, le tri, le cœur et la file du dock en `.lg-bead` ; les entrées du rail en `.lg-pane-nav`, les
  rangées en `.lg-pane-row`. **Verre transparent, pas violent** : le rail reste posé sur le fond, sans dalle ; le
  contenu (pochettes, listes) reste net ; la file reste l'îlot prune ; les menus suivent le régime commun. La coquille
  étroite garde son rendu (`useOctaveGlassStage`). Un texte au dégradé (`.oc-gradient-text`) n'a jamais d'ombre de
  texte.
- **La place** : une information qui ne tient pas entière s'efface, elle n'est jamais coupée au milieu
  d'un mot. Dans le dock, la colonne de droite est un conteneur (requêtes de conteneur, `shell.css`) :
  la glissière du volume cède d'abord, puis la qualité passe en ICÔNE seule — nom accessible et infobulle
  qui disent tout (« Qualité : Sans perte · FLAC · 16 bits · 44,1 kHz ») —, puis disparaît (le détail reste
  dans le lecteur « en cours »).
- **Focus** : l'anneau de Tentacle (`ring-line-focus`), inchangé ; sur une glissière, la tête rose et
  son halo.

## L'océan — le mouvement d'Octave

Tentacle est un poulpe : quand la musique joue, Octave a la mer (`apps/web/src/music/octave/motion/`).

- **La houle** (`OceanSwell`) dit « en cours » : deux vagues qui roulent en sens contraire, le « ≈ » de
  l'eau, vivant — jamais les barres d'un égaliseur. À la couleur du texte (le rose), de 12 à 16 px. En
  pause, la mer se CALME (deux rides immobiles). Sur le numéro de la rangée en cours, dans les raccourcis
  de l'accueil, la file, et en pastille sur la pochette de l'album ou de la playlist qui se joue
  (`CollectionSwell`, coin bas gauche).
- **L'ambiance** (`OceanAmbience`), sous le lecteur « en cours » : une lueur à la teinte de la pochette
  derrière elle, des reflets de surface en haut, trois bandes de houle au pied (violet au fond, la teinte,
  le rose devant avec une crête de lumière). Discrète : elle ne passe jamais devant le contenu.
- **Le coût** : `transform` et `opacity` seulement, sur des calques dessinés une fois ; PAR PAS, 15 images
  par seconde, toutes les animations calées sur la même cadence (`oceanMotion.test.tsx` la tient) ;
  suspendue hors écran, fenêtre cachée, en pause et sous le lecteur plein écran (`oceanCover.ts`) ;
  mouvement réduit : la même composition, fixe. Mesuré au bureau pendant une lecture (build de
  production, 25/10) : 15 images dessinées par seconde de plus (contre 120 en continu sur un écran à
  120 Hz), aucune abandonnée, ~1 % de CPU au processus GPU (6 % en continu) ; en pause, rien.
- **Elle suit l'énergie de la musique** (bureau) — on SENT l'accélération : le niveau RMS du son qui joue,
  mesuré par mpv (filtre `astats` qui ne touche à aucun échantillon — jamais en mode exclusif — lu de façon
  asynchrone cinq fois par seconde, seulement quand une houle roule), NORMALISÉ sur le titre en cours (écart à
  sa moyenne glissante rapporté à sa dispersion, plancher 3,5 dB : un morceau doux comme un morceau fort a ses
  creux et ses pics, un morceau qui ne fait que respirer reste une houle). Attaque ~0,2 s, relâchement ~1 s.
  Vitesse de 0,5× à 2,5× (géométrique, ×1 au niveau habituel du titre), crêtes de 0,7× à 1,5× (0,76-1,40 pour
  l'indicateur, sans déborder) — `motion/oceanEnergy.ts`. Vitesse par `updatePlaybackRate` (rien ne saute),
  amplitude par `--ocean-amp`. Au web, le moteur `<audio>` n'expose aucun graphe audio : la houle y garde son
  allure de toujours — jamais un second décodage du flux. Mesuré au bureau pendant une lecture : ~1,3 % de CPU
  au processus GPU ; 1,7 % au pire (houle tenue à ×2,5) ; en pause, rien.

## Ce qu'on ne fait pas

- Ni le vert de Spotify, ni ses îlots gris, ni son bouton Lecture blanc rond.
- Jamais une barre de lecture blanche, dans aucun thème ; jamais une surface blanc pur en clair.
- Pas de violet seul pour un état actif (`text-brand` dans Octave : remplacé par le rose).
- Pas de verre sur du verre, pas de flou décoratif, pas de `backdrop-filter` derrière un fond opaque.
- Rien qui bat en boucle, hors l'océan (ci-dessus) : la progression avance par pas (≈ 4 par seconde), sans
  transition continue.
- Pas de `/opacité` Tailwind sur une couleur `octave-*` autre que `accent`.
- Pas de `color-mix()`, `min()`, `max()`, `clamp()` dans une feuille d'Octave (garde du client LG).
- Pas le mot « téléchargement » dans un texte visible.
