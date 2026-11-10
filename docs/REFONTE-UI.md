# Refonte de l'interface (nov. 2026) — le carnet du socle

Le web et le bureau portent une nouvelle peau, validée par Damien sur prototype le 10 nov. 2026. Ce carnet dit
comment s'en servir : il doit suffire à qui redessine un écran. Le labo `/dev/socle` montre tout ce qui suit, en
sombre et en clair ; `apps/web/src/theme/socle.test.ts` tient les valeurs.

Trois principes, dans l'ordre où ils tranchent :

1. **On ne perd rien.** Une fonction, un réglage, une information visible ne disparaît jamais. On range, on clarifie.
2. **La couleur est aux images.** L'interface est une encre neutre ; l'accent rose-violet ne sert qu'à LIRE (l'action de
   lecture), à MESURER (les jauges) et à dire un état ACTIF. Plus de dégradé décoratif. Jamais d'orange.
3. **Léger.** `transform` et `opacity` seulement ; ce qui n'est pas affiché ne consomme rien ; jamais de verre sur du
   verre (CLAUDE.md, « Coût GPU » et « Budget de lentilles », valent double).

## 1. Les jetons

Tous dans `apps/web/src/theme/tokens.css` (`:root` sombre, `:root[data-theme="light"]` clair). **Aucun nom d'avant
n'a changé** — l'iframe des extensions, le miroir, Octave et le client LG les lisent — ; des valeurs ont changé, des
jetons se sont ajoutés. Un jeton de couleur nouveau se déclare dans les DEUX blocs et dans `CSS_VAR_NAMES`
(`packages/theme`, `cssVars.test.ts` le refuse sinon).

### Surfaces — une surface se distingue par sa TEINTE, plus par un liseré

| Jeton | Sombre | Clair | Rôle | Classe |
|---|---|---|---|---|
| `--surface-0` | `#0B0B0C` | `#F3F2EF` | la page | `bg-surface-0` |
| `--surface-1` | `#131315` | `#FFFFFF` | panneau, feuille | `bg-surface-1`, `.ui-panel` |
| `--surface-2` | `#1B1B1E` | `#ECEBE7` | carte, tuile, champ | `bg-surface-2`, `.ui-tile` |
| `--surface-3` | `#242428` | `#E3E1DC` | survol, avis | `bg-surface-3` |
| `--surface-4` | `#303036` | `#D6D4CE` | sélection | `bg-surface-4` |
| `--surface-modal` / `-sheet` | `#131315` | `#FFFFFF` | feuille (OPAQUE) | `.ui-sheet` |
| `--surface-dropdown` | `#1E1E22` | `#FFFFFF` | menu (OPAQUE) | `.ui-menu` |
| `--fill-faint → strong` | blanc 3 → 24 % | encre 3 → 22 % | remplissages translucides | `bg-fill-*` |
| `--border-subtle` / `-strong` | blanc 8 / 16 % | encre 9 / 18 % | un séparateur — pas un contour | `border-line-*` |
| `--shadow-edge` | arête haute 7 % | trait 5 % | le liseré d'avant, en ombre intérieure | `shadow-edge` |

Texte : `--text-primary` (`#F4F2EE` / `#131315`), `-secondary` 74 %, `-tertiary` 55 %, `-quaternary`, `-disabled` —
classes `text-content-*`. Sur une image : `--on-media-*` (constant entre les thèmes).

### Accent

| Jeton | Valeur (sombre) | Sert à |
|---|---|---|
| `--cta-brand-gradient` | `linear-gradient(120deg, #7C3AED, #DB2777)` | l'action de LECTURE, libellé blanc — `.btn-play`. Une par écran. |
| `--gauge-gradient` | `linear-gradient(90deg, #8B5CF6, #EC4899)` | ce qui se MESURE : lecture, file hors ligne, volume — `.gauge`, `--progress-fill` |
| `--accent` (+ `--accent-rgb`) | `#E58CF0` (clair : `#A21CAF`) | un état ACTIF : favori, vu, interrupteur, case, focus — `text-accent`, `bg-accent` |
| `--on-accent` | `#27062E` (clair : blanc) | l'encre posée sur un aplat d'accent — `text-accent-on` |
| `--accent-soft` | accent à 16 % | le fond d'une tuile ou d'une puce choisie — `bg-accent-soft` |

`--brand*` reste la marque (logo, mascotte). `bg-accent/20` compose son opacité ; sur un jeton `var()` (`accent-soft`,
`surface-*`, `content-*`…), **jamais de `/opacité`** : Tailwind supprime la déclaration en silence
(`alphaModifier.test.ts`).

### Rayons, ombres, typographie

| Rayon | Jeton | Classe | Pour |
|---|---|---|---|
| 6 | `--radius-sm` | `rounded-chip` | puce, pastille, case |
| 10 | `--radius-md` | `rounded-field` (`rounded-lg` vaut 10) | champ, entrée de menu |
| 12 | `--radius-lg` | `rounded-card` | carte, affiche |
| 16 | `--radius-xl` | `rounded-tile` | tuile, menu, avis |
| 20 | `--radius-2xl` | `rounded-panel` | panneau |
| 24 | `--radius-3xl` | `rounded-sheet` | feuille, bannière |
| ∞ | `--radius-pill` | `rounded-pill` | TOUS les boutons |

Ombres : `--elev-1/2/3` (`shadow-elev-*`), `--shadow-dropdown` (`shadow-menu`), `--shadow-modal` (`shadow-sheet`),
`--elev-card-hover`. Une ombre ne s'anime JAMAIS : deux calques, un fondu d'opacité (`theme/cards.css`).

Polices, embarquées par `theme/fonts.css` (jamais un CDN) : **Bricolage Grotesque** pour les titres
(`--font-display`, classe `font-display`, d'office sur `h1`, `h2` et les échelles `text-display-*`, `text-heading-1/2`),
**Figtree** pour le texte (`--font-text`, `font-sans`). Inter reste derrière elles pour le cyrillique et le grec. Un
grand titre est SERRÉ (−0,02 à −0,035 em, déjà dans les échelles). Un nombre qui change (durée, pourcentage, compteur)
porte `tabular-nums` ou `.num`. Un paragraphe ne dépasse pas `max-w-[65ch]`.

### Mouvement

| Geste | Durée | Courbe | Jeton CSS · `theme/motion.ts` |
|---|---|---|---|
| pression d'un bouton (97 %, dès l'appui) | 120 ms | sortie | `--duration-press`, `--press-scale` · `duration.press`, `pressTransition` |
| survol, couleur | 160 ms | `ease` | `--duration-hover` · `duration.hover` |
| menu, déroulant, infobulle | 180 ms, sortie 120 | sortie | `--duration-menu-in/out` · `duration.menuIn/menuOut` |
| survol d'une carte (+3 % sur place) | 220 ms | sortie | `--duration-card`, `--card-hover-scale` |
| feuille, modale | 320 ms, sortie 200 | tiroir | `--duration-sheet-in/out` · `duration.sheetIn/sheetOut`, `easeDrawer` |
| changement de page | fondu seul, 140 ms (sortie 120) | — | `pageTransition` (`PageTransition`, `RouteExit`) |

Courbes : `--ease-out` `cubic-bezier(.23,1,.32,1)` (ce qui entre, sort ou répond), `--ease-in-out`
`cubic-bezier(.77,0,.175,1)` (ce qui se déplace), `--ease-drawer` `cubic-bezier(.32,.72,0,1)`. Classes : `ease-out`,
`ease-drawer`, `duration-press`, `duration-hover`, `duration-card`…

Les règles (Emil Kowalski, `.claude/refonte-ui/skills/`) :

- on anime `transform` et `opacity`, rien d'autre ; on liste les propriétés (`transition-[color,transform]`) ;
- une sortie est plus COURTE que l'entrée, par le même chemin ; rien ne naît de `scale(0)` (0,96 au moins) ;
- un geste déclenché au CLAVIER ne s'anime pas ; rien d'interface ne dépasse 320 ms ;
- un survol ne vaut qu'à la souris : `hover:` de Tailwind est déjà enfermé dans `(hover: hover) and (pointer: fine)`
  (`hoverOnlyWhenSupported`) ; en CSS, écrire la requête ;
- une animation infinie se met en pause hors écran (`useInViewport`) ;
- `prefers-reduced-motion` : les jetons de durée tombent à 0 et les échelles à 1 (`motion-reduce.css`) — une animation
  framer lit `useReducedMotion()` ;
- **une durée qui est un RÉGLAGE de l'utilisateur ne se touche pas** (`previewDelay.ts` : l'aperçu paraît au délai
  choisi, exactement).

## 2. Faire un bouton

Tous les boutons sont des pilules — `theme/buttons.css`. On compose une base, une taille, une peau :

```tsx
<button type="button" className="btn btn-play btn-lg"><PlayIcon size={20} /> Lecture</button>
<button type="button" className="btn btn-solid">Enregistrer</button>
<button type="button" className="btn btn-soft btn-sm"><PlusIcon size={16} /> Ma liste</button>
<button type="button" className="icon-btn" aria-label={t("favorite")} aria-pressed={on}>
  <HeartIcon size={20} weight={on ? "fill" : "regular"} />
</button>
```

| Classe | Rôle |
|---|---|
| `.btn` · `.btn-sm` · `.btn-lg` | la pilule de 40 px · 32 · 52 |
| `.btn-play` | l'action de lecture : le dégradé du logo. Une par écran, et pour LIRE seulement |
| `.btn-solid` | l'action principale neutre (ivoire en sombre, encre en clair) |
| `.btn-soft` | l'action secondaire, sur la page ou un panneau |
| `.btn-on-media` | l'action secondaire posée sur une image |
| `.btn-ghost` | l'action discrète (Annuler) |
| `.btn-accent` · `.btn-danger` | l'action intermédiaire à la teinte franche · la destructive |
| `.icon-btn` (+ taille, + peau) | le rond d'une icône ; `aria-pressed="true"` ou `data-on="true"` l'allume à l'accent |

La pression (97 %, 120 ms), le survol et le focus sont dans la classe : on n'ajoute ni `hover:scale`, ni
`active:scale`, ni `transition`. Dans l'administration, `cls.bp / bs / bd / bbrand / inp / card` (`pages/adminUtils.ts`)
sont des raccourcis vers ces classes. Pour un bouton React à ressort ou en verre : `PressableScale` (même pression),
`GlassButton` / `PressableGlass` — **les classes du socle vont dans `fallbackClassName`**, la mise en page dans
`className` (le verre natif retire la première et garde la seconde).

**Le bouton Retour** : `<BackButton />` (`components/ui/BackButton.tsx`) sur TOUTE page qui n'est pas une racine de
navigation. Il revient d'où l'on vient ; ouvert par un lien direct, il mène à `fallback`. `onMedia` sur une image,
`label` pour l'écrire.

## 3. Champs, cases, choix

- **Champ** : `className="field"` (40 px, rayon 10, anneau de focus à l'accent) ; `field-pill` pour une recherche ;
  `aria-invalid="true"` le borde de rouge.
- **Interrupteur** : `ToggleSwitch` (`components/settings`). Allumé : `--accent`.
- **Case** : un `role="checkbox"` avec `aria-checked`, et dedans `<span className="ui-check">` + la coche.
- **Choix segmenté** : `SegmentedControl` (bibliothèque, marqueur qui glisse) ou `SegmentedChoice` (réglages,
  `.ctl-segmented` + `.ctl-segment`). L'option retenue est une pastille NEUTRE (`--surface-4`), jamais un dégradé.
- **Onglets** : `Tabs`. **Curseur** : `className="ctl-range"` + `style={rangeFill(v, min, max)}` — il mesure, il porte
  le dégradé de jauge.
- **Tuile de choix** : `className="ui-tile"` + `aria-pressed` / `aria-checked` (fond `--accent-soft`, trait d'accent).
- **Puce** : `.chip` (+ `.chip-accent`, `-success`, `-warning`, `-danger`, `-on-media`). Une information, pas un bouton.
- **Jauge** : `<div className="gauge"><i style={{ transform: `scaleX(${ratio})` }} /></div>` — jamais une largeur animée.
- **Squelette** : `.skeleton-shimmer` ou `Shimmer` — une teinte calme, IMMOBILE. Plus de balayage.

## 4. Faire un menu, une feuille, un avis

- **Menu / déroulant** : `Dropdown` (ou `FloatingLayer` pour un panneau libre). Il passe par un PORTAIL, se place
  seul et SORT de son bouton : l'origine de l'échelle est celle du déclencheur (`transformOrigin` du placement). Dedans :
  `.ui-menu-item` (+ `aria-checked` / `aria-current`, `.ui-menu-item-danger`), `.ui-menu-label`, `.ui-menu-separator`.
  Une peau de menu posée à la main : `.ui-menu`.
- **Feuille / modale** : `Modal` (centrée) ou `Sheet` (tiroir), avec `ModalHeader` ; une confirmation : `ConfirmDialog`.
  **Toujours un portail** — un `backdrop-filter`, un `transform` ou une lentille font d'un ancêtre le bloc conteneur
  d'un `fixed` (`modalPortal.test.ts`). Le voile n'est plus flouté hors du verre natif ; la feuille est opaque.
- **Avis** : `NoticeHost` / `NoticeCard` (messages du produit) ; une peau d'avis posée à la main : `.ui-toast`.
  **Infobulle** : `.ui-tip`. **Touche** : `.ui-kbd`. **Surtitre** : `.ui-eyebrow`.
- **Panneau** : `.ui-panel` (encre 1, rayon 20, arête) — plus de `border border-line-subtle bg-fill-faint`.

Verre : la barre du haut, les menus, les feuilles et les capsules du lecteur sont la couche de verre ; le contenu
(cartes, panneaux) est OPAQUE. Hors `data-liquid-glass="native"`, c'est le rendu ci-dessus ; en natif, les mêmes
formes passent par la primitive (`theme/glass/`, `fallbackClassName`). Aucune règle `--lg-*` ou `.lg-*` hors de sa
porte (`liquidGlassTokens.test.ts`).

## 5. Poser une icône

Phosphor (`@phosphor-icons/react`), **importée une à une** :

```tsx
import { HeartIcon } from "@phosphor-icons/react/dist/csr/Heart";
import { PlayIcon } from "../icons/transport"; // lire, pause, précédent, suivant, reculer, avancer

<HeartIcon size={20} weight={favorite ? "fill" : "regular"} aria-hidden />
```

- **Au trait au repos (`regular`), PLEINE quand l'état est actif (`fill`)** — et alors à la teinte franche.
- **Le transport du lecteur est toujours plein** : on l'importe de `components/icons/transport`, jamais du paquet.
- `bold` pour un petit pictogramme (≤ 14 px) qui doit tenir sa ligne. **Trois graisses, pas une de plus** : `thin`,
  `light` et `duotone` sont retirées du paquet à la compilation (`tooling/phosphorWeights.ts`) et ne dessineraient
  RIEN une fois le build fait — un test le refuse.
- Toujours une taille : `size={20}` ou une classe (`h-5 w-5`). Sans rien : 24 px (défaut posé par `ThemeProvider`).
- Jamais l'import du paquet entier (`from "@phosphor-icons/react"`) hors d'un `import type`.
- Les NOMS que les extensions envoient (`components/lucideIcon.tsx`, « bar-chart-2 »…) et ceux du guide
  (`help/guideIcons.tsx`) ne changent pas : ils traversent le réseau. Les tracés de
  `packages/shared/src/utils/cardMarkerGlyphs.ts` restent ceux du mobile et de la TV.
- Les fichiers d'avant (`HeroIcons`, `PlayerIcons`, `cardGlyphs`, `MediaDetailIcons`, `pipIcons`, `DownloadGlyph`,
  `userMenu/icons`) gardent leurs exports, dessinés par Phosphor. Reste écrit à la main ce qui porte un NOMBRE
  (`glassIcons.tsx`, le saut de n secondes), les logos et les illustrations.

## 6. Une image qui ne clignote pas

La couleur de l'image d'abord, puis UN fondu de 220 ms ; déjà vue pendant la séance, elle est là d'emblée.

- une carte de la bibliothèque : `CardImage` (chargement à l'approche, nouvelles tentatives) ;
- toute autre image : `<FadeImage src alt color className />` (`components/ui/FadeImage.tsx`) ;
- la couleur d'attente : `imageColorOf(item.ImageBlurHashes, "Primary", tag)` (`lib/blurhashColor.ts`) — la couleur
  moyenne lue dans le blurhash de Jellyfin, quatre caractères, sans rien décoder. Sans elle : l'encre de carte.

Jamais deux fondus (un squelette qui sort, une image qui entre), jamais de squelette animé, jamais de zoom de l'image
au survol : la carte grandit de 3 % sur place (`CardFrame`), et c'est tout.

## 7. Ce qui est interdit

| Interdit | À la place |
|---|---|
| un dégradé décoratif (barre de titre, pastille, onglet, anneau, lavis) | l'encre ; le dégradé pour lire et mesurer seulement |
| l'orange, le noir pur `#000`, `bg-black` / `text-white` hors d'une image | les jetons (`bg-surface-0`, `text-content-primary`) |
| un liseré blanc sur chaque surface (`border border-line-subtle`) | une teinte, ou `shadow-edge` |
| un bouton rectangulaire (`rounded-lg` sur un `<button>`) | `.btn` — une pilule |
| `transition-all`, `transition: all`, `ease-in`, `scale(0)` | les propriétés listées, `ease-out`, 0,96 au moins |
| animer `box-shadow`, `width`, `height`, `top`, `background-position`, `filter` | `transform`, `opacity` |
| un `backdrop-filter` derrière un fond à plus de 0,9 d'alpha, ou masqué par `opacity: 0` | rien ; monter à la demande (`useHoverMount`) |
| du verre sur du verre ; une lentille de plus sans la compter | `node perf/census.mjs /route` (budget : 8 lentilles) |
| un `hover:` qui déplace ou grossit un contrôle | la pression seule ; la couleur au survol |
| changer une durée qui est un réglage (`previewDelay.ts`) | — |
| renommer un jeton, une clé i18n, une clé de stockage, un nom d'icône d'extension | ajouter, jamais renommer |
| un texte en dur | i18n, FR et EN |
| `import { X } from "@phosphor-icons/react"` ; `weight="duotone"` | l'import par icône ; `regular`, `fill`, `bold` |

## 8. Vérifier

```bash
pnpm --filter @tentacle-tv/web test          # dont theme/socle.test.ts et tooling/phosphorWeights.test.ts
pnpm --filter @tentacle-tv/theme test        # cssVars.test.ts : tokens.css ↔ CSS_VAR_NAMES
pnpm --filter @tentacle-tv/tv-webos build    # le client LG compile apps/web : garde de compatibilité CSS
node apps/web/bench/socle/capture.mjs <dossier>   # (depuis apps/web) le labo, capturé en sombre et en clair
```

Le labo : `/dev/socle` dans un paquet de développement (`?vue=jetons|boutons|controles|calques`), absent des paquets
livrés et du client LG. On y pose un contrôle nouveau AVANT de le propager.

## 9. Ce que le socle a mesuré, et ce qu'il n'a pas touché

- **Poids du build web** (JS, octets) : 6 734 053 avec lucide → 6 906 079 avec Phosphor (+172 Ko, +2,6 % ; compressé
  +60 Ko). Sans la passe qui retire les trois graisses inutiles : +491 Ko. Polices : +130 Ko de fichiers, dont 61 Ko
  demandés par une page en français (Figtree et Bricolage latins).
- **Non mesuré** : GPU et RAM de l'application réelle (la vague « mesure » compare avant / après) ; le rendu sous le
  verre natif de macOS 26 (aucun Mac sur ce poste — seuls les tests de porte le tiennent).
- **Pas touché** : les applications natives. `packages/shared/src/theme` et les palettes de `packages/theme` (mobile),
  `DEFAULT_*_TOKENS` (Apple TV, Android TV) gardent leurs valeurs — seuls les NOMS nouveaux y sont entrés. Le client
  LG, qui compile `apps/web`, porte la nouvelle peau avec la police de la dalle.

## 10. Les écrans (vague 2) — un labo et un banc par axe

Chaque famille d'écrans a été refaite sur le socle par un axe, avec son LABO (`apps/web/src/dev/<axe>Lab/`, monté par
`dev/devLabRoutes.tsx`, absent des paquets livrés et du client LG) et son BANC de capture (`apps/web/bench/<axe>/`,
faux serveur, Chrome sans tête). Aucun serveur n'était joignable pendant le chantier : c'est sur ces labos que tout a
été vu. On y regarde un écran AVANT et APRÈS l'avoir retouché.

| Axe | Labo | Banc (depuis `apps/web`) | Ce qu'il couvre |
|---|---|---|---|
| accueil | `/dev/accueil` | `node bench/accueil/capture.mjs <dossier>` (+ `return.mjs`) | barre du haut, bannière, rangées, cartes, avis, palette de recherche, menus |
| fiches | `/dev/fiches/*` | `node bench/fiches/capture.mjs <dossier>` | bibliothèques et filtres, fiche, recherche, personne, Ma liste, Mes favoris |
| hors ligne | `/dev/hors-ligne/*` | `node bench/hors-ligne/capture.mjs <dossier>` | feuille, boutons, lot de la file, « Sur cet appareil », fiches locales |
| lecteur | `/dev/lecteur` | `pnpm --filter @tentacle-tv/web bench:lecteur <dossier>`, `bench:update-lock` | habillage, encarts, PiP, mise à jour, Watch Together, nouveautés |
| réglages | `/dev/reglages` | `node bench/reglages/capture.mjs <dossier>` | réglages, administration, connexion, « Qui regarde ? », assistant, aide |
| Octave | `/dev/octave` | `node bench/octave/capture.mjs` | coquille, vues, file, lecteur du bas, plein écran |

Ce que l'intégration a recousu entre les axes, et qu'un écran nouveau doit respecter :

- **Le focus clavier ne change pas la forme d'un contrôle** : le rayon de `:focus-visible` (base) est en `:where`, un
  `.field` porte son seul anneau (son ombre).
- **La teinte franche posée sur une image** est constante entre les thèmes et n'a qu'une source :
  `components/cards/onMedia.ts` (en attendant un jeton `--on-media-accent`). Jamais `--accent` ni `--cta-primary-*`
  sur une image : ils s'inversent en thème clair.
- **Une bannière jumelle suit l'originale** : `downloads/home/OfflineBillboard*` reprend l'ancrage et les gestes de
  `components/hero/HeroBillboard` — les deux se retouchent ensemble.
- **Toute lecture se met en pause sous le verrou de mise à jour** (`useUpdateLockPause`) : les deux lecteurs vidéo
  et Octave. Un lecteur nouveau le monte.
- **Un groupe de réglages posé dans une page de Tentacle** passe par `components/settings/SettingsCard`, pas par
  `SettingsSection` (Octave compris).

Restes connus à l'intégration : `App.tsx` dépasse encore 300 lignes ; sous le verre natif (macOS 26), les feuilles
`lgPageButtons.css` et `lgSurfaceAdhoc.css` visent des utilitaires que `.btn` remplace — rendu jamais vu sur un Mac ;
le jumeau de Vigie (`PosterHover.tsx`, dépôt Tentacle-Plugin-Seer) n'a pas reçu la nouvelle peau du plateau ; le
client LG garde l'ancien libellé de « Appliquer à cette série » ; le mobile et la TV envoient encore saison puis série
à `/resolve`.
