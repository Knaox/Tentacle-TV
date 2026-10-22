# Liquid Glass — le verre de macOS 26 dans le bureau (1.40.0)

Carnet du lot « Liquid Glass macOS » (nuit du 21 au 22/10/2026), écrit d'après
ce qui a été FUSIONNÉ dans `dev`. Chaque section a été rédigée par la session
qui a fait le morceau ; il se tient désormais comme le reste du dépôt.

1. La règle — 2. Le socle natif — 3. Les jetons `--lg-*` — 4. La primitive —
5. Mode d'emploi : une nouvelle surface en verre — 6. Le « liquide » :
mouvement, reflet, accessibilité — 7. Le lecteur — 8. La fenêtre, la
navigation, les composants, le hors ligne — 9. Ce qui ne doit jamais casser —
10. Livraison : nouveautés, notes, licences — 11. Bancs et mesures.

## 1. La règle

- **Une seule porte : `<html data-liquid-glass="native">`** (`theme/liquidGlassMode.ts`),
  posée avant le premier rendu : macOS 26 (le pont de la coquille le dit) ET
  réglage allumé. Partout ailleurs — web, Windows, Linux, macOS d'avant 26,
  réglage coupé, `TENTACLE_LIQUID_GLASS=off` — l'attribut vaut `refraction` ou
  `off`, aucune règle du verre ne s'applique : **le rendu d'avant, au pixel près**.
- **Deux verres, selon ce qu'il y a derrière.** Sur la VIDÉO (le lecteur, Apple
  Silicon seulement) : le vrai verre du système, `NSGlassEffectView`, classe
  PUBLIQUE d'AppKit pilotée par le pont koffi déjà dans le dépôt (§ 2, § 7). Sur
  la PAGE (navigation, menus, cartes, fenêtres) : la lentille de Chromium,
  réfraction calculée pour la forme exacte de chaque surface (§ 4) — le verre
  natif vit SOUS la vue web et ne voit pas la page.
- **Activé d'office, coupé dans Réglages › Apparence** (préférence d'appareil
  `tentacle_liquid_glass`, la clé du mobile). Sur le bureau macOS, l'option
  n'existe QUE là où le système sait faire : invisible sur un macOS d'avant 26,
  jamais grisée.
- **Fonction purement client.** Aucune capacité serveur : le serveur ne sait
  rien du verre, et un serveur ancien n'y change rien.
- **Les couleurs de marque restent.** Le verre est neutre ; le violet → rose
  vient en TEINTE (bouton principal, onglet actif, progression), jamais en
  aplat derrière le verre.
- **Tout passe par les jetons `--lg-*`** (clair ET sombre) et la primitive ; jamais
  une valeur de flou, de teinte ou de liseré en dur dans une classe.

## 2. Le socle natif

Tenue par **lg-natif**. Code : `apps/desktop-electron/src/main/liquidGlass/`, et
le pont dans `apps/desktop-electron/src/preload/index.ts`.

### 2.1 Pas de module natif : AppKit par koffi

- `NSGlassEffectView` et `NSGlassEffectContainerView` sont des classes
  **publiques** d'AppKit (SDK macOS 26) : `contentView`, `cornerRadius`,
  `tintColor`, `style` (`Regular` | `Clear`) ; le conteneur : `contentView`,
  `spacing`. Elles se pilotent par le pont Objective-C de koffi que le bureau a
  déjà (`video/objc.ts`, celui de la fenêtre de mpv) : aucun `.node` à compiler,
  à recompiler à chaque version d'Electron ni à signer en plus — le paquet du Mac
  App Store embarque déjà koffi et ses deux binaires (`package-macos.mjs`,
  `NATIVE_MODULES`).
- **`electron-liquid-glass`** (Meridius Labs, MIT, 1.1.1, commit `a50d96f` du
  30/09/2025) a été lu ligne à ligne et écarté. C'est **la même classe**
  `NSGlassEffectView` — le vrai verre du système, pas une imitation CSS —, posée
  sans l'enveloppe :

  | Le module | Où (dépôt du module) | Chez nous |
  |-----------|----------------------|-----------|
  | La classe : `NSGlassEffectView`, par `NSClassFromString` | `src/glass_effect.mm:91` | la même (`nativeGlass.ts`) |
  | UNE vue plein cadre (`container.bounds`, suit la fenêtre) | `:85`, `:96`, `:124` | une vue PAR région, au rectangle de la page |
  | Une seule par fenêtre : `addView` retire la précédente | `:79-80`, `:134` | jusqu'à 64, en groupes qui fusionnent, ordonnées |
  | Posée sous tout (`NSWindowBelow relativeTo:nil`) | `:130` | sous le compositeur de Chromium, AU-DESSUS d'une `NSOpenGLView` |
  | Rayon par `layer.cornerRadius` + `masksToBounds` | `:160-161` | la propriété publique `cornerRadius` |
  | Teinte : `setTintColor:` (publique) | `:175-176` | la même — reprise |
  | Repli `NSVisualEffectView` avant macOS 26 | `:115` | aucun : le rendu d'avant, option invisible |
  | Variantes, voile, atténuation : setters PRIVÉS (`set_` + clé) | `:191-199`, `src/liquidglass.cc:92,106,120` | aucune API privée (refus du Mac App Store) |
  | Détection : `execSync("sw_vers")` | `js/index.ts:64` | version d'Electron + classe à l'exécution, sans processus |
  | Un `.node` par architecture (node-gyp, prebuildify) | `package.json:42` | aucun : le pont koffi déjà livré et signé |

  Repris du module : la classe, la teinte, la pose sous le contenu web, le suivi
  de l'apparence. Laissé : ses variantes privées (dont `avplayer`,
  `js/variants.ts:10`), le fond opaque `NSBox` (`opaque`), le repli
  `NSVisualEffectView`. Ajouté : rectangles multiples, groupes qui fusionnent,
  fondus et ressort natifs, apparence forcée par région.
- Donc : aucune licence tierce de plus, **aucune API privée** nulle part — le
  build MAS reçoit exactement ce code. Vérifié sur le paquet MAS lui-même
  (`package-macos.mjs --arch arm64`, binaire Electron `mas`, web de
  production) : pont présent, `supported`, mode `native`, verres posés et
  retirés (relus dans AppKit), réfraction de la vidéo mpv ; aucun nom de
  sélecteur privé dans l'archive ni dans le web embarqué — et
  `privateApi.test.ts` refuse qu'un fichier livré en cite un, même en
  commentaire (`tsc` recopie les commentaires dans l'archive). Sélecteurs envoyés : `initWithFrame:`,
  `setCornerRadius:`, `setStyle:`, `setTintColor:`, `setSpacing:`,
  `setContentView:`, `setAlphaValue:`, `setFrame:`, `animator`,
  `NSAnimationContext`, `addSubview:positioned:relativeTo:`,
  `removeFromSuperview`, `setHidden:`.

### 2.2 « Supporté » : trois conditions, figées à la fabrication

`availability.ts` (pur, testé) : macOS ≥ 26 (ou « 16.x », le numéro de
compatibilité qu'un binaire d'un SDK plus ancien lit sur Tahoe) ET les deux
classes présentes À L'EXÉCUTION ET le pont chargé. Verdicts : `native`,
`not-macos`, `forced-off`, `unsupported-os`, `missing-class`, `load-failed` ;
une ligne `[liquid-glass] <verdict>` au démarrage sur macOS.

- `TENTACLE_LIQUID_GLASS=off` simule un macOS sans verre : pont absent, option
  invisible. `native` saute la seule garde de version, jamais celle de la classe.
- Le verdict part à la page par `additionalArguments`
  (`--tentacle-liquid-glass=…`, `--tentacle-glass-video=0|1`), comme la
  plateforme : l'interrupteur de Réglages › Apparence n'apparaît jamais puis
  disparaît.

### 2.3 Le pont

`window.tentacle.liquidGlass`, **absent** sans verre natif : c'est son absence
qui cache l'option (`theme/liquidGlassMode.ts`). Le contrat est déclaré par la
page (`apps/web/src/desktop/types.ts`) et reflété par `protocol.ts` ;
`contractMirror.test.ts` casse si un champ de la page est inconnu de la coquille.

- `supported`, `refractsVideo` (le lecteur pose son verre sur la vidéo : vrai au
  montage `fenetre`, Apple Silicon ; faux au montage `gl`, Intel — mesuré
  possible, coupé par décision du lot : GPU intégrés qui chauffent déjà en
  lecture, aucun HDR à y gagner ; une ligne de `detect.ts` pour l'ouvrir),
  `setEnabled(bool)`, `upsert(regions[])`, `remove(ids[])`.
- Région : `id`, `x`, `y`, `width`, `height` (px CSS du viewport), `radius`,
  `level` (`regular` | `clear` | `tinted` | `prominent`), `tint`
  (`#RRGGBB[AA]` ou `null`), `interactive`, `z` ; facultatifs : `group` (un
  `NSGlassEffectContainerView` par groupe : les verres voisins FUSIONNENT ; sans
  groupe, une région a son conteneur à elle, et ne fusionne jamais), `spacing`
  (distance de fusion du groupe, en points), `transition` (ms : apparition et
  disparition natives ; non nul, il anime aussi les déplacements), `spring`
  (`{ response, dampingFraction }`, le ressort des déplacements — `morph` de la
  page par défaut), `appearance` (`"dark"` | `"light"` : la matière, quelle que
  soit l'apparence de la fenêtre — mesuré, 98,34,91 en sombre contre
  233,179,224 en clair sur le même fond).
- AppKit n'a que deux styles : `clear` → `Clear`, les trois autres → `Regular` ;
  `tinted` et `prominent` se distinguent par leur teinte. `interactive` : aucune
  API publique, sans effet natif.
- `sample(rects)` (avec réponse) : la luminance relative médiane (0..1, sRGB
  linéarisé) sous chaque rectangle, pour que les glyphes s'adaptent au contenu
  — une capture de la PAGE (`capturePage` sur l'union), 16 × 16 points par
  rectangle, pixels transparents ignorés : `null` au-dessus de la vidéo, que la
  capture ne voit pas. Vérifié dans l'app : blanc 1, noir 0, gris 50 % 0,216,
  blanc sous du texte noir 0,85 ; 10 ms par appel.
- Un message d'IPC par tâche JavaScript (`batcher.ts`, vidé en microtâche) ;
  le principal revalide tout (`validate.ts`, zod, région par région : une
  région folle est écartée sans perdre les retraits du même lot), applique le
  zoom de la page et borne à 64 régions. La vue web couvre toute la vue de
  contenu — le bandeau des feux est peint par la page : aucun décalage.

### 2.4 Où vit le verre, et ce qu'il voit (mesuré)

```
BridgedContentView → [NSOpenGLView?, racine du verre, ViewsCompositorSuperview, WebContentsViewCocoa]
racine → NSGlassEffectContainerView (un par groupe) → contentView → NSGlassEffectView…
```

Mesuré le 21/10 (maquette Electron 43, puis l'app de dev ; macOS 26.6.2, M4) :

1. **Sous le compositeur de Chromium, le verre réfracte ce qui est SOUS la
   fenêtre** : la fenêtre Metal de mpv, fille ordonnée dessous (Apple Silicon).
   Vérifié sur une vraie lecture HDR10.
2. **Posé juste au-dessus d'une vue de la fenêtre, il la réfracte aussi** : la
   `NSOpenGLView` du montage Intel (forcé par `TENTACLE_VIDEO_MONTAGE=gl`). La
   racine se pose sous la plus basse sous-vue qui n'est pas une `NSOpenGLView`
   (`AppKitGlassBackend.anchor`) ; une vue GL créée APRÈS se pose tout en bas
   (`relativeTo: nil`) : l'ordre tient dans les deux sens.
3. **Il n'est visible QUE là où la surface de Chromium est transparente** : avec
   le fond `#000000` que la fenêtre porte hors lecture, il est entièrement
   masqué. La racine est donc CACHÉE tant que la surface est opaque
   (`setPlayerSurfaceTransparent` → `glassSurfaceChanged`) : rien à composer.
4. **Il ne voit JAMAIS le contenu de la page** (affiches, rangées) : Chromium
   peint au-dessus de lui.

**La règle hybride** : le verre NATIF pour ce qui flotte sur la VIDÉO (barres
et panneaux du lecteur, pastille de saut, avis — des surfaces fixes dans la
fenêtre) ; la réfraction CSS/SVG de Chromium (§ 3, § 4) pour tout ce qui flotte
sur la PAGE (barre de navigation sur les affiches, menus, cartes, barres
latérales). Une région native ne suit pas un défilement — sa position arrive
par IPC, une image plus tard au mieux : rien de ce qui défile avec la page
n'est natif.

### 2.5 Les mouvements natifs (mesurés)

Trois faits de la maquette du 21/10, qui décident de tout :

1. **Un verre ignore son propre alpha** — `alphaValue` par l'animateur,
   opacité de sa couche, alpha d'une vue enveloppe : il reste à 100 %, même
   l'alpha posé à 0. **Seul l'alpha de son `NSGlassEffectContainerView`
   l'estompe** (49 %, 14 %, 2 %, 0 % aux quarts d'un fondu d'1,2 s).
2. **Un verre ignore une animation Core Animation** posée sur sa couche
   (`CASpringAnimation` sur position et taille : forme déjà à destination à
   60 ms). Seul l'animateur d'AppKit (`NSAnimationContext`) fait suivre la
   forme (17 %, 53 %, 82 % d'un trajet de 400 ms).
3. **L'animateur rabote une courbe hors de [0, 1]** : pas de dépassement.

Vérifié dans l'app : trois boutons ronds d'un même groupe (`spacing` 16) posés à
8 points l'un de l'autre FUSIONNENT en une seule goutte, ponts de matière
compris ; sans `spacing`, trois verres séparés.

D'où : une région seule entre et sort par le fondu de SON conteneur ; un
groupe qui naît ou se vide, par le fondu du sien ; un membre qui rejoint un
groupe visible naît de son centre, un membre qui le quitte fond vers son centre.
Les déplacements suivent le ressort de la page (`springCurve.ts`, recopié de
`theme/glass/springs.ts` et verrouillé par test) : coupe à 1 % du trajet comme
les transitions CSS (`morph` : 291 ms), rejouée par l'animateur avec la Bézier
la plus proche (écart < 1 % pour `morph` ; `lens` y perd son rebond, jamais sa
durée). Pas les 584 ms de `NATIVE_GLASS_MORPH_MS` (repos à 0,1 %) : sur cette
durée, la MEILLEURE Bézier possible s'écarte du ressort de 3,7 % en pleine course
(recherche exhaustive) — 11 px sur 300 —, contre moins de 1 % sur 291 ms ; et
la courbe ajustée finit exactement au but, sans le saut d'un ressort coupé. La
`transition` que la page envoie (584) règle la durée des fondus. Mesuré dans l'app : fondu d'entrée à 62 % à 130 ms, de sortie à 24 % à
160 ms puis 0 vue.

### 2.6 Cycle de vie

- Rien de posé sans région : ni racine, ni groupe — la fenêtre d'avant, vue
  pour vue.
- Réglage coupé : toutes les vues natives retirées (`nativeViews` 0), les
  descriptions gardées pour tout reposer à l'identique au rallumage.
- Page rechargée, processus de rendu perdu : tout retiré. Fenêtre fermée :
  références rendues, plus un message à ses vues.
- Une poignée rendue n'est jamais réutilisée (c'est un pointeur) ; un fondu de
  disparition garde la sienne jusqu'au bout et se solde avant toute démolition.
- Ancrage `NSViewMinYMargin` : un verre garde sa distance au HAUT de la fenêtre
  quand elle change de taille — le repère de la page, qui renvoie ses
  rectangles quand sa mise en page change.

### 2.7 Fenêtre, plein écran, HDR, PiP

- Rien ne change à la fabrication : `transparent: true`, `hasShadow: false`
  (CLAUDE.md, « Coût GPU » § 4), bandeau de 38 pt. Le verre de FENÊTRE d'AppKit
  (fond derrière les feux, barres latérales) n'est PAS posé : derrière une page
  opaque il ne montrerait rien, et derrière une page trouée il montrerait le
  bureau. lg-chrome fait ce verre en CSS, sur le contenu.
- Plein écran : aller-retour vérifié verre posé — position tenue, sortie de mpv
  inchangée.
- HDR, vraie lecture HDR10 (HEVC Main10, PQ, BT.2020) au montage `fenetre` :
  `video-params` ET `video-target-params` restent `pq/bt.2020` avec le verre ;
  headroom EDR 9,45 / 16 maintenu verre posé, en plein écran comme au retour en
  fenêtré. Le headroom n'est accordé qu'à la première transition de fenêtre,
  verre ou pas — comportement déjà décrit dans `macosEdr.ts`.
- PiP : le verre vit dans la fenêtre principale ; la fenêtre PiP n'en porte pas
  (le lecteur ne pose rien de natif pendant le PiP).
- Coût, mesuré (M4, vraie lecture HDR10 1080p continue, les quatre régions d'un
  lecteur, GPU de TOUTE la machine par `ioreg`, phases alternées de 12 s, écran
  externe 4K, autres sessions actives) : sans verre 48 % → avec 52 % → sans 51 %
  → avec 54 %, soit +3 à +5 points ; **aucune image perdue ni retardée** (mpv,
  `frame-drop-count`, `vo-delayed-frame-count`). Au repos, quatre verres posés
  sur un fond immobile : 39 % contre 39 % sans verre — rien ne bouge derrière,
  rien n'est recomposé. Surface opaque : racine cachée, coût nul par
  construction. Les watts (`sudo powermetrics --samplers gpu_power`, build de
  production) restent une passe manuelle : elle exige sudo. Seconde passe après
  les conteneurs par région (même banc, encore plus chargé) : moyennes 46 % sans
  verre contre 60 % et 50 % avec, toujours 0 image perdue — le bruit des autres
  sessions domine la mesure.
- Un écran sans plage étendue (« potentiel 1 », un moniteur SDR) ne donne pas
  de HDR, verre ou pas : le relevé HDR ci-dessus vient de l'écran XDR intégré.

### 2.8 Banc

`globalThis.__tentacleGlass.snapshot()` dans le principal, hors paquet :
`{ supported, availability, refractsVideo, enabled, surfaceVisible, root,
groups, nativeViews, regions: [{ id, level, group, z, css, frame, radius,
style, hidden }] }` — relu sur les VRAIES vues : `nativeViews` compte les
`NSGlassEffectView` présentes dans AppKit, `frame` est le cadre de la vue
(points, origine en bas). `TENTACLE_BENCH_INACTIVE=1` (hors paquet) : la
fenêtre s'ouvre sans prendre le focus — un banc ne vole plus les frappes de
celui qui tape ailleurs.

## 3. Les jetons `--lg-*`

Le MATÉRIAU commun vit dans `apps/web/src/theme/liquidGlassTokens.css`, en
sombre (`:root`) puis en clair (`:root[data-theme="light"]`) — son en-tête
tient le catalogue, c'est lui qui fait foi. Pas dans `tokens.css` : le test de
parité de l'admin (`packages/theme/src/css/cssVars.test.ts`) exige que toute
variable de `tokens.css` soit surchargeable, et le verre est un matériau du
SYSTÈME ; seules ses touches de couleur suivent la marque (`--brand-rgb`,
`--brand-accent-rgb`).

| Famille | Jetons |
|---------|--------|
| Teintes | `--lg-light-rgb`, `--lg-shade-rgb`, `--lg-tint-brand` · `-accent` · `-gradient`, `--lg-prominent-gradient`, `--lg-label*` |
| Niveaux | `--lg-{regular,clear,tinted,prominent}-{fill,blur,saturate,brightness}` — le vocabulaire d'Apple (`regular`, `clear`, `tint`, `prominent`) |
| Épaisseurs | `--lg-thick-fill` (menus, feuilles), `--lg-clear-dim`, `--lg-media-dim` (verre sur une affiche), `--lg-scrim` |
| Lisibilité | `--lg-label-shadow`, `--lg-glyph-shadow`, `--lg-media-label-shadow`, `--lg-media-glyph-shadow`, `--lg-vibrancy-blend` — la lisibilité vient de l'OMBRE du libellé, pas d'un voile qui assombrit le verre |
| États | `--lg-hover-brightness`, `--lg-opacity-pressed` · `-disabled` |
| Réfraction | `--lg-refraction-{niveau}` (px), `--lg-bezel-{sm,md,lg}`, `--lg-dispersion` |
| Spéculaire | `--lg-rim(-width)`, `--lg-specular-strong` · `-soft`, `--lg-highlight`, `--lg-inner-glow`, `--lg-light-x` · `-y` |
| Ombres, formes | `--lg-shadow-{contact,float,raised}`, `--lg-corner-shape`, `--lg-radius-*`, `--lg-thickness-*` |
| Fondus | `--lg-duration-{press,hover,appear,disappear}`, `--lg-ease-out` |
| Natif | `--lg-native-tint-{niveau}(-accent)` : la teinte `#RRGGBBAA` envoyée au pont |

Chaque famille COMPOSE ce matériau chez elle, sans redéfinir un nom commun :
mouvement `--lg-spring-*` et accessibilité (`theme/glass/physics.css`, § 6),
fenêtre `--lg-chrome-*` (`desktop/windowGlass.css`, § 8), contrôles `--lgc-*`
(`components/ui/glass/lgRecipes.css`, § 8), lecteur `--lg-player-*`
(`components/player/glass/`, § 7).

**La portée est tenue par test** : toute règle de `apps/web/src` qui lit
`var(--lg-…)` ou une classe `.lg-…` doit être portée par
`:root[data-liquid-glass="native"]` (`theme/liquidGlassTokens.test.ts`). Les
jetons sont DÉCLARÉS partout (`:root`), mais LUS seulement sous la porte.

## 4. La primitive

`apps/web/src/theme/glass/` — l'API est documentée en tête de `index.ts`,
qui fait foi. La carte de réfraction est dans `packages/ui/src/glass/`.

```ts
import { LiquidGlass, useLiquidGlassSurface, useLiquidGlassRegion, useLiquidGlassMode } from "../theme/glass";
```

- **Hors `native`, rien d'autre que le rendu d'avant** : une surface rend
  `className` + `fallbackClassName` (+ `fallbackStyle`, `style`), DOM identique
  à avant (test de rendu statique). Migrer une surface = déplacer son habillage
  d'avant dans `fallbackClassName`, garder la MISE EN PAGE dans `className`.
- **En `native`, selon `backdrop`** :
  - `page` (défaut) — derrière, de la PAGE : la **lentille de Chromium**,
    réfraction au biseau calculée pour la forme exacte (`refractionMap.ts`,
    filtre SVG en sRGB, cache de 32 cartes), puis flou, saturation, luminosité,
    liseré, reflets, tout en jetons ;
  - `window` — derrière, la fenêtre (le lecteur sur la vidéo) : **région
    native** inscrite auprès du pont (`useLiquidGlassRegion`), la surface se
    rend transparente ; l'appelant garantit que ses ancêtres le sont aussi.
    Un `upsert` + un `remove` par image au plus, sommeil après six images
    sans changement, région retirée dès qu'elle est cachée, hors écran ou
    démontée.
- **Options** : `level` (`regular` · `clear` · `tinted` · `prominent`),
  `shape` (`rounded` · `capsule` · `circle` · `rect`), `radius` (`xs` → `xl`),
  `tint` (`brand` · `accent`), `interactive`, `z` ; verre natif seulement :
  `group`, `spacing`, `transition` (§ 2.3).
- `useLiquidGlassSurface({ … })` pour un `motion.div` : `{ props, layers }`,
  `layers` (le filtre de la lentille) se rend DANS l'élément.
- **Les portes** : `useLiquidGlassMode() === "native"` (OS + réglage) ;
  `useLiquidGlass().nativeSupported` / `readNativeGlassBridge() !== null`
  (l'OS seul, réglage mis à part — l'écran des nouveautés) ;
  `useLiquidGlass().refractsVideo` / `nativeGlassRefractsVideo()` (le verre
  natif voit la vidéo : montage `fenetre`, Apple Silicon).

## 5. Mode d'emploi : une nouvelle surface en verre

1. **La surface existe déjà sans verre** : son rendu d'avant ne bouge pas. Le
   verre s'ajoute PAR-DESSUS cette version, par la primitive (§ 4), jamais en
   la remplaçant.
2. **Les valeurs viennent des jetons** (§ 3). Un besoin nouveau (une teinte, un
   rayon) devient d'abord un jeton, en clair et en sombre.
3. **Rien de monté qui n'est pas affiché** (CLAUDE.md, « Coût GPU ») : une
   surface révélée au survol se MONTE à la demande ; on n'anime que `transform`
   et `opacity` ; le reflet bouge en `transform`.
4. **L'accessibilité du système est respectée** (§ 6) : « Réduire la
   transparence » rend une surface opaque, « Augmenter le contraste » durcit
   le liseré, le mouvement réduit fige le liquide.
5. **Le lecteur ne perd jamais son HDR** (§ 9) : une surface posée sur la vidéo
   se vérifie par `video-target-params`, avant et après.
6. **Hors macOS 26, rien** : un test le dit — la surface rend exactement le
   balisage d'avant quand le verre est inactif. Sa feuille est portée par
   `:root[data-liquid-glass="native"]` (test de portée, § 3).
7. **Une modale ou un menu en `position: fixed` passe par un PORTAIL**
   (`createPortal(document.body)`, ou `Modal`, `Sheet`, `FloatingLayer`) : un
   `backdrop-filter`, un `transform` ou la propriété `scale` de la lentille
   font de leur élément le BLOC CONTENEUR de ses descendants fixes. Vécu : le
   dialogue « garder hors ligne », ouvert depuis la capsule de la fiche, tenait
   dans 240 × 54 px. Garde : `components/ui/glass/modalPortal.test.ts`. Le
   lecteur porte de même ses popovers dans son dock (§ 7).
8. **Jamais de lentille (`data-lg-lens`) sur une surface à verre natif** :
   une région native ne suit pas une échelle image par image (§ 6).
9. **Le client LG compile la même feuille** : `liquidGlassPass`
   (`apps/tv-webos/config/postcss/`) retire toute règle sous
   `[data-liquid-glass…]` / `[data-lg…]` ; rien d'autre à faire, sauf une
   syntaxe que la garde Chrome 53 refuserait HORS de cette portée.

## 6. Le « liquide » : mouvement, reflet, accessibilité

Tout vit dans `apps/web/src/theme/glass/` (règles pures testées, petites
briques React) et la feuille `physics.css`, **portée par
`html[data-liquid-glass="native"]`** : hors du mode natif, rien ne s'applique.

| Comportement | Brique | Comment |
|---|---|---|
| Ressorts | `springs.ts` | paramétrage d'Apple (`response`, `dampingFraction`) ; `lens` (0,32 s · 0,55 : rebond franc), `morph` (0,42 · 0,84), `settle` (0,26 · 1). Sortie en `linear()` CSS (`--lg-spring-*-easing/duration`, GÉNÉRÉS, tenus par `physics.test.ts`) et en ressort framer (`GLASS_FRAMER`). |
| Lentille au survol et à l'appui | `data-lg-lens` (`GLASS_LENS_PROPS`) | CSS pur : propriété `scale` (se compose avec un transform), `:hover` 1,04, `:active` 1,10, rebond au relâcher. Aucun écouteur. |
| Reflet qui suit le pointeur | `useSpecularHighlight()` + `<GlassSpecular/>` | variables `--lg-spec-u/v` écrites hors React, boucle d'image seulement pendant le mouvement, 60 écritures/s au plus. La lumière est un dégradé FIXE qu'on DÉPLACE (`translate`) : halo sur la face, et la même lumière dans une bague masquée de 1 px pour le liseré. Option `{ sheen: true }` : fait suivre aussi `--lg-light-x/y` (le `--lgc-sheen` des recettes), un dégradé repeint. |
| Fusion de verres voisins | `<GlassFusion spacing>` + `data-lg-fuse="id"` | `GlassEffectContainer` : sous `spacing` px, un seul verre pour le groupe ; chaque membre garde sa couche (clé stable), un seul porteur visible — deux verres superposés doubleraient la teinte. Animation `layout` de framer (transform) + opacité. |
| Métamorphose (une barre qui naît d'un bouton) | `glassMorphProps(id, useReducedMotion())` | `layoutId` partagé, ressort `morph`, rayon corrigé par framer si `borderRadius` est en `style`. Mouvement réduit : fondu de 150 ms. |

**Verre natif et mouvement.** Une région de verre NATIF suit la page par une
animation de sa frame ; elle ne peut pas suivre une échelle image par image.
- **Jamais de lentille (`data-lg-lens`, ni les boutons en verre qui la
  portent) sur une surface à verre natif** : la lentille reste aux surfaces
  rendues par la page.
- Une région qui se métamorphose ou fusionne envoie au pont
  `transition: NATIVE_GLASS_MORPH_MS` (584 ms, repos à 0,1 % du trajet : la
  durée des fondus). Sa FRAME, le natif l'anime par la Bézier la plus proche
  du ressort `morph` sur sa coupe à 1 % (291 ms) — sous 1 % d'écart de bout en
  bout, là qu'aucune Bézier ne suit le ressort sur 584 ms (3,7 %, 11 px sur
  300) : `apps/desktop-electron/src/main/liquidGlass/springCurve.ts`, tenu
  contre `springs.ts` par son test miroir. `NATIVE_GLASS_SPRINGS` (les
  constantes de framer) reste la référence si une animation à ressort native
  remplace un jour la Bézier.

**Accessibilité du système.** `installGlassAccessibility()` (dans `main.tsx`,
avant le premier rendu) lit les media queries — Chromium 150 d'Electron 43
relaie les trois réglages de macOS, mesuré : aucun pont natif — et pose sur
`<html>` `data-lg-transparency="reduce"`, `data-lg-contrast="more"`,
`data-lg-motion="reduce"` et `data-lg-material` :

- **Réduire la transparence** → `frosted` : verre plein (`--lg-a11y-solid`),
  `--lgc-backdrop*: none` (plus de flou ni de réfraction, rien à recalculer),
  reflet retiré ;
- **Contraste accru** → `solid` : idem + liseré net (`--lg-contrast-border`),
  aucun reflet décoratif ;
- **Réduire les animations** → ni lentille, ni rebond, ni reflet qui suit ;
  métamorphose en fondu.

Côté natif, AppKit adapte ses matériaux à ces réglages ; pour
NSGlassEffectView ce n'est PAS éprouvé ici. ⚠️ Rien n'a été vérifié en
basculant les réglages du Mac (un agent ne touche pas aux réglages système) :
les surcharges l'ont été par les attributs posés à la main dans Chromium. Le
client LG charge la même feuille : `liquidGlassPass` (apps/tv-webos) en retire
toutes les règles, seuls les jetons `:root` restent — vérifié contre
`compatGuard`.

**Contraste du texte (WCAG).** `contrast.ts` mesure le texte sur la teinte du
verre au PIRE fond (blanc derrière un verre sombre, noir derrière un clair) ;
`contrast.test.ts` le tient sur les jetons du thème : texte principal ≥ 4,5
(sombre 4,79 · clair 9,85), secondaire ≥ 3 (3,63 · 5,57). Le remplissage
`regular` du natif (`--lg-regular-fill`, 7 % de blanc) n'a PAS de contraste
garanti à lui seul : il compte sur le matériau du système dessous — c'est la
raison du mode `frosted`/`solid` pour qui en a besoin.

### Le coût

Banc rejouable SANS sudo : `node apps/web/bench/glass-gpu/run-bench.mjs
[--seconds 8] [--lock-dir <créneaux Electron du lot>] [--out r.json]` — page du
banc construite en production, ouverte dans l'Electron du dépôt, chaque
scénario en deux passes (physique coupée, puis allumée), verdict en écart de
médiane (`gpuBudget.ts`). Mesure : temps GPU cumulé PAR PROCESSUS (`ioreg`,
clients AGX) — Electron et WindowServer à part — et le CPU d'Electron.
`powermetrics` reste la référence de CLAUDE.md quand sudo est là ; « Device
Utilization % » d'`ioreg` reste à 0 sur M4 / macOS 26. Une fenêtre que macOS
ne compose pas (écran verrouillé) est REFUSÉE, au lieu d'un faux 0 %.

Budgets (`GPU_BUDGETS`) : au repos et pointeur posé, 0,5 point — rien ne
doit tourner ; reflet qui suit, 6 points PENDANT le mouvement ; mouvement
réduit, 1 point. Un geste (appui, fusion) se juge à son temps GPU unitaire :
60 ms au plus — ~1 ms par image d'un ressort à 120 Hz, moins de 3 % en
moyenne à un geste toutes les deux secondes.

Mesures du 21/10/2026 (MacBook Pro M4, macOS 26.6, écran 120 Hz ;
`--seconds 6 --repeat 3`, charge du Mac 7 → 29 pendant la passe — d'autres
sessions tournaient : à refaire machine au calme). GPU = occupation du GPU
imputée à Electron, médiane.

| Scénario | Réf. (physique coupée) | Physique | Écart | Budget | CPU Electron |
|---|---|---|---|---|---|
| Repos | 0 % | 0 % | 0 | 0,5 point | 0 → 0 % |
| Pointeur posé sur un verre | 0 % | 0 % | 0 | 0,5 point | 0 → 0,1 % |
| Reflet qui suit (`GlassSpecular`) | 0 % | 5,9 % | +5,9 | 6 points | 5,2 → 16,6 % |
| Reflet diffus qui suit (`sheen`) | 0 % | 5,8 % | +5,8 (6,1 à la contre-mesure) | 6 points | 4,8 → 15,2 % |
| Appuis répétés (lentille) | 0 % | 12,5 % | **50 ms par appui** | 60 ms | 0,7 → 20,6 % |
| Fusion / séparation | 14,2 % | 22 % | **55 ms par fusion** | 60 ms | 20,2 → 30 % |
| Balayage, mouvement réduit | 0 % | 0 % | 0 | 1 point | 5,6 → 6,3 % |

Le reflet diffus (`{ sheen: true }`) est AU RAS de son budget — il repeint
un dégradé à chaque écriture : préférer `<GlassSpecular/>`, qui ne repeint
rien, et ne garder `sheen` que pour une surface sans couche de reflet.

Dispersion relevée sur quatre passes simples sous charge : reflet 4,3 → 9,6
points, appui 32 → 56 ms, fusion 37 → 68 ms — d'où `--repeat`. Une passe
sur trois environ est REFUSÉE par la calibration (le temps GPU va alors à
`CoreServicesUIAgent`, pas à Electron : la fenêtre n'est pas composée) ;
relancer suffit.

Ce que le banc a appris :
- un verre ne coûte RIEN tant que rien ne bouge dessus : aucune boucle au
  repos ni pointeur immobile — c'est la règle de CLAUDE.md, tenue ;
- toute image qui change SUR un verre en fait recalculer le flou : la traîne
  d'un ressort sous le pixel coûtait autant que le geste — les transitions CSS
  sont coupées à 1 % du trajet (lentille 643 → 439 ms) ;
- sur ProMotion la boucle tourne à 120 Hz : le reflet n'écrit que 60 fois par
  seconde ;
- un dégradé conique dont l'angle suit le pointeur se repeint à chaque image :
  le liseré est la même lumière DÉPLACÉE dans une bague masquée.
- une couche effacée garde son flou à `opacity: 0` : celles de la fusion
  passent en `visibility: hidden` à la fin du fondu.

## 7. Le lecteur

Tenue par **lg-lecteur**. `apps/web/src/components/player/glass/`.

- **Une porte** : `playerGlassMode.ts`. Le lecteur ne prend le verre que si le
  mode est `native` ET que le socle dit `refractsVideo` (le verre voit la vidéo :
  montage `fenetre`, Apple Silicon). Sinon — web, Windows, Linux, macOS < 26,
  **Intel** (montage `gl` : décision du lot, GPU intégrés qui chauffent déjà en
  lecture, aucun HDR à y gagner), réglage coupé — l'habillage d'avant, au
  balisage près. Couper le réglage EN PLEINE LECTURE rend aussitôt l'habillage
  d'avant et retire les régions (la vitesse vit dans l'aiguillage,
  `usePlaybackRate`). Le repli vers le lecteur web (mpv en échec) est hors de la
  porte.
- **Pas de repli « verre de la page » sur la vidéo** : Chromium ne voit pas
  l'image de mpv, un flou CSS n'y floute rien. Le verre natif, ou rien.
- **Une couture** vers les socles : `nativeGlassPort.ts` (mode, `refractsVideo`,
  `useLiquidGlassRegion` avec `group`, `spacing`, `transition`).
- **Le décor** : capsule du haut (retour + titre) ; en bas, la capsule du temps
  et trois capsules de boutons à 4 px — sous la distance de fusion du groupe
  natif `player` (`spacing` 8) : AppKit les fond en UNE forme liquide.
  Popovers (pistes, vitesse, épisodes) qui NAISSENT de leur bouton
  (`glassMorphProps`, la région suit la surface qui grandit). Pilule de saut,
  « Vous regardez encore ? », fiche « à suivre », badges, attente, avis, Watch
  Together, bulle de la vignette du survol.
- **Deux familles de couleurs seulement : l'opaque et le noir à alpha.** Un
  blanc translucide rend gris sur la surface à alpha de la fenêtre. Teinte
  native presque neutre, comme QuickTime : `--lg-player-native-tint` 10 % de
  noir sur les capsules (18 % en clair), `--lg-player-panel-tint` 20 % sur les
  panneaux (32 % en clair) ; lisibilité par les ombres du socle.
- **Mouvement** : surfaces FIXES (capsules, badges) — fondu natif par
  conteneur (180 ms), et transition nulle PENDANT un redimensionnement
  (`windowResizing.ts` ; sans elle, le verre traînait jusqu'à 160 pt) ;
  surfaces qui BOUGENT (panneaux, avis, bulle) — `transition: 0`, le verre suit
  image par image. Un test vérifie que toute variable `--lg-*` lue par le
  lecteur existe (vécu : `--lg-ease-spring`, retiré du socle, figeait en
  silence toutes les transitions).
- **Popovers dans le DOCK** (`glassDock.ts`, `createPortal`) : rendu dans sa
  capsule, le menu de vitesse était retenu par la transformée de `.lgp-content`.
- **Clics** : une surface À L'ÉCRAN reprend les clics ; masquée, jamais ; en
  sortie, elle les laisse au bouton dessous (vécu : une piste choisie mettait
  en pause).
  ⚠️ Ces deux points viennent des derniers commits de lg-lecteur
  (`f0d5eeed6`, `b9cf047ee`, tête `09429366d`), annoncés prêts à fusionner au
  moment de cette rédaction : à retirer de ce carnet s'ils n'entrent pas.
- **Masqué, rien ne consomme** : régions retirées en moins de 100 ms,
  `nativeViews: 0`.
- **PiP** : contrôles d'avant (le document du PiP n'a pas de pont) ; le lecteur
  principal retire ses régions pendant le PiP (5 → 0 → 5, mesuré).
- **GPU** (`ioreg`, relatif) : contrôles affichés ≈ +8 points avec le verre ;
  masqués, aucun coût.

## 8. La fenêtre, la navigation, les composants, le hors ligne

Tout en LENTILLE de Chromium (§ 4) — aucune région native par contrôle.

- **Fenêtre et navigation** (lg-chrome, `apps/web/src/desktop/windowGlass.css`,
  `windowGlassNav.css`, jetons `--lg-chrome-*`) : bandeau des feux transparent,
  le contenu défile dessous ; **effet de bord de défilement**
  (`ScrollEdgeEffect.tsx` : flou masqué en dégradé, monté seulement page
  défilée, opacité sur les 48 premiers px) ; capsule de la `TopNav` en surface
  de la primitive, onglet actif en lentille teintée qui GLISSE (ressort
  `morph`), reflet qui suit le pointeur ; barres latérales de Réglages et
  d'Admin en panneau flottant, sélection en lentille qui glisse, sans
  `backdrop-filter` (rien ne bouge derrière) ; **fenêtre inactive**
  (`windowFocus.ts`, `data-window-inactive`) au gris, sans animation. Pendant la
  lecture native, le bandeau redevient OPAQUE (`data-native-playback`).
- **Composants** (lg-composants, `components/ui/glass/` : `lgRecipes.css`,
  `lgControls.css`, `lgOverlays.css`, `lgLegibility.css`, `useGlassControl`,
  `GlassPressable`) : des CLASSES-MARQUEURS sans aucun style hors de la porte —
  `.hero-cta-primary` / `.lg-btn-primary` (action principale, verre proéminent
  de marque), `.lg-btn-media`, `.lg-capsule-media`, `.lg-btn`, `.lg-disc`
  (flèches des rangées, montées au survol), `.lg-tray` (plateau du survol des
  cartes), `.lg-pill`, `.lg-chip`, `.lg-meta`, `.lg-field`, `.lg-segmented`,
  `.lg-menu`, `.lg-sheet` / `.lg-scrim`, `.lg-toast`, `.lg-bar`, `.lg-notice`,
  `.lg-panel`, `.lg-badge`. Le modèle des cartes (`cardOverlay.ts`) est intact :
  seule la peau change.
- **Hors ligne** : message de passage hors ligne et avis en `.lg-notice`,
  panneaux de la page hors ligne en `.lg-panel` (sans flou), bannière en
  lentille ; dialogues « garder hors ligne » et de suppression en portail (§ 5).
- **Bannières** : la rotation ne tourne que STRICTEMENT à l'écran
  (`useBillboardViewport`, `billboardActivity`) — sous un verre, toute image qui
  change fait recalculer le flou (51 → 0 DrawFrame/s hors écran).

## 9. Ce qui ne doit jamais casser

- **Le HDR / EDR du lecteur** : Apple Silicon, fenêtre Metal de mpv SOUS la
  nôtre ; Intel, `NSOpenGLView` dans la nôtre (CLAUDE.md, « macOS — deux
  montages vidéo »). Le verre ne s'interpose jamais entre la vidéo et l'écran
  d'une façon qui ferait passer la sortie en SDR.
- **Le Mac App Store** : aucune API privée dans le build MAS —
  `privateApi.test.ts` refuse qu'un fichier livré en cite une, même en
  commentaire.
- **L'ombre de la fenêtre transparente** : jamais rallumée (CLAUDE.md,
  « Coût GPU » § 4).
- **Le rendu d'avant** hors macOS 26 et réglage coupé (tests de portée et de
  rendu statique, § 3, § 4).
- **Rien de monté ni de flouté qui n'est pas affiché** (CLAUDE.md, « Coût
  GPU ») : un verre ne coûte rien tant que rien ne bouge dessus (§ 6, « Le
  coût »).
- **Les clics et le clavier de l'utilisateur** : un banc s'ouvre en
  `TENTACLE_BENCH_INACTIVE=1`, après 120 s d'inactivité (§ 11).

## 10. Livraison : nouveautés, notes, licences

- **Notes de version** (`changelogs/desktop.md`) : le verre n'existe que sur
  macOS 26, il ne paraît donc QUE dans le bloc `## [mac-1.40.0]` (App Store
  Connect) — le lecteur dit « sur un Mac à puce Apple ». Le bloc nu `## [1.40.0]` (Microsoft Store, Linux) porte les autres
  nouveautés de la version ; chacune se recopie aussi dans le bloc Mac, sous le
  verre. Jamais un commentaire DANS `### FR` / `### EN` : il partirait chez le
  store.
- **Écran des nouveautés** (`apps/web/src/whatsNew/`) : release `1.40.0`
  (`releases/v1_40_0.tsx`), scènes `scenes/v1_40_0/` — la navigation et le
  lecteur, le verre PEINT par `FauxGlass` (une scène ne peut pas emprunter le
  verre natif), avec les jetons du matériau. La navigation exige le trait
  `liquidGlass` (le pont annonce le verre), le lecteur `liquidGlassPlayer` (le
  verre voit la vidéo) : le filtre `forClient` les retire là où l'appareil ne
  les a pas (`clientTraits.ts`) — un Mac Intel en macOS 26 voit la navigation
  seule —, et une release ainsi vidée n'ouvre pas d'écran.
- **Licences** : rien à ajouter à `apps/desktop-electron/THIRD-PARTY-LICENSES.md`
  — le verre passe par AppKit et koffi, déjà présents ; le module
  `electron-liquid-glass` n'a pas été retenu (§ 2).

## 11. Bancs et mesures

Le banc de recette vit dans `apps/desktop-electron/bench/liquid-glass/` (son
`README.md` fait foi pour les commandes). Jamais lancé par `pnpm test`.

**Ce qu'il fait tourner** — tout est JETABLE : un Jellyfin 10.11 dans Docker
(`lg-banc-jf`, `127.0.0.1:18307`, `jellyfin.sh`), le backend du worktree sur une
base SQLite neuve (`:3107`, `backend.sh`), et la VRAIE app de dev : processus
principal, preload, CSP. Comptes `admin` et `Knaoxtest` du Jellyfin jetable,
mots de passe générés (`<état>/jf/`, 0600, jamais imprimés) : aucun compte réel,
jamais le Jellyfin partagé par dev et prod. Médias : douze films dont six aux
affiches DÉTAILLÉES (Mandelbrot, jeu de la vie, mire de zones, Sierpinski, mire
SMPTE quadrillée, chiffres) pour juger la réfraction au biseau, « Banc HDR10 »
(HEVC Main10, PQ, BT.2020, 4K), « Banc SDR », la série « Écume ».

**Comment il observe**

- Profil : `CFFIXED_USER_HOME=<état>/home-<cellule>` — `--user-data-dir` est
  ignoré (`index.ts` force `userData`) ; le verrou d'instance unique suit ce HOME.
- Page en CDP (`9307`) : `html[data-liquid-glass]`, le pont, l'interrupteur
  (cherché par son texte), `.lgc-edge`, `.lg-surface`, `data-lg-material`,
  `data-native-playback`, `prefers-*` émulés. Principal par l'inspecteur Node
  (`9407`) : `globalThis.__tentacleGlass.snapshot()` (hors paquet) compte les
  `NSGlassEffectView` RÉELLEMENT présentes dans AppKit (`nativeViews`).
- Captures : `screencapture -l <notre fenêtre>` uniquement — elle compose les
  fenêtres filles (mpv compris) et ne montre rien d'une autre application.
  Jamais `-R` : à travers une fenêtre transparente, une capture d'écran a saisi
  d'autres applications (21/10).
- **Le clavier de Damien** : aucune fenêtre ne s'ouvre, aucun plein écran ni PiP
  ne se joue tant que clavier et souris n'ont pas été inactifs 120 s
  (`HIDIdleTime`), et l'app s'ouvre en `TENTACLE_BENCH_INACTIVE=1`.
- Deux Electron au plus sur la machine : `mkdir`/`rmdir` de
  `.claude/locks/lg/electron-slot-1|2`, arrêt par notre pid seulement.

**La matrice** (`matrix.mjs`) — six écrans (accueil en haut, défilé de 300 et
900 px, survol d'une carte, fiche, Réglages › Apparence et › Lecture), le
lecteur (SDR, HDR, contrôles masqués, chaque panneau, coupure du verre en pleine
lecture, plein écran, PiP et retour par « Revenir au lecteur », épisodes), et
l'administration :

| Cellule | Attendu |
|---------|---------|
| `allume` | html `native`, pont `supported`, interrupteur allumé, verre natif au lecteur, rien de natif contrôles masqués |
| `coupe` | html `off`, `nativeViews` = 0 partout, aucune `.lg-surface`, fiche identique au rendu d'avant |
| `env-off` | `TENTACLE_LIQUID_GLASS=off` : interrupteur ABSENT, html `refraction`, 0 vue |
| `clair` | `tentacle_theme_mode=light` + `nativeTheme.themeSource="light"` |
| `transparence`, `contraste` | `prefers-reduced-transparency` / `prefers-contrast` émulés côté page → `data-lg-material` |
| `admin` | barres latérales, compte admin du Jellyfin jetable |

Le HDR s'y juge sur le COUPLE `video-params` / `video-target-params` et sur la
marge EDR de l'écran (`video_surface_probe` → `edr.potential`) : sur un écran
sans HDR (capot fermé sur un moniteur SDR), une sortie SDR est juste et le HDR
est dit « non vérifiable », pas en défaut. Référence mesurée sur l'écran interne
(base d'avant le lot) : `gamma=pq`, `primaries=bt.2020`, `max-luma` 1000, EDR 9,4.

**Réduire la transparence côté natif** : `NSGlassEffectView` suit seul le
réglage du SYSTÈME. Le banc ne le bascule pas (réglage d'accessibilité de
Damien, global à la machine) : à vérifier à la main.

**Mesures GPU** — le banc relève « Device Utilization % » d'`IOAccelerator`
(`ioreg`, sans sudo) à 1 Hz : charge de la machine ENTIÈRE, comparable d'une
cellule à l'autre dans une même passe, jamais dans l'absolu, et sans valeur
au-delà d'une charge système de ~20. La mesure de référence en watts reste
manuelle, sur un build de PRODUCTION (`build:web`, jamais `dev` et son compteur
d'images) :

```bash
sudo powermetrics --samplers gpu_power -i 1000 -n 10
```

au repos sur l'accueil, puis en lecture, verre allumé puis coupé. lg-physique
tient en plus un banc GPU de page sans sudo : `node apps/web/bench/glass-gpu/run-bench.mjs`.

**Recette d'une fusion** — `recette.sh` fusionne `dev` dans la branche du banc,
réinstalle si le lockfile bouge, reconstruit le bureau, relance le backend s'il
a changé, rejoue la matrice et compare au rendu d'avant (`compare.mjs`,
`compare -metric AE -fuzz 2%` : fiche ≤ 0,03 % = bruit ; l'accueil fait tourner
son héros, il ne se juge pas au pixel). Les preuves vont dans
`~/Pictures/tentacle-banc-liquid-glass/<date>-recette-<commit>/` (`resume.md`,
`rapport.json`, captures).

**Recette du matin** — `morning.mjs` : clone NEUF de `dev`, `pnpm install`,
`pnpm dev:electron` (drapeaux CDP passés SANS `--` : Chromium ignore tout ce qui
suit un `--`), connexion, puis exige le pont `supported`, le natif `enabled`,
html `native` et l'interrupteur allumé.
