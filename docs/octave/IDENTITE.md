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
   doux, ombres qui soulèvent.
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
- **Liquid Glass** : la porte `data-liquid-glass` ne change pas. En mode `native`, la barre de lecture
  et la barre latérale sont des surfaces de la primitive (`theme/glass`, régime `surface` : un ton tenu),
  les boutons dedans de simples glyphes ; partout ailleurs, le verre sombre ou l'encre ci-dessus.
  **Dans un verre, tout suit le TON du verre, jamais le thème** : textes, survols, rail des glissières,
  rose — la classe `octave-glass` sur la surface s'en charge (`shell/shellGlass.css`), et le matériau est
  teinté d'Octave (prune dans le ton sombre, nacre rosée dans le ton clair). La barre de lecture FORCE son
  ton à sombre (`data-lg-tone="dark"` posé par le composant) : le verre de nuit, quel que soit le dessous.
  Un texte au dégradé (`.oc-gradient-text`) n'a jamais d'ombre de texte : celle du verre ternirait le
  dégradé.
- **La place** : une information qui ne tient pas entière s'efface, elle n'est jamais coupée au milieu
  d'un mot. Dans le dock, la colonne de droite est un conteneur (requêtes de conteneur, `shell.css`) :
  la glissière du volume cède d'abord, puis la qualité disparaît (son détail reste dans l'infobulle et
  dans le lecteur « en cours »).
- **Focus** : l'anneau de Tentacle (`ring-line-focus`), inchangé ; sur une glissière, la tête rose et
  son halo.

## Ce qu'on ne fait pas

- Ni le vert de Spotify, ni ses îlots gris, ni son bouton Lecture blanc rond.
- Jamais une barre de lecture blanche, dans aucun thème ; jamais une surface blanc pur en clair.
- Pas de violet seul pour un état actif (`text-brand` dans Octave : remplacé par le rose).
- Pas de verre sur du verre, pas de flou décoratif, pas de `backdrop-filter` derrière un fond opaque.
- Rien qui bat en boucle : la progression avance par pas (≈ 4 par seconde), sans transition continue.
- Pas de `/opacité` Tailwind sur une couleur `octave-*` autre que `accent`.
- Pas de `color-mix()`, `min()`, `max()`, `clamp()` dans une feuille d'Octave (garde du client LG).
- Pas le mot « téléchargement » dans un texte visible.
