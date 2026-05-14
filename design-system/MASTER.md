# Tentacle TV — Design System MASTER

> **Source unique de vérité** pour le langage visuel sur les 3 plateformes :
> `apps/mobile` (React Native), `apps/web` desktop (≥ 768px), `apps/web` mobile (< 768px).
> Tokens cross-platform centralisés dans `packages/shared/src/theme/*`.

---

## 🎨 Tokens (Foundations)

### Colors
- **Surfaces** : `s0: #000000` page / `s1: #0a0a0a` cards / `s2: #141414` hover/modal / `s3: #1f1f1f` elevated
- **Brand** : `violet: #8B5CF6` / `light: #A78BFA` / `dark: #7C3AED` / `soft: rgba(139,92,246,0.15)` / `ghost: rgba(139,92,246,0.18)` / `glow: rgba(139,92,246,0.35)`
- **Texte** : `primary: #FFF` / `secondary: 0.78` / `tertiary: 0.55` / `quaternary: 0.34` / `disabled: 0.22`
- **Status** : `success: #10b981` / `warning: #f59e0b` / `error: #ef4444` / `info: #3b82f6` / `rating: #fbbf24`
- **CTA Netflix** : `primaryBg: #FFF / primaryFg: #000` / `secondaryBg: rgba(109,109,110,0.55) / secondaryFg: #FFF` / `ghostBg: rgba(255,255,255,0.08)`
- **Borders** : `subtle: rgba(255,255,255,0.08)` / `strong: rgba(255,255,255,0.16)` / `focus: BRAND.violet`

### Typography (Inter)
| Preset | Size | Weight | Letter-spacing |
|---|---|---|---|
| display-1 | 56 | 800 | -0.5 |
| display-2 | 44 | 700 | -0.5 |
| display-3 | 32 | 700 | -0.4 |
| heading-1 | 24 | 600 | -0.4 |
| heading-2 | 20 | 600 | -0.4 |
| heading-3 | 18 | 600 | -0.4 |
| body | 15 | 400 | -0.075 |
| caption | 13 | 400 | -0.075 |
| small | 11 | 600 | 0 |
| badge | 10 | 700 | 0.3 |

### Spacing (4pt base)
`xs:4 / sm:8 / md:12 / lg:16 / xl:20 / 2xl:24 / 3xl:32 / 4xl:40 / 5xl:48 / 6xl:64`

### Radius
`xs:4 / sm:6 / md:8 / lg:12 / xl:16 / 2xl:20 / pill:9999`

### Shadows (elevation scale)
- `elev1` : offset 0,1 / opacity 0.18 / radius 2
- `elev2` : offset 0,4 / opacity 0.22 / radius 6
- `elev3` : offset 0,8 / opacity 0.28 / radius 12
- `cardHover` : offset 0,12 / opacity 0.4 / radius 24
- `sheet` : offset 0,-8 / opacity 0.45 / radius 24

### Motion
- **Durations** : instant:80 / fast:150 / base:240 / slow:400 / page:600 / hero:800 (ms)
- **Easings** : `out: [0.22, 1, 0.36, 1]` / `inOut: [0.65, 0, 0.35, 1]` / `sheet: [0.32, 0.72, 0, 1]`
- **Springs** : gentle (damp 20, stiff 200) / snappy (damp 18, stiff 280) / bouncy (damp 12, stiff 200)
- **Cascade** : delays 100/200/300/400ms entre éléments
- **Stagger** : 30-80ms par item dans grilles/lists

### Layout
- screenPadding : `16`
- tabBarHeight : `64`
- topnavMobile : `56`
- topnavDesktop : `68`
- INPUT_HEIGHT : `44`
- CTA_HEIGHT : `52` (lg) / `44` (md) / `36` (sm)

---

## 🧩 Composants signature (contrat de symétrie)

Pour chaque composant : visuel **identique**, comportement **équivalent**, implémenté sur les 3 plateformes.

### CTAButton (`Lecture` / `Plus d'infos`)
- **Primary** (Lecture) : bg blanc + text noir + `boxShadow: 0 8px 22px rgba(139,92,246,0.55)` (halo violet signature) + icône `play` (filled)
- **Secondary** (Plus d'infos) : bg `rgba(139,92,246,0.18)` + border `rgba(139,92,246,0.4)` + text blanc + icône `info` outline
- Height : 52 (hero/detail) / 44 (inline)
- Radius : 8 (md)
- Letter-spacing : 0.1
- Font : Inter bold 16

### MediaCard (poster 2:3)
- Aspect : 2/3
- Radius : 12 (lg)
- Background : `s2` fallback avec lettre initiale ExtraBold opacity 0.18
- Shadow : `elev2`
- Watched indicator : rond glass 22×22, top-right, `bg: rgba(0,0,0,0.72)`, border `rgba(255,255,255,0.18)`, icône `check` blanche
- Progress bar : bottom 3px violet `BRAND.violet`, fond 16% blanc
- Press : scale 0.97 spring
- Hover (web) : scale 1.05 + shadow elev3

### Hero Billboard
- Hauteur : 82% screen (mobile) / 92vh (desktop)
- Backdrop : crossfade 900ms ease-out entre slides
- Triple gradient : top scrim 120px / bottom strong 62% / left scrim
- Logo image si dispo, sinon titre display ExtraBold
- Mini-tag "▶ CONTINUER" : uppercase, bg `rgba(255,255,255,0.92)`, text `#000`, letterSpacing 1.6
- CTAs : Lecture (primary) + Plus d'infos (secondary)
- Dots indicateurs slim : actif 22×3 violet glow / inactif 6×3 white/32

### Action System (DetailActionButton + MediaActionSheet)

**Règle R1 — Discipline d'icônes** :
| Action | Icône inactive | Icône active | Couleur active |
|---|---|---|---|
| Favoris | `heart` outline | `heart` filled | `STATUS.error` (#ef4444) |
| Ma liste | `plus` | `check` | `BRAND.violet` |
| Partager | `users` | `users` | `BRAND.violet` |
| Vu | `check-circle` | `check-circle` filled | `BRAND.violet` |

**Règle R2 — Labels courts** (≤ 2 mots, jamais wrap) :
- `actionFavorite` : "Favoris" (toggle via couleur, pas via label)
- `actionMyList` : "Ma liste"
- `actionShare` : "Partager"
- `actionWatched` : "Vu"

**Règle R3 — Grille 4 colonnes égales** :
- `width: 25%` par cellule
- Hauteur fixe `84pt` (ring 52pt + gap 8pt + label 1 ligne)
- Label `numberOfLines={1}`
- Ring 52×52 (mobile) ou 48×48 (desktop), `borderWidth: 1`
- Active : ring `bg: {color}22`, border `{color}55`, icône `{color}`, label `{color}`
- Inactive : ring `bg: rgba(255,255,255,0.06)`, border `BORDER.subtle`, icône `rgba(255,255,255,0.85)`, label `rgba(255,255,255,0.62)`

### Buttons (génériques)

**Variants** :
- `primary` : bg `CTA.primaryBg` (#FFF) / fg `CTA.primaryFg` (#000) + halo violet
- `secondary` : bg `CTA.secondaryBg` (gray translucide) / fg blanc
- `brand` : bg `BRAND.ghost` (violet 18%) / border `BRAND.violet 40%` / fg blanc
- `ghost` : transparent / hover bg `CTA.ghostBg`
- `danger` : bg `STATUS.error` soft 15% / border soft 30% / fg `STATUS.error`

**Heights** : sm 36 / md 44 / lg 52
**Radius** : 8 (md)
**Font** : Inter semibold

### Inputs
- Height : 44
- Background : `rgba(255,255,255,0.06)`
- Border : `BORDER.subtle` 1px
- Radius : 8 (md)
- Focus : ring `BRAND.violet` 2px
- Font : Inter regular 15
- Placeholder : `rgba(255,255,255,0.35)`

### BottomSheet / Sheet
- Drag handle : 36×4 `rgba(255,255,255,0.28)`
- Backdrop : `rgba(0,0,0,0.55)` + BlurView 28 (mobile) / backdrop-blur-lg (web)
- Sheet bg : `SURFACE.s1`
- Top radius : 20 (2xl)
- Shadow : `sheet`
- Animation : spring damping 22, stiffness 240
- Snap points : 50% / 100% par défaut

### Chips / Pills (filter, tabs)
- Height : 32
- Padding : `12px` horizontal
- Radius : 16 (pill border-radius)
- Inactive : bg `rgba(255,255,255,0.05)` + border `BORDER.subtle` + text `rgba(255,255,255,0.78)`
- Active : bg `rgba(139,92,246,0.15)` + border `rgba(139,92,246,0.45)` + text `BRAND.light`
- Selected primary (tab) : bg `BRAND.violet` + text white

### Badge
| Variant | Bg | Fg |
|---|---|---|
| success | rgba(16,185,129,0.15) | #34D399 |
| warning | rgba(245,158,11,0.15) | #FBBF24 |
| error | rgba(239,68,68,0.15) | #F87171 |
| info | rgba(59,130,246,0.15) | #60A5FA |
| brand | BRAND.soft | BRAND.light |
| gold | rgba(251,191,36,0.18) | STATUS.rating |
| muted | rgba(255,255,255,0.08) | rgba(255,255,255,0.62) |
- Size : `sm` (fs 9, py 3) / `md` (fs 10, py 3.5)
- Radius : 4 (xs)
- Uppercase tracked : letterSpacing 0.3

### Skip Intro / Next Episode (Player overlay)
- Position : bottom-right, `right: spacing.lg` + safe-area-right
- Bottom : `safe-area-bottom + 96pt` (au-dessus des controls)
- Style : pill rectangulaire, `bg: rgba(0,0,0,0.65) + BlurView 24`, border `BORDER.strong`, radius 8
- Padding : 12 × 18
- Label : Inter semibold 14 + icône `skip-forward` / `chevron-right` à droite
- Animation : fadeIn 240ms + slideUp 24pt depuis détection segment
- Touch target ≥44pt (label + icone)

---

## 🎭 Patterns d'interaction

### Long-press card (mobile) / Right-click (desktop)
→ `MediaActionSheet` grille 2×2 d'icônes ronds (pattern Apple TV)
- Mobile : long-press 500ms + haptic medium
- Desktop : contextmenu event
- Web mobile : long-press via use-long-press lib + haptic via `navigator.vibrate(10)`

### Press feedback
- Scale 0.97 spring (damping 18, stiffness 280)
- Haptic light sur tous les cards / boutons
- Duration ≤100ms pour le retour visuel

### Cascade entry (Detail / Home)
- Stagger 120/220/320/440ms entre poster/title/meta/actions/content
- Easing : ease-out cubic
- Reanimated mobile / Framer Motion web

### Pull-to-refresh
- Mobile native : `RefreshControl tintColor={BRAND.violet}`
- Web : implementé via `usePullToRefresh` hook (optionnel)

### Parallax backdrop
- Translate Y interpolated `[0, BACKDROP_H]` → `[0, -BACKDROP_H * 0.45]`
- Scale on pull `[-BACKDROP_H, 0]` → `[1.4, 1]`
- Mobile : `useAnimatedScrollHandler` / Web : `useScroll + useTransform`

---

## 📐 Règles globales (R1-R10)

- **R1 — Icon discipline** : 1 seul icon set par plateforme (Feather mobile, Lucide web). Mapping symétrique nom-pour-nom. Filled = état actif.
- **R2 — Labels courts** : actions ≤ 2 mots. Toggle d'état via couleur/icône, jamais via label "Retirer de…".
- **R3 — Grille fixe** : touch zones uniformes, jamais de wrap inattendu.
- **R4 — Truncation conditionnelle** : "Voir plus" affiché uniquement si texte tronqué (détection via `onTextLayout`).
- **R5 — 1 action par niveau hiérarchique** : "Vu" sur série / saison / épisode = 3 boutons distincts mais sans doublon dans le même viewport.
- **R6 — Cohérence pills** : tabs et boutons toggle utilisent la même grammaire (filled active / outline inactive avec mêmes radius et hauteurs).
- **R7 — Tokens-only** : aucune valeur hex hardcodée dans les screens, tout passe par `@/theme` ou `var(--*)`.
- **R8 — Touch ≥44pt** : ring 52pt visuel + hitSlop si nécessaire. Web : `min-h-11 min-w-11` ou padding interne.
- **R9 — Animations 150-300ms** : ≤ 400ms pour transitions complexes. Easing ease-out cubic ou spring damping naturel.
- **R10 — Tokens partagés** : tout token utilisé par 2 plateformes vit dans `packages/shared/src/theme/*`. Web sync via `tokens.css` (manuellement aligné).

---

## 🗺️ Mapping pages cross-platform

| Page | Mobile | Desktop | Web mobile (mirror) |
|---|---|---|---|
| Home | `HomeScreen` | `Home.tsx` | _idem desktop_ (à terme : MobileHome mirror) |
| Detail | `MediaDetailScreen` | `MediaDetail.tsx` | _idem desktop_ |
| Library list | `LibrariesScreen` | (intégré sidebar) | _idem desktop_ |
| Library catalog | `LibraryCatalogScreen` | `Library.tsx` | _idem desktop_ |
| Watchlist | `WatchlistScreen` | `Watchlist.tsx` | _idem desktop_ |
| Favorites | `FavoritesScreen` | `Favorites.tsx` | _idem desktop_ |
| Search | `SearchScreen` | `SearchOverlay` | _idem desktop_ |
| Profile/Settings | `ProfileScreen` | `Preferences.tsx` | `MobileProfile.tsx` ✅ |
| Admin | _via Profile_ | `Admin.tsx` | _idem desktop_ |
| Player | `PlayerScreen` | `VideoPlayer/DesktopPlayer` | _idem desktop_ |
| Auth | 5 screens | 5 pages | _idem desktop_ |
| Pair TV | `PairTVScreen` | `PairDevice.tsx` | _idem desktop_ |
| Support/About | 3 screens | 3 pages | _idem desktop_ |

---

## 🚦 Phases de mise en cohérence

- **Phase A** : Foundations + MASTER.md ✅ (ce document)
- **Phase B** : Primitives `packages/ui/*` refondues pour matcher mobile (Button, MediaCard, GlassCard, Badge, Input, Shimmer)
- **Phase C** : Composants signature symétriques (Hero, Action system, Sheet, Skip Intro/Next Episode)
- **Phase D** : Pages alignées (Home, Detail, Library, Watchlist, Search, Profile, Admin, Player, Auth) — fixes ciblés cohérence
- **Phase E** : Web mobile mirror (optionnel — clone visuel app mobile native sur web < 768px)
- **Phase F** : Validation cross-platform (screenshots comparatifs)
