# Liquid Glass — le verre de macOS 26 dans le bureau (1.40.0)

Carnet commun du lot « Liquid Glass macOS » (nuit du 21 au 22/10/2026). Chaque
section dit qui la tient ; une section « à écrire » attend la fusion de son
morceau dans `dev`, et se rédige d'après ce qui a été FUSIONNÉ, jamais d'après
un plan.

| Section | Tenue par |
|---------|-----------|
| 1. La règle | lg-livraison |
| 2. Le socle natif | lg-natif |
| 3. Les jetons `--lg-*` | lg-livraison, d'après lg-tokens |
| 4. La primitive | lg-livraison, d'après lg-tokens |
| 5. Mode d'emploi : une nouvelle surface en verre | lg-livraison |
| 6. Le « liquide » : mouvement, reflet, accessibilité | lg-physique |
| 7. Ce qui ne doit jamais casser | tous |
| 8. Livraison : nouveautés, notes, licences | lg-livraison |
| 9. Bancs et mesures | lg-banc |

## 1. La règle

- **Le verre NATIF, ou le rendu d'avant.** Sur macOS 26 (Tahoe) et au-delà, dans
  l'app de bureau, la fenêtre reçoit le vrai verre du système
  (`NSGlassEffectView`, classe PUBLIQUE d'AppKit, pilotée par le pont koffi déjà
  dans le dépôt — aucun module natif de plus) et la page dessine
  ses surfaces pour s'y accorder. Partout ailleurs — web, Windows, Linux, macOS
  d'avant 26, réglage coupé —, **le rendu d'avant, au pixel près** : aucune
  classe, aucun jeton, aucun calque de plus.
- **Activé d'office, coupé dans Réglages › Apparence.** L'option n'existe QUE là
  où le système sait faire : elle est invisible ailleurs, jamais grisée.
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
- **`electron-liquid-glass`** (Meridius Labs, MIT, 1.1.1) a été lu et écarté :
  une seule vue plein cadre par fenêtre (`addView`), sans rectangle, sans
  retrait ni mise à jour de géométrie — on n'y pose ni une barre ni un bouton ;
  ses variantes (`unstable_setVariant`, `scrim`, `subdued`) passent par des
  sélecteurs PRIVÉS (`set_variant:`…), refusés au Mac App Store, seul canal
  macOS ; node-gyp, prebuildify et un `.node` de plus. C'est **la même classe**
  `NSGlassEffectView`, posée sans l'enveloppe — le vrai verre du système, pas
  une imitation CSS.
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

- `supported`, `refractsVideo` (le verre voit la vidéo posée sous la page —
  vrai sur les DEUX montages, mesuré), `setEnabled(bool)`, `upsert(regions[])`,
  `remove(ids[])`.
- Région : `id`, `x`, `y`, `width`, `height` (px CSS du viewport), `radius`,
  `level` (`regular` | `clear` | `tinted` | `prominent`), `tint`
  (`#RRGGBB[AA]` ou `null`), `interactive`, `z` ; facultatifs : `group` (un
  `NSGlassEffectContainerView` par groupe : les verres voisins FUSIONNENT ; sans
  groupe, une région est seule), `spacing` (distance de fusion du groupe, en
  points), `transition` (ms : apparition, déplacement et disparition animés
  côté natif, par `NSAnimationContext`).
- AppKit n'a que deux styles : `clear` → `Clear`, les trois autres → `Regular` ;
  `tinted` et `prominent` se distinguent par leur teinte. `interactive` : aucune
  API publique, sans effet natif.
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

### 2.5 Cycle de vie

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

### 2.6 Fenêtre, plein écran, HDR, PiP

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
  production) restent une passe manuelle : elle exige sudo.
- Un écran sans plage étendue (« potentiel 1 », un moniteur SDR) ne donne pas
  de HDR, verre ou pas : le relevé HDR ci-dessus vient de l'écran XDR intégré.

### 2.7 Banc

`globalThis.__tentacleGlass.snapshot()` dans le principal, hors paquet :
`{ supported, availability, refractsVideo, enabled, surfaceVisible, root,
groups, nativeViews, regions: [{ id, level, group, z, css, frame, radius,
style, hidden }] }` — relu sur les VRAIES vues : `nativeViews` compte les
`NSGlassEffectView` présentes dans AppKit, `frame` est le cadre de la vue
(points, origine en bas). `TENTACLE_BENCH_INACTIVE=1` (hors paquet) : la
fenêtre s'ouvre sans prendre le focus — un banc ne vole plus les frappes de
celui qui tape ailleurs.

## 3. Les jetons `--lg-*`

> À écrire d'après la fusion de **lg-tokens** : la table des jetons
> (`apps/web/src/theme/tokens.css`), leur valeur en clair et en sombre, et le
> sélecteur qui les allume (la racine ne les porte QUE quand le verre est actif).

Ce que la table doit dire, pour chaque jeton : son rôle (flou, saturation,
teinte neutre, teinte de marque, liseré, reflet, ombre, rayon), sa valeur
claire, sa valeur sombre, et qui le consomme.

## 4. La primitive

> À écrire d'après la fusion de **lg-tokens** : le composant `LiquidGlass` et
> son crochet (`packages/ui/src/glass/`), leurs props, ce qu'ils rendent quand
> le verre est coupé (le rendu d'avant, sans enveloppe superflue), et le crochet
> qui dit « verre actif » / « verre supporté ».

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
5. **Le lecteur ne perd jamais son HDR** (§ 7) : une surface posée sur la vidéo
   se vérifie par `video-target-params`, avant et après.
6. **Hors macOS 26, rien** : un test le dit — la surface rend exactement le
   balisage d'avant quand le verre est inactif.

## 6. Le « liquide » : mouvement, reflet, accessibilité

> À écrire par **lg-physique** : morphing et fusion des verres, lentille au
> survol et à l'appui, reflet qui suit le pointeur, ressorts ; « Réduire la
> transparence », « Augmenter le contraste », mouvement réduit ; le budget GPU
> mesuré.

## 7. Ce qui ne doit jamais casser

- **Le HDR / EDR du lecteur** : Apple Silicon, fenêtre Metal de mpv SOUS la
  nôtre ; Intel, `NSOpenGLView` dans la nôtre (CLAUDE.md, « macOS — deux
  montages vidéo »). Le verre ne s'interpose jamais entre la vidéo et l'écran
  d'une façon qui ferait passer la sortie en SDR.
- **Le Mac App Store** : aucune API privée dans le build MAS.
- **L'ombre de la fenêtre transparente** : jamais rallumée (CLAUDE.md,
  « Coût GPU » § 4).
- **Le rendu d'avant** hors macOS 26 et réglage coupé.

## 8. Livraison : nouveautés, notes, licences

- **Notes de version** (`changelogs/desktop.md`) : le verre n'existe que sur
  macOS 26, il ne paraît donc QUE dans le bloc `## [mac-1.40.0]` (App Store
  Connect). Le bloc nu `## [1.40.0]` (Microsoft Store, Linux) porte les autres
  nouveautés de la version ; chacune se recopie aussi dans le bloc Mac, sous le
  verre. Jamais un commentaire DANS `### FR` / `### EN` : il partirait chez le
  store.
- **Écran des nouveautés** (`apps/web/src/whatsNew/`) : release `1.40.0`
  (`releases/v1_40_0.tsx`), scènes `scenes/v1_40_0/` — la navigation et le
  lecteur, le verre PEINT par `FauxGlass` (une scène ne peut pas emprunter le
  verre natif). Elles portent `requires: "liquidGlass"` : le filtre `forClient`
  les retire là où l'appareil n'a pas le verre (`clientTraits.ts`), et une
  release ainsi vidée n'ouvre pas d'écran.
- **Licences** : rien à ajouter à `apps/desktop-electron/THIRD-PARTY-LICENSES.md`
  — le verre passe par AppKit et koffi, déjà présents ; le module
  `electron-liquid-glass` n'a pas été retenu (§ 2).

## 9. Bancs et mesures

> À écrire par **lg-banc** : comment lancer le banc Electron du verre (CDP,
> captures de fenêtre), les mesures `powermetrics` de référence (au repos, en
> lecture, verre allumé et coupé), et la recette d'une fusion.
