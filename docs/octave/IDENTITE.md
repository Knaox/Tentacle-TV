# Octave — l'identité

Octave est **Tentacle quand on écoute** : la même encre neutre, les mêmes polices (Bricolage Grotesque pour les
titres, Figtree pour le texte), les mêmes pilules, le même mouvement — et SA mise en page de lecteur de musique :
rail à gauche, barre de lecture qui flotte, file à droite. Ni une copie de Spotify, ni une copie de l'accueil vidéo.

**Refonte de nov. 2026** (docs/REFONTE-UI.md, validée sur prototype) : la couleur est aux POCHETTES. L'encre prune,
le rose en accent, le voile de marque en tête des vues, l'onglet actif au dégradé, le mot « Octave » au dégradé et
les replis de pochette au dégradé sont retirés. Aucun nom de jeton n'a changé : des valeurs ont changé, des jetons
se sont ajoutés (`--oc-ink-menu`, `--oc-radius-menu`, `--oc-shadow-menu`, `--oc-hero-tint-*`, `--oc-ease-drawer`).

Jetons : [`apps/web/src/music/octave/octaveTokens.css`](../../apps/web/src/music/octave/octaveTokens.css)
(`--oc-*`, sombre ET clair) et [`octaveNight.css`](../../apps/web/src/music/octave/octaveNight.css) (la
nuit de la barre de lecture), en classes Tailwind sous `octave-*` (`apps/web/tailwind.config.ts`).

## Les principes

1. **L'accent dit un état, rien d'autre.** La teinte franche du socle (`--accent`, par `--oc-accent*`) marque ce
   qui est ACTIF : le titre en cours, le cœur d'un titre aimé, aléatoire et répétition allumés, l'icône de la page
   courante, une case cochée, « gardé sur l'appareil ». Jamais pour décorer (surtitre, lien, bouton-texte).
2. **Le dégradé sert à LIRE et à MESURER.** Le dégradé du logo (`--oc-gradient-deep`, classe `octave-brand-fill`,
   `.octave-play`) sous un bouton qui LANCE LA LECTURE ; le dégradé de jauge (`--oc-gradient`, `octave-gauge-fill`)
   sur la progression et les barres d'import. Une action principale qui ne lit pas (Enregistrer, Importer, Créer,
   Partager) est neutre : `octave-solid` (ivoire en sombre, encre en clair).
3. **Rien de blanc qui crie.** Le bouton Lecture n'est jamais un rond blanc, **la barre de lecture n'est jamais
   blanche**. En thème clair, aucun panneau d'Octave n'est blanc pur (`--oc-ink-raised` : un papier chaud).
4. **La barre de lecture est TOUJOURS la nuit.** Dans les deux thèmes, la même capsule de verre sombre (encre de
   panneau à 72 %, arête haute, plus de liseré) qui flotte au-dessus des pages (le mini-lecteur du téléphone
   aussi). Le reste suit le thème : le rail est posé sur l'encre, sans dalle ; la file est un îlot à l'encre de
   panneau ; un menu ou une bulle prend l'encre de menu.
5. **Les pochettes font le décor.** La tête d'un album, d'un artiste ou d'une playlist prend la TEINTE de sa
   pochette (`useArtworkTint`, lue une fois sur une vignette de 64 px), posée en un lavis qui fond vers la page —
   un dégradé peint une fois, sans flou. Au survol, la pochette d'une carte grandit de 3 % sur place. Sans
   pochette : une encre neutre (jamais un dégradé de marque). Seule exception de mouvement : **l'océan** (plus bas),
   qui prend lui aussi la teinte de la pochette.
6. **Intuitif d'abord.** Les conventions d'un lecteur de musique sont gardées : navigation à gauche, titre en cours
   à gauche de la barre, transport au centre, volume à droite, ‹ › pour revenir — et un bouton **Retour** en tête
   de toute vue qui n'est pas une racine (`OctaveSubview`, posé à la route : album, artiste, playlist, ambiance,
   mix, profils), dans tous ses états.

## La palette

| Jeton | Sombre | Clair | Usage |
|---|---|---|---|
| `--oc-ink` | `--surface-0` (`#0B0B0C`) | `#F3F2EF` | la page |
| `--oc-ink-raised` | `#131315` | `#FBFAF8` | la file, un îlot |
| `--oc-ink-menu` | `--surface-dropdown` (`#1E1E22`) | `#FFFFFF` | menu, bulle |
| `--oc-accent`, `-text`, `-soft` | `--accent` (`#E58CF0`), 16 % | `#A21CAF`, 10 % | un état ACTIF |
| `--oc-gradient` | `--gauge-gradient` | idem | progression, barres d'import |
| `--oc-gradient-deep` | `--cta-brand-gradient` | idem | bouton Lecture (blanc dessus) |
| `--oc-volume-fill` | `--oc-accent` | idem | le volume, d'UNE teinte (Damien, 25/10 : « pas violet ») |
| `--oc-dock-*` | verre de nuit 72 %, flou 20 px | **le même verre de nuit**, 88 % | la barre de lecture (`.octave-night`) |
| `--oc-nav-active-bg` | `--fill-soft` | idem | l'entrée active du rail : une pastille neutre |
| `--oc-chip-*` | encre 72 %, blanc | idem (constant) | une pastille posée sur une pochette (`octave-on-art`) |
| `--oc-hero-tint-*` | teinte de la pochette, 30 → 0 % | 22 → 0 % | le lavis en tête d'une vue |

Tout dérive des jetons de Tentacle. **La nuit** (`.octave-night`, sur le dock et le mini-lecteur) : le bloc
sombre des jetons vaut pour `:root` ET pour elle, et en thème clair elle reprend les couleurs de base du
thème sombre de Tentacle, recopiées de `theme/tokens.css` — `octaveNight.test.ts` en tient la parité. Une surface
nouvelle qui doit rester sombre prend `octave-night`, rien d'autre ; une variable qui en DÉRIVE se redéclare sur la
nuit (elle se calcule là où elle est déclarée).

## Les usages

- **Classes** : `text-octave-accent-text` (un état), `bg-octave-accent/20` (le seul avec opacité),
  `bg-octave-raised`, `bg-octave-hover`, `border-octave-line` ; `octave-brand-fill` (lecture), `octave-solid`
  (action principale neutre), `octave-gauge-fill` (mesure), `octave-emblem` (tuile à la teinte franche à la place
  d'une pochette), `octave-on-art` (pastille sur une image), `octave-press` (la pression du socle : 97 %, 120 ms,
  dès l'appui — plus aucun `hover:scale` ni `active:scale-90`), `octave-chip` (onglet ou filtre : choisi, une
  pastille neutre), `octave-bubble` (une bulle qui flotte).
- **Typographie** : `.oc-display` (grand titre, police de titre, serré), `.oc-heading` (section), `.oc-eyebrow`
  (surtitre NEUTRE, celui du socle), `.oc-meta` (durées, chiffres à chasse fixe).
- **Formes** : les cinq rayons du socle — pochette `--oc-radius-art-xs|sm|art|art-lg` (4 · 6 · 12 · 16), rangée et
  entrée de menu 10, menu 16, panneau 20, barre de lecture 24, pilule pour TOUS les boutons.
- **Ombres** : `--oc-shadow-art` sous une pochette, `-art-lg` en tête de vue, `-menu` sous ce qui flotte ; un
  panneau n'a qu'une arête (`-panel`) ; plus d'ombre teintée sous le bouton Lecture.
- **Icônes** : Phosphor, au trait au repos, PLEINE quand l'état est actif (page courante du rail, cœur, file
  ouverte) ; le transport est toujours plein (`components/icons/transport`).
- **Mouvement** : `transform` et `opacity` seulement ; pression 120 ms, survol 160 ms, panneau et feuille 320 ms
  (courbe de tiroir) ; jamais d'`ease-in` ; `prefers-reduced-motion` coupe tout.
- **Liquid Glass** : la porte `data-liquid-glass` ne change pas. **Le verre change le MATÉRIAU, jamais les
  DIMENSIONS** (Damien, 26/10) : `glass/glassSkinOnly.test.ts` le tient. Hors `native`, c'est le rendu ci-dessus ;
  en natif, les mêmes formes passent par la primitive (`fallbackClassName`) : le dock en `.lg-pane`, ton FORCÉ
  sombre, encre 0,7 (lisible au-dessus d'un blanc pur, `shellGlass.test.ts`) ; ‹ ›, la bascule, le champ, les
  filtres, les onglets, le tri, le cœur et la file du dock en `.lg-bead` ; les entrées du rail en `.lg-pane-nav`.
  Le lavis de pochette de la tête s'efface en natif (le fond ambiant porte la couleur).
- **La place** : une information qui ne tient pas entière s'efface, elle n'est jamais coupée au milieu
  d'un mot. Dans le dock, la colonne de droite est un conteneur (requêtes de conteneur, `shell.css`) :
  la glissière du volume cède d'abord, puis la qualité passe en ICÔNE seule, puis disparaît.
- **Focus** : l'anneau de Tentacle (`ring-line-focus`, à la teinte franche) ; sur une glissière, la tête et son halo.

## L'océan — le mouvement d'Octave

Tentacle est un poulpe : quand la musique joue, Octave a la mer (`apps/web/src/music/octave/motion/`).

- **La houle** (`OceanSwell`) dit « en cours » : deux vagues qui roulent en sens contraire, le « ≈ » de
  l'eau, vivant — jamais les barres d'un égaliseur. À la couleur du texte (la teinte franche), de 12 à 16 px. En
  pause, la mer se CALME (deux rides immobiles). Sur le numéro de la rangée en cours, dans les raccourcis
  de l'accueil, la file, et en pastille sur la pochette de l'album ou de la playlist qui se joue
  (`CollectionSwell`, coin bas gauche).
- **L'ambiance** (`OceanAmbience`), sous le lecteur « en cours » : une lueur à la teinte de la pochette
  derrière elle, des reflets de surface en haut, trois bandes de houle au pied, toutes à la teinte de la
  pochette (celle de devant avec une crête de lumière). Discrète : elle ne passe jamais devant le contenu.
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
- Jamais une barre de lecture blanche, dans aucun thème ; jamais un panneau blanc pur en clair.
- Pas de dégradé décoratif (onglet, texte, voile, repli de pochette, emblème) ; pas d'accent hors d'un état.
- Pas de verre sur du verre, pas de flou décoratif, pas de `backdrop-filter` derrière un fond opaque.
- Rien qui bat en boucle, hors l'océan (ci-dessus) : la progression avance par pas (≈ 4 par seconde), sans
  transition continue.
- Pas de `hover:scale`, de `transition-all`, d'ombre animée ; pas de bouton rectangulaire.
- Pas de `/opacité` Tailwind sur une couleur `octave-*` autre que `accent`.
- Pas de `color-mix()`, `min()`, `max()`, `clamp()` dans une feuille d'Octave (garde du client LG).
- Pas le mot « téléchargement » dans un texte visible.
