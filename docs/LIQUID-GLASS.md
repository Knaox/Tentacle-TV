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
- **La cible est celle d'Apple, pas du « glassmorphisme »** (refonte du 22/10,
  après le verdict « ignoble, on dirait pas du Liquid Glass » ; références :
  HIG « Materials », WWDC25 « Meet Liquid Glass ») : un verre PRESQUE
  TRANSPARENT, net au centre, givre faible, jamais un fond sombre ; toute la
  réfraction dans le BISEAU (le contenu s'y courbe, comme sous une goutte) ; un
  bord qui ÉCLAIRCIT ce qu'il y a dessous, jamais un trait blanc ; des glyphes
  au TON du dessous (clair dessous → sombres, et inversement) ; de petites
  formes qui flottent séparées, jamais une dalle.
- **Le verre est la couche FONCTIONNELLE ; le contenu prend des remplissages**
  (lot lg2) : groupes de réglages, cartes, tuiles, panneaux d'outils posés dans
  la page sont des remplissages sobres et OPAQUES (`theme/liquidGlassContent.css`),
  comme Réglages Système. **Mais un CONTRÔLE est du verre, même dans une page**
  (lot lg4, décision de Damien du 22/10, « certains boutons sont pas liquid
  glass ») : bouton, pastille de filtre, déclencheur de menu, tri, champ de
  recherche, segmenté, interrupteur prennent le style `glass` de macOS 26
  (`glassProminent` pour l'action principale) — § 8, « Contrôles des pages ».
  Jamais de verre sur du verre : dans un menu, une feuille ou une barre
  latérale, ils gardent leurs remplissages.
- **Les couleurs de marque restent.** Le verre est neutre ; le violet → rose
  vient en TEINTE DANS le verre (l'action principale, l'onglet actif, une
  bascule allumée, la progression), jamais en aplat derrière.
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
- Sur la vidéo, `clear` : mesuré sur une vraie image en lecture (photo détaillée,
  grille fine), `clear` garde la photo et la grille NETTES à travers le verre
  (luminance −15 %), quand `regular` en apparence sombre givre et assombrit
  (−43 %) — la « dalle » de la première version. Une teinte noire légère (10 %)
  n'y change presque rien : le noir venait du style.
- AppKit n'a que deux styles : `clear` → `Clear`, les trois autres → `Regular` ;
  `tinted` et `prominent` se distinguent par leur teinte. `interactive` : aucune
  API publique, sans effet natif.
- `sample(rects)` (avec réponse) : la luminance relative médiane (0..1, sRGB
  linéarisé) sous chaque rectangle, pour que les glyphes s'adaptent au contenu.
  La PAGE d'abord : `capturePage` sur l'union, 16 × 16 points par rectangle
  (vérifié dans l'app : blanc 1, noir 0, gris 50 % 0,216, blanc sous du texte
  noir 0,85 ; 10 ms ; la capture est prémultipliée). Là où la page laisse voir
  le dessous, la VIDÉO (`videoSample.ts`, macOS, montage `fenetre`) : l'image
  que mpv a décodée (`screenshot-raw video bgra`, commande ASYNCHRONE lue
  pendant sa réponse, `commandForResult`), lue aux mêmes points et composée
  SOUS la page (prémultiplié, comme Chromium) — ce que l'œil voit, au verre
  natif près. Avec `under: "window"` sur un rectangle, la vidéo SEULE, page
  exclue (non capturée) : c'est le mode des formes posées sur la vidéo — une
  capsule du lecteur ne doit mesurer ni ses glyphes ni ses halos (15 à 35 % de
  sa surface), dont le ton dépend justement de la mesure ; `null` hors de la
  vidéo. Cadrage : l'image ajustée au centre de la fenêtre de mpv, à
  l'aspect affiché de `video-params` (`osd-dimensions` reste à 0 × 0, OSD
  coupé). Mesuré le 22/10 sur une vraie lecture : bandes 0x4D / 0xF2 (« neige »)
  / 0x80 / 0x1A → 0,073 / 0,882 / 0,211 / 0,010, bande noire 0, glyphes opaques
  sur 14 % du rectangle sans effet sur la médiane, voile blanc à 50 % → 0,265 ;
  mire HDR10 4K (PQ / BT.2020) : rouge 0,213, bleu 0,072, cyan 0,787. La capture
  GPU de `gpu-next` échoue sur MoltenVK, mpv se replie seul sur sa capture
  LOGICIELLE : 25–82 ms sur le cœur de mpv (1080p à 4K HDR), hors du fil
  principal ; aucune image perdue, même toutes les 250 ms ; une capture par
  seconde au plus ; rien au repos. Écartés au banc : `CGWindowListCreateImage`
  (retirée du SDK 15 : images vides avec le SDK 26.4 d'Electron) et
  ScreenCaptureKit (`-3811` sur toutes nos fenêtres, même par le contenu « du
  processus courant », et la demande « Enregistrement de l'écran » s'est très
  probablement affichée).
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
  inchangée. ⚠️ AppKit pose le drapeau plein écran du `styleMask` et la vue web prend sa
  taille au DÉBUT de la transition ; `enter-full-screen` / `leave-full-screen` n'arrivent
  qu'à la FIN de l'animation, ~1 s plus tard (mesuré, lot lg3). La page l'apprend donc au
  premier `resize` où `isFullScreen()` change (`fullscreenSync.ts`, `fullscreenOnResize`) :
  avant, bandeau des feux peint sur le film et capsules du haut 38 pt trop bas à l'entrée,
  capsules du haut SOUS les feux revenus à la sortie — le verre natif avec elles. Relevé
  après : à +150 ms, entrée comme sortie, tout est à sa place (contrôles affichés ou
  masqués ; masqués, 0 vue pendant la bascule).
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
| Teintes | `--lg-light-rgb`, `--lg-shade-rgb`, `--lg-tint-brand` · `-accent` · `-gradient`, `--lg-prominent-gradient` (la marque DANS le verre, translucide), `--lg-label*` |
| Glyphes au ton du dessous | `--lg-glyph-on-{dark,light}(-secondary)`, `--lg-glyph-shadow-on-*`, `--lg-glyph-filter-on-*`, `--lg-danger-on-{dark,light}` (corail / bordeaux : le rouge de danger suit le dessous) ; les GRANDES surfaces ont leurs glyphes prouvés (`--lg-surface-glyph-*`, plus bas) |
| Niveaux | `--lg-{regular,clear,tinted,prominent}-{fill,blur,saturate,brightness}` (presque transparents, givre faible ; saturation ≤ 1,3 depuis lg2 — à 1,5 une affiche laissait des taches vives), `--lg-thick-{fill,blur}` (d'avant ; un grand verre prend le régime `surface`) |
| Voiles | `--lg-clear-dim`, `--lg-media-dim` — TRANSPARENTS depuis la refonte (plus de fond sombre) ; `--lg-scrim` sous une feuille ; jamais un voile par rangée (le ton et le voile par bande d'avant sont RETIRÉS, lot lg2) |
| Lentille | `--lg-refraction-{niveau}` (fraction du biseau), `--lg-bezel-{ratio,min,max}` (biseau proportionnel au rayon), `--lg-dispersion` |
| Lumière du bord | `--lg-light-angle`, `--lg-specular-{facing,opposite,base,glow}`, `--lg-edge-{width,gain,white}` — gain et éclat par TON ; `--lg-edge` (fil et ombres) |
| États | `--lg-hover-brightness` (le verre s'éclaire au survol), `--lg-opacity-pressed` · `-disabled` |
| Ombres, formes | `--lg-shadow-{contact,float,raised}` (qui soulèvent), `--lg-corner-shape`, `--lg-radius-*`, `--lg-thickness-*` |
| Fondus, natif | `--lg-duration-*`, `--lg-ease-out` ; `--lg-native-tint-{niveau}(-accent)` : la teinte `#RRGGBBAA` envoyée au pont |
| Noms d'avant | `--lg-rim(-width)`, `--lg-specular-strong` · `-soft`, `--lg-highlight`, `--lg-inner-glow`, `--lg-label-shadow`, `--lg-media-*-shadow`… gardés en alias pour les recettes sans lentille |

**Le contrat du lot lg2 et le matériau `surface`** vivent à côté, dans
`apps/web/src/theme/glass/surfaceTokens.css` (300 lignes au plus par fichier),
déclarés SOUS la porte, sombre et clair — son en-tête tient le catalogue :

| Famille | Jetons |
|---------|--------|
| Rangées (menus) | `--lg-surface-radius`, `--lg-row-inset`, `--lg-row-radius` (= rayon de la surface − marge : concentrique), `--lg-row-highlight` (l'accent UNI, jamais le dégradé), `--lg-row-highlight-glyph` |
| Structure | `--lg-separator`, `--lg-section-label` — suivent le TON du verre qui les porte |
| Barre latérale | `--lg-sidebar-selection` (neutre translucide), `--lg-sidebar-selection-glyph` (l'icône à l'accent) |
| Contenu (jamais du verre) | `--lg-content-fill` · `-hover`, `--lg-content-stroke` : remplissages sobres et opaques |
| Bord, ombre | `--lg-scroll-edge` (une image : le fondu sous la barre du haut), `--lg-surface-shadow` (profonde, douce) |
| Matériau `surface` | `--lg-surface-{blur,saturate,brightness}`, `--lg-refraction-surface`, `--lg-surface-{fill,sheen,glyph,glyph-secondary,danger}-on-{dark,light}`, `--lg-surface-edge-{gain,white}-on-*` — recopiés de `surfaceMaterial.ts` (test de parité) |

Chaque famille COMPOSE ce matériau chez elle, sans redéfinir un nom commun :
mouvement `--lg-spring-*` et accessibilité (`theme/glass/physics.css`, § 6),
fenêtre `--lg-chrome-*` (`desktop/windowGlass.css`, § 8), contrôles `--lgc-*`
(`components/ui/glass/lgRecipes.css`, § 8), contrôles des pages `--lgp-*`
(`components/ui/glass/lgPageControls.css`, § 8), lecteur `--lg-player-*`
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
  - `page` (défaut) — derrière, de la PAGE : la **lentille de Chromium**.
    Profil PHYSIQUE (`@tentacle-tv/ui` glass/`lensProfile` : loi de Snell,
    n = 1,5, biseau convexe squircle) — rien au centre, presque rien au ras du
    bord, un anneau de forte déviation juste à l'intérieur, où le contenu est
    grossi et courbé. `refractionMap.ts` calcule en un passage la carte de
    déplacement de la forme exacte ET la carte de LUMIÈRE du bord ;
    `RefractionFilter` réfracte puis ÉCLAIRCIT le fond réfracté
    (`fond × (1 + gain × intensité)`, un soupçon de blanc) : le bord prend la
    couleur du dessous, un arc face à la lumière, un reflet faible en vis-à-vis,
    rien sur les flancs. `backdrop-filter: <givre, saturation, luminosité>
    url(#lentille)` — les fonctions AVANT `url()`, sinon le liseré est flouté ;
  - `window` — derrière, la fenêtre (le lecteur sur la vidéo) : **région
    native** inscrite auprès du pont (`useLiquidGlassRegion`), la surface se
    rend transparente ; l'appelant garantit que ses ancêtres le sont aussi.
    Un `upsert` + un `remove` par image au plus, sommeil après six images
    sans changement, région retirée dès qu'elle est cachée, hors écran ou
    démontée.
- **Deux RÉGIMES, selon la taille** (option `scale`, lot lg2 — règle d'Apple :
  un grand verre n'a jamais de bandes) :
  - `control` (défaut : bouton, capsule, groupe de barre) — **le ton du
    dessous** (`useBackdropTone`) : la coquille mesure la luminance sous la
    surface (`liquidGlass.sample`, § 2.3), la surface porte
    `data-lg-tone="dark|light"` — glyphes, danger, lumière du bord et reflet en
    suivent ; hystérésis, un appel regroupé par 250 ms, jamais à chaque image ;
    sans échantillonneur, le ton du thème ;
  - `surface` (menu, popover, feuille, barre latérale, palette ⌘K) —
    `data-lg-scale="surface"`, aussi sur une peau CSS (`useGlassControl({ scale })`).
    **UN ton, TENU** (`useSurfaceTone`) : mesuré une fois à l'ouverture, puis
    plus jamais relu — sauf si le THÈME (Clair, Sombre, Auto, apparence du
    système) ou « Réduire la transparence » / « Contraste accru » change sous
    la surface ouverte : ton du thème aussitôt, puis nouvelle mesure après le
    repeint (`surfaceToneProbe.ts`, défaut 25 de l'audit lg2). Mesuré AUTOUR de la surface (`surfaceTone.ts` : une
    couronne à gauche, à droite, au-dessus et sous l'ombre, médiane) — la
    capture de la coquille voit la page PEINTE, et un verre épais mesuré sur
    son propre rectangle se mesurerait lui-même. **Matériau épais** : givre
    30 px, saturation 0,75 (le dessous n'est jamais avivé : au plus 20 % de sa
    couleur traverse — plus de taches), réfraction 0,3 du biseau, lumière du
    bord en sourdine, ombre profonde, et un remplissage par ton (0,78 sombre,
    0,76 clair) qui tient **≥ 4,5:1 pour TOUT texte sur TOUT dessous** —
    prouvé par `surfaceMaterial.ts` sur 216 dessous, blanc et noir purs
    compris, reflet au plus fort. Composé sur l'élément en `--lg-surface-fill`,
    `--lg-surface-backdrop`, `--lg-surface-glyph(-secondary)`,
    `--lg-surface-danger` (`liquidGlassSurface.css`), remappés sur les recettes
    `--lgc-*` et les textes du thème pour les peaux CSS. Sous « Réduire la
    transparence » / « Contraste accru » : l'aplat de `physics.css`, le ton du
    thème, aucune mesure.
  - Le ton et le voile PAR BANDE d'avant (`bands`, `useBandTones`,
    `--lg-band-veil`) sont RETIRÉS (lot lg2) : l'inverse d'Apple, et la
    couture visible des captures de Damien. Un grand verre a UN ton.
- **Options** : `level` (`regular` · `clear` · `tinted` · `prominent`),
  `shape` (`rounded` · `capsule` · `circle` · `rect`), `radius` (`xs` → `xl`),
  `tint` (`brand` · `accent`), `interactive`, `scale` (`control` ·
  `surface`), `z` ; verre natif seulement : `group`, `spacing`, `transition`
  (§ 2.3).
- **Le LABO `/dev/verre`** (`apps/web/src/dev/glassLab/`, paquets de
  développement seulement : la route disparaît des paquets livrés et du client
  LG) : un exemple de chaque surface — groupes de navigation, action principale
  et secondaire, ronds, plateau de survol, menu, lecteur en petits groupes,
  les vrais composants — sur de vrais dessous (affiches de la bibliothèque,
  troupe riso, typographie dense, mire, blanc, noir, « mixte », « couleurs »
  aux taches vives ; `?fond=` pour un banc reproductible). `?vue=grandes` :
  les grandes surfaces du régime `surface` (menu du compte, popover en
  sections, barre latérale de Réglages), rien que les jetons du contrat. **On juge le verre là, AVANT de le
  propager.**
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

**Dans l'application réelle** (22/10 : bureau de production, mode natif,
Jellyfin jetable du banc — `BANC_STATE=<état de lg-banc> node
apps/web/bench/glass-gpu/app-lens.mjs --home <profil jetable>`) :
- la lentille se comporte comme au banc sur « Plus d'infos » du héros :
  repos 1 · survol 1,04 · appui 1,099 · relâché 1,04 ; dix porteurs de
  `data-lg-lens` sur l'accueil, AUCUN sur un verre natif ;
- son coût propre se perd dans le bruit de la page : l'accueil AU REPOS coûte
  déjà 26 à 35 % du GPU d'Electron (sept relevés). Cause relevée : le
  travelling des deux images du héros et sa barre de progression sont
  réécrits ~31 fois par seconde (cadence d'ambiance), SOUS neuf verres
  floutés (barre de la fenêtre, boutons du héros) qui refont leur flou et leur
  réfraction à chaque pas. Travelling masqué : ~0 % (une passe). La part du
  verre seule n'a pas pu être isolée proprement : la mesure par processus
  décroche par moments en cours de passe (les passes du banc de page ont, elles,
  leur calibration).


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
- **Le décor : de PETITES formes qui flottent, séparées** (refonte du 22/10 ;
  la première version, UNE dalle givrée teintée de noir, était « ignoble ») —
  la pastille de la sortie et la capsule du titre en haut ; en bas la capsule
  du temps, puis le son, le transport, les réglages, à 10 px (`--lg-player-gap`),
  AU-DELÀ de la distance de fusion du groupe natif `player` (8) : AppKit les
  garde distinctes au repos. Verre **CLAIR** pour les contrôles (ce qui flotte
  sur la vidéo), verre normal pour les surfaces de texte (panneaux, fiches,
  avis). Popovers (pistes, vitesse, épisodes) qui NAISSENT de leur bouton
  (`glassMorphProps`, la région suit la surface qui grandit). Pilule de saut,
  « Vous regardez encore ? », fiche « à suivre », badges, attente, avis, Watch
  Together, bulle de la vignette du survol. Relevé : 6 vues claires contrôles
  affichés, 7 avec un panneau, 0 masqués.
- **Une ATTÉNUATION sous le verre clair, comme QuickTime** (lot lg3, 23/10 ; avant :
  aucun voile, la lisibilité par le halo — « sur du blanc ou du noir, ça rend vraiment
  mal »). Mesuré sur les captures de la fenêtre (M4, macOS 26) : fenêtre ACTIVE, le verre
  clair seul vire au gris LAITEUX — 87/255 sur du noir pur, 246 sur la neige (33 et 235
  fenêtre inactive : le banc, toujours sans focus, ne voyait que ce cas-là) ; QuickTime
  Player sur les mêmes clips : 88 et 26, glyphes BLANCS. La teinte native (`tintColor`)
  n'y peut rien (242 → 231 même à 85 % de noir) : l'atténuation est un noir à alpha posé
  par la PAGE dans chaque forme, sous le contenu (`playerGlassDim.css`, `::before`,
  `isolation: isolate`), dosé par le TON mesuré dessous (`data-lg-tone`, la vidéo seule) :
  **0,65** dessous clair (neige → 88), **0,5** dessous sombre (noir → 44, liseré et
  reflet du verre visibles), **0,2** dessous sombre fenêtre inactive (→ 26). Seule son
  opacité suit le ton (compositeur). **Glyphes blancs partout** — plus de glyphes sombres
  sur un dessous clair ; secondaire `#d4d4da`. Contrastes mesurés : 7,1:1 (neige) à
  17:1 (noir), icônes 7,5:1 à 14:1.
- **Le verre NORMAL s'adapte seul** (panneaux, fiche « à suivre », « Vous regardez
  encore ? », avis) : 91 sur la neige, 22 sur le noir fenêtre active (96 / 36 inactive),
  déjà le réglage de QuickTime — aucune atténuation, aucune mesure de ton
  (`adaptiveTone` par défaut pour le seul verre clair ; `data-lgp-variant`). Atténué, il
  devenait une dalle noire (32). Exception, le **thème clair** : le verre normal y prend
  l'apparence claire (176 / 130 sous des textes blancs, ~2:1) → 0,5 (88 / 65). Gris des
  panneaux relevés à 4,5:1 sur le plus clair (96) : secondaire `#ececf0`, tertiaire et
  quaternaire `#dcdce2` (titres de section, « aucun épisode » étaient à 3,2 et 2:1).
  Le halo des glyphes reste (contour d'un point, ombre portée), coupé en matière pleine.
  Panneaux : 32 % de noir en thème clair (`--lg-player-panel-tint`, natif). Couleurs de
  la page : l'OPAQUE ou le noir à alpha seulement — un blanc translucide rend gris sur la
  surface à alpha de la fenêtre.
- **La géométrie de l'habillage d'avant** (lot lg3, retour de Damien : « l'overlay doit
  s'adapter à la taille de l'écran, même comportement que sans liquid glass ») : marges
  de 20 px en haut et en bas, 24 px sur les côtés (`--lg-player-inline`, le `px-6` /
  `right-6` d'avant), capsule du temps et rangée du bas d'une marge à l'autre, transport
  au centre de la fenêtre (grille `1fr auto 1fr`) — plus de bas plafonné à 760 px centrés.
  Relevé, verre allumé contre coupé : de 900 × 600 à 1900 × 1040, bouton retour au pixel
  près, bords du bas identiques ; pendant un redimensionnement, page et vue native égales à
  chaque pas de 16 ms (`bench/liquid-glass/lg3/geometry.mjs`). Seul écart voulu : le bloc
  du bas monte de 32 px de plus (le temps a sa capsule, les boutons des cibles de 48 px).
  `playerGlassGeometry.test.ts` lie les jetons aux classes d'avant.
- **Une MÉTAMORPHOSE au lieu d'un fondu** : chaque forme se replie vers le
  pivot de son ensemble (le transport, la sortie — `useCollapsePivots`), s'y
  fond avec les autres en une goutte, et s'en sépare au retour ; la région suit
  la surface image par image, c'est la fin du repli (`visibility`) qui la
  retire. Mesuré : formes nées du pivot (4 × 4 pt à 55 ms), séparées à leur
  place en ~320 ms ; repli en ~200 ms puis 0 vue. Mouvement réduit : fondu
  natif, sans repli.
- **Mouvement** : surfaces FIXES (badges, attente) — fondu natif par
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
- **Masqué, rien ne consomme** : régions retirées en moins de 100 ms,
  `nativeViews: 0`.
- **PiP** : contrôles d'avant (le document du PiP n'a pas de pont) ; le lecteur
  principal retire ses régions pendant le PiP (5 → 0 → 5, mesuré).
- **GPU** (`ioreg`, relatif) : contrôles affichés ≈ +8 points avec le verre ;
  masqués, aucun coût.

## 8. La fenêtre, la navigation, les composants, le hors ligne

Tout en LENTILLE de Chromium (§ 4) — aucune région native par contrôle. Les
glyphes de chaque surface suivent son ton (`data-lg-tone`) : les couleurs de
texte du thème deviennent `--lg-glyph*` sous la porte.

- **Fenêtre et navigation** (lg-chrome, `apps/web/src/desktop/windowGlass.css`,
  `windowGlassNav.css`, `windowGlassSidebar.css`, jetons `--lg-chrome-*`) :
  bandeau des feux transparent, le contenu défile dessous ; **effet de bord de
  défilement** (`ScrollEdgeEffect.tsx` : monté seulement page défilée, opacité
  sur les 48 premiers px) — flou masqué en paliers et teinte sur une courbe
  SANS pli (accélérée jusqu'à la hauteur des libellés, dont elle tient l'AA,
  puis une Hermite raccordée qui s'éteint à pente nulle ; mesuré au labo, lot
  lg2). La `TopNav` en **GROUPES qui flottent** à 10 px
  (`--lg-chrome-group-gap`) — marque + onglets, recherche, boutons + profil,
  trois surfaces de la primitive au régime `control` (petits : ils basculent
  avec le ton du dessous) ; dans un groupe, de simples glyphes (pas de verre
  dans le verre), des remplissages NEUTRES au ton du groupe : survol < appui
  (« Plus » ouvert) < sélection. **L'onglet courant** est la pastille de la
  barre d'onglets d'iOS 26 : remplissage neutre concentrique au groupe, qui
  GLISSE (ressort `morph`), le glyphe seul à l'accent — jamais la marque en
  aplat ; pastilles de la cloche et de Watch Together à l'accent uni, sans
  halo. « Plus » calculé sur la place libre de sa case. **Barres latérales**
  de Réglages et d'Admin (`useGlassSidebar` → prop `sidebarSurface` de
  `SettingsShell`) : une surface de la primitive au régime `surface` (un ton
  tenu, matériau épais), en retrait des bords, sans dégradé ; sélection en
  remplissage neutre translucide (`--lg-sidebar-selection`) concentrique au
  rail, l'icône à l'accent. **Fenêtre inactive** (`windowFocus.ts`,
  `data-window-inactive`) : les pastilles restent, l'accent cède au gris.
  Pendant la lecture native, le bandeau redevient OPAQUE
  (`data-native-playback`). Labo : `/dev/verre?vue=barres` (la vraie barre et
  une vraie barre latérale sur les dessous du labo, page défilable).
- **Composants** (lg-composants, `components/ui/glass/` : `lgRecipes.css`,
  `lgControls.css`, `lgOverlays.css`, `lgLegibility.css`, `useGlassControl`,
  `GlassPressable`) : des CLASSES-MARQUEURS sans aucun style hors de la porte —
  `.hero-cta-primary` / `.lg-btn-primary` (action principale, verre proéminent
  de marque), `.lg-btn-media`, `.lg-capsule-media`, `.lg-btn`, `.lg-disc`
  (flèches des rangées, montées au survol), `.lg-tray` (plateau du survol des
  cartes), `.lg-pill`, `.lg-chip`, `.lg-meta`, `.lg-field`, `.lg-segmented`,
  `.lg-menu`, `.lg-sheet` / `.lg-scrim`, `.lg-toast`, `.lg-bar`, `.lg-notice`,
  `.lg-panel`, `.lg-badge`. Le modèle des cartes (`cardOverlay.ts`) est intact :
  seule la peau change. Depuis la refonte : l'action principale (« Lecture »,
  « Reprendre », « Demander », confirmation) est une capsule `prominent` — la
  marque DANS le verre, l'affiche se voit au travers (`PressableGlass`,
  `HERO_PLAY_PROPS`) ; « Plus d'infos », bande-annonce, « Annuler » en verre
  clair ou régulier ; les RONDS (flèches des rangées, Ma liste · favori · vu de
  la bannière, angles de la fiche) et le plateau du survol des cartes en
  pastilles de verre clair séparées — une bascule allumée passe en verre
  teinté (rose pour le favori) ; menus, feuilles et modales en GRAND verre
  (`useGlassControl({ scale: "surface" })`, § 4 : un ton tenu, matériau épais —
  le ton et le voile par bande d'avant sont retirés par le lot lg2), le rouge
  de danger (« Déconnexion ») au ton de la surface.
- **Menus et popovers : l'anatomie d'un menu de macOS 26** (lot lg2,
  `components/ui/glass/lgMenu.css`) — compte, « Plus », menu d'un onglet,
  éditeur de la barre, filtres et tri, menus contextuels, notifications, Watch
  Together, hors ligne, palette ⌘K, sélecteur de pays. UNE plaque par menu ;
  dedans, jamais un verre de plus : marge de 5 px (`--lg-row-inset`), survol
  et focus clavier en PASTILLE insérée à l'accent UNI (`--lg-row-highlight`,
  blanc ≥ 5,7:1 — jamais une barre bord à bord ni le dégradé de marque), rayon
  de la rangée = rayon du panneau − marge (calculé sur le panneau qui la porte :
  un popover large a `--lg-radius-lg`), en-têtes discrets
  (`--lg-section-label`, sans capitales), filets fins (`--lg-separator`),
  coche sans fond teinté, page courante en remplissage neutre, destruction en
  pastille rouge (#DC2626, blanc 4,8:1). Des MARQUEURS sans style hors de la
  porte (`.lg-menu-list`, `.lg-row`, `.lg-sep`, `.lg-menu-label`…, liste en
  tête du fichier) ; les rangées à rôle ARIA (`menuitem*`, `option`) sont
  reconnues seules, l'option active d'une liste par `data-lg-active`
  (`aria-selected` dit tantôt l'active, tantôt la valeur choisie). Le menu
  NAÎT de son déclencheur (`floatingMotion.ts` : échelle 0,9 → 1 sur un ressort
  court, sortie à 65 %, fondu seul en mouvement réduit). Labo :
  `/dev/verre?vue=menus`. Preuve du rendu d'avant : styles calculés de quatre
  menus ouverts (survol compris), base contre branche, porte éteinte — 4 512
  propriétés, 0 écart.
- **Contrôles des pages : du verre, même dans une page** (lot lg4,
  `components/ui/glass/lgPageControls.css` pour les jetons `--lgp-*`,
  `lgPageGlass.css` pour la peau des marqueurs, `lgPageButtons.css` pour les
  boutons ad hoc). Portée : `.lg-page` (la zone d'`AppLayout`) et `.lg-detail`
  (la fiche, servie hors d'`AppLayout`), jamais sous un verre
  (`[data-lg-scale="surface"]`, `.lg-surface`, `.lg-menu`, `.lg-sheet`, dialogue).
  - **Le verre sur un fond opaque se lit encore comme du verre** : légère
    translucidité (voile blanc dégressif), reflet diffus en haut à gauche,
    liseré de LUMIÈRE (arc éclairé du côté de la lumière, contre-reflet en
    vis-à-vis), profondeur (ombre de contact + ombre portée douce). **Aucun
    `backdrop-filter`** : sur un remplissage opaque il ne flouterait qu'un aplat,
    pour une passe de composition par contrôle — tout est peint une fois, rien ne
    se recalcule au défilement. Jamais un simple aplat plus clair.
  - **Par ton** : jetons `-on-dark` / `-on-light`, choisis par le thème ou par le
    ton mesuré d'un contrôle (`data-lg-tone`). Libellés ≥ 4,5:1 au PIRE point du
    reflet (`lgPageControls.test.ts`, qui calcule la composition couche par
    couche — il a trouvé une lentille sombre à 4:1 et un rouge de danger à 3,9:1,
    corrigés).
  - **Qui reçoit quoi** : `.lg-chip` (pastilles, déclencheurs de `FilterMenu`),
    `.lg-content-control` (sens du tri, « Partager »), `.lg-pill` (« Tout voir »),
    `.lg-field` (champ de recherche), `.lg-glass-btn` (marqueur à la main :
    `ActionPill`, `Tabs`, `ChoiceChips`, tri des utilisateurs) → `glass` ; un
    filtre POSÉ (`.lg-chip-on`) → l'accent UNI dans le verre ; un onglet ou une
    pastille CHOISIS (`.lg-glass-selected`, `:checked + .lg-glass-btn`) → la
    lentille neutre ; les boutons ad hoc se reconnaissent à leur FORME (`button` /
    `a` / `select` arrondi, rempli ou bordé, jamais une tuile rembourrée ou
    alignée à gauche) : secondaire et danger → `glass`, `bg-cta-primary-bg` →
    `glassProminent` (la marque dans le verre, rose assombri à 82 % : blanc
    ≥ 4,5:1). Les champs de SAISIE d'un formulaire et les tuiles de choix
    restent des remplissages (Réglages Système).
  - **Segmentés** : piste EN CREUX, segment choisi en LENTILLE qui GLISSE —
    `.lg-seg-marker` (repère de framer, `layoutId`) ou `SegmentLens` (segmentés
    de réglages `.ctl-segment`, montée en natif seulement, ressort `morph`,
    fondu en mouvement réduit) ; à l'appui sur la piste, la lentille gonfle
    (`scale`). **Interrupteur** : piste en creux, le pouce s'étire en lentille à
    l'appui. Seuls `scale`, `transform`, `opacity` et la couleur du libellé sont
    en transition ; l'appui gonfle le verre (`--lgp-press-scale`, 1,04), 1 en
    mouvement réduit. « Réduire la transparence » : verre plein ; « Contraste
    accru » : plein + liseré net.
  - Labo : `/dev/verre?vue=controles` (les vrais contrôles sur le panneau d'outils
    opaque et sur le fond nu de la page).
- **Hors ligne** : message de passage hors ligne et avis en `.lg-notice`,
  panneaux de la page hors ligne en `.lg-panel` (sans flou), bannière en
  lentille ; dialogues « garder hors ligne » et de suppression en portail (§ 5).
- **Bannières** : la rotation ne tourne que STRICTEMENT à l'écran
  (`useBillboardViewport`, `billboardActivity`) — sous un verre, toute image qui
  change fait recalculer le flou (51 → 0 DrawFrame/s hors écran). Le travelling
  du héros (zoom du fond et du halo, remplissage de la pastille active) est
  joué par le COMPOSITEUR : `@keyframes` de `transform` bridées par `steps()`
  aux trente paliers par seconde (`theme/heroMotion.css`), plus des animations
  de framer qui passaient chaque palier par un rendu — mesuré, 60 % du GPU
  d'Electron en `linear` contre 20 en `steps()`. Mouvement réduit : aucun
  travelling.

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
  lecteur, rendues par la VRAIE primitive (`FauxGlass` n'est qu'un placement :
  lentille, lumière du bord, ton du dessous) ; sur la vidéo, la lentille
  `clear` de la page tient lieu du verre natif, qu'une scène ne peut pas
  emprunter. La barre en groupes, le lecteur en petites formes nées d'une
  goutte. La navigation exige le trait
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
