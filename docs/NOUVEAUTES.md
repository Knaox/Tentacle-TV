# Écran de nouveautés — comment une version se raconte

Écrit le 05.09.2026, avec la 1.21.0 — la première version desktop qui embarque l'écran.
Ce document dit où vit le contenu, comment on ajoute une version, ce qu'une scène a le
droit de faire, et la règle qui va avec : **à chaque bump desktop, l'écran de nouveautés
se met à jour** — une entrée vide est acceptée, une entrée absente casse les tests.

## Deux objets, pas un

- **La pop-up de mise à jour** (`apps/web/src/components/UpdateModal.tsx` +
  `components/update/`) parle de la version SUIVANTE, avant d'installer, à partir des notes
  du manifeste `updates/store-versions.json` (texte brut `• …`, une puce par ligne, aplati par
  la CI depuis `changelogs/desktop.md`). Elle parse ce format côté client
  (`updateNotes.ts` : un intitulé suivi de « : » passe en gras) ; les scripts CI ne bougent pas.
- **L'écran de nouveautés** (`apps/web/src/whatsNew/`) parle de la version qu'on VIENT de
  recevoir, à la première ouverture après une mise à jour. Son contenu est dans le bundle :
  des scènes React + Framer Motion écrites avec un kit de faux composants — pas de gif, pas
  d'enregistrement d'écran. Desktop uniquement, une fois par version, à revoir depuis
  « À propos ».

## Où ça vit

```
apps/web/src/whatsNew/
  types.ts                 WhatsNewRelease, WhatsNewFeature, SceneProps { active, reduced }
  releases/index.ts        WHATS_NEW_RELEASES, du plus récent au plus ancien ; findRelease()
  releases/v1_21_0.tsx     une release = une version + ses nouveautés
  releases/registry.test.ts  le garde-fou (voir plus bas)
  scenes/                  le KIT : SceneStage, Place, FauxCard, FauxRow, FauxChip,
                           FauxToggle, FauxStars, FauxCursor, FauxConfetti,
                           ScenePlayerPanel, useSceneClock
  scenes/v1_21_0/          les scènes de la 1.21.0
  sceneMedia.ts            les VRAIES données des scènes (affiches, fond, plateformes)
  selectFeatures.ts        la sélection pure entre version vue et version courante
  whatsNewStorage.ts       tentacle_whats_new_seen (par appareil)
  useWhatsNewGate.ts       la porte : quand montrer, quand noter
  WhatsNewScreen.tsx       la modale (Modal + ModalHeader), liste, scène, pied
  whatsNewDev.ts           crochets de développement
packages/shared/src/i18n/locales/{fr,en}/whatsNew.ts   les textes
apps/web/src/components/StartupOverlays.tsx           l'orchestration avec la pop-up
```

## Ajouter une version — la liste

1. **`releases/vX_Y_Z.tsx`** : exporter `RELEASE_X_Y_Z: WhatsNewRelease` avec `version: "X.Y.Z"`
   (la valeur exacte de `versions.json → desktop`) et ses `features`. Rien à montrer ?
   `features: []` — l'entrée dit « rien », elle ne laisse pas supposer « oublié ».
2. **`releases/index.ts`** : l'ajouter EN TÊTE de `WHATS_NEW_RELEASES` (ordre décroissant, vérifié).
3. **Une nouveauté** = `{ id, kind, titleKey, bodyKey, Scene, route? }`. `id` unique dans la
   release, sans suffixe `_one`/`_other` (i18next y lirait un pluriel). `kind` :
   `new` / `improved` / `fixed`. `route` : un chemin ABSOLU de l'app (`/recommendations`,
   `/settings/personalization`…) — jamais une route admin. Six à huit nouveautés qui se
   MONTRENT ; le plafond de l'écran est de douze, toutes releases confondues.
4. **Les textes** dans `locales/{fr,en}/whatsNew.ts` : `vX_Y_Z_<id>_title` (40 caractères
   max) et `vX_Y_Z_<id>_body` (une à deux phrases), écrits pour l'écran, pas copiés du
   changelog. Clés plates, sans point. `titleKey`/`bodyKey` portent la clé NUE, l'écran préfixe.
5. **Les scènes** dans `scenes/vX_Y_Z/`, une par nouveauté, avec le kit (voir le contrat).
6. **Le changelog** : la nouveauté de l'écran lui-même s'annonce dans la version qui la livre
   (bloc `## [X.Y.Z]` de `changelogs/desktop.md`, FR et EN).
7. **`pnpm --filter @tentacle-tv/web test`** : `registry.test.ts` vérifie que
   `versions.json → desktop` a son entrée, que les versions sont uniques et triées, les ids
   uniques, les routes absolues, et que chaque clé de texte existe en FR ET en EN.
8. **Revoir** : F9 → N, ou `__tentacleShowWhatsNew("X.Y.Z")` dans la console.

## De vraies valeurs, pas des dessins

Une scène doit ressembler à l'app : les « faux » composants du kit n'ont de faux que
l'interaction. `FauxCard` est la pile réelle de l'accueil (`CardFrame`, `CardImage`, badge de
note, barre de progression, bloc titre de `PosterCard`), `FauxStars` est `StarRating`,
`FauxToggle` est `ToggleSwitch`, et les scènes réutilisent le balisage réel là où il n'y a pas
de composant présentationnel (menu Filtres, éditeur de rangées, sélecteur de qualité,
`TicketCard` avec un ticket fabriqué, `MetaChip`, `PlatformLogo`).

Les données viennent de `sceneMedia.ts` : `useSceneMediaSource()` (appelé dans le corps de
l'écran, monté seulement ouvert) combine les requêtes que l'accueil a DÉJÀ faites — sélection
du bandeau, reprises, déjà vus — et l'annuaire des plateformes, avec la même recette d'URL que
les cartes réelles (`height: 450, quality: 90`) : les affiches sont en cache, rien de neuf n'est
demandé. Le contexte `SceneMediaContext` les sert aux scènes (`useSceneMedia()`,
`posterAt(media, i)`). Sans donnée (test, crochet avant la session), le kit retombe sur des
dégradés de jetons — jamais une image inventée.

## Écrire une scène — le contrat du kit

Une scène est un **storyboard à pas** : une horloge donne l'index du pas courant, et chaque
faux composant rend l'état de ce pas. C'est le changement de pas qui anime.

```tsx
const STEPS = [800, 900, 700, 1700] as const;   // ms par pas, CONSTANTE de module

export function MaScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const hover = step >= 1;
  return (
    <SceneStage cycle={cycle}>
      <FauxRow x={32} y={30} title={t("reco:rowForYou")} count={5} cardW={80} highlight={hover ? 1 : undefined} />
      <FauxChip x={131} y={92} label={t("common:play")} icon="play" variant="primary" visible={hover} dy={hover ? 0 : 6} />
      <FauxCursor x={hover ? 172 : 540} y={hover ? 118 : 320} pressed={step === 2} reduced={reduced} />
    </SceneStage>
  );
}
```

- **Le canevas est logique : 640 × 360 px.** `SceneStage` le met à l'échelle en `transform`
  selon la largeur réelle. Les coordonnées (`x`, `y`, `w`, `h`) sont statiques ; les seules
  valeurs animées sont `visible`, `dx`, `dy`, `scale` (transform + opacité — la règle GPU du
  dépôt). Jamais de `left`/`top`/`width` animés.
- **`initial={false}` partout.** Un composant du kit ne joue pas d'entrée ; il rend l'état du
  pas. Corollaire : sous mouvement réduit, l'horloge est clouée sur le dernier pas et rien ne
  transitionne jamais — l'image finale, fixe, sans que la scène ait à s'en occuper. Seuls
  `FauxCursor` (anneau de clic) et `FauxConfetti` (jet de 650 ms en dur) reçoivent `reduced`.
- **Aucune boucle infinie.** La boucle, c'est l'horloge : au dernier pas, `cycle` s'incrémente
  et le canevas se remonte derrière un fondu court. Pas de `repeat: Infinity`, pas de
  `@keyframes` qui tourne.
- **`active` à faux = pause.** L'écran monte la SEULE scène courante et lui passe
  `active = cadre visible && onglet au premier plan` (`useInViewport`). L'horloge se gèle sur
  le pas courant, elle repart de là.
- **Trois à six secondes par boucle**, quatre pas en général, 600 à 1 800 ms par pas.
- **Le vrai vocabulaire** : les libellés viennent des clés i18n de l'app (`reco:rowForYou`,
  `tickets:open`, `player:qualityAutoBadge`…). Un mot que l'app n'a pas prend une clé `scene*`
  dans l'espace `whatsNew`. Le cadre est `aria-hidden` : le sens est porté par le titre et le
  texte à côté, jamais par la scène.
- **Aucun `backdrop-filter`, aucune couleur en dur** hors ce qui est une image (voile d'une
  affiche, fond du lecteur, curseur système). Les teintes de repli sont des dégradés de jetons
  (`CARD_TONES`). Et la modale elle-même n'en pose plus sur son panneau : mesuré sur l'écran
  de nouveautés (Chrome 152, 3808×1971, 240 Hz), la réfraction Liquid Glass du panneau faisait
  tomber la cadence de 240 à 98 i/s dès que le contenu bougeait — invisible sous un fond à
  0,96 d'alpha, elle a été retirée de `Modal`. Le flou du scrim, lui, coûte ~5 %.
- **120 lignes par scène**, comme partout.

## La porte — quand l'écran s'impose

- Desktop seulement (`isDesktopApp()`), version par `getVersion()` (vraie version du bundle,
  repli `__APP_VERSION_DESKTOP__`).
- Dès le montage : **aucune version vue = première installation** — on enregistre la version
  courante, on ne montre rien. Un utilisateur qui vient d'une version SANS l'écran
  (1.20.x → 1.21.0) est dans ce cas : il ne verra les nouveautés qu'en les rouvrant depuis
  « À propos ». C'est la règle retenue ; la changer tient en une ligne dans `useWhatsNewGate`.
- Puis, quand les conditions sont réunies — session ouverte, disclaimer accepté, pas sur
  `/watch`, pop-up de mise à jour au repos —, UNE décision : version courante plus récente que
  la vue ET des nouveautés dans `]vue, courante]` → l'écran, toutes les nouveautés depuis la
  version vue, plus récentes d'abord, douze au plus. Intervalle vide → on note la version
  courante tout de suite. Égale ou rétrogradée → rien, et rien d'écrit.
- **Fermer = marquer vu**, quel que soit le geste : croix, Esc, scrim, « Terminé », lien profond.
- **Un seul recouvrement de démarrage.** `StartupOverlays` rend l'écran puis la pop-up avec
  `suspended` : `available` est un état du hook, la pop-up paraît à la fermeture de l'écran.
  L'inverse aussi : pendant un téléchargement ou une installation, l'écran attend.
- **« Revoir les nouveautés »** (À propos, desktop) et les crochets rouvrent la release
  courante sans toucher au drapeau `tentacle_whats_new_seen`.

## Crochets de développement

Tous sous `updateDebugEnabled()` (`import.meta.env.DEV || __PLAYER_DEBUG__`), qui couvre Vite
ET `pnpm dev:electron` (build web avec `TENTACLE_DEBUG=1`) ; rien n'en reste dans un build livré.

| Geste | Effet |
|-------|-------|
| F9 → **U** | pop-up de mise à jour de démonstration (le bouton agit pour de vrai) |
| `__tentacleSimulateUpdate({ phase: "downloading", downloading: true, progress: 42 })` | même pop-up, état forcé — `indeterminate: true`, `phase: "installing"`, `error: "…"`… |
| F9 → **N** | écran de nouveautés, TOUT le registre, sans plafond, sans écrire le drapeau |
| `__tentacleShowWhatsNew("1.21.0")` | une release précise |
| `?whatsnewgate=1` | dans la préviz navigateur, la porte et le bouton « Revoir » se comportent comme sur desktop |
| `?reducedmotion=1` | `matchMedia` prétend le mouvement réduit, AVANT React — voie JavaScript seulement, les `@media` CSS lisent le vrai réglage |

Recette de vérification de la porte dans la préviz : `?whatsnewgate=1`, poser
`localStorage.tentacle_whats_new_seen = "1.20.11"`, recharger → l'écran ; fermer → la clé vaut
la version courante ; recharger → rien ; « Revoir les nouveautés » → l'écran, clé inchangée.

## La règle

**Chaque bump desktop met à jour l'écran de nouveautés.** Même quand il n'y a rien à montrer :
on ajoute l'entrée vide, en connaissance de cause. Le test du registre est le garde-fou — il
casse dès que `versions.json → desktop` n'a pas son entrée. Une nouveauté s'annonce dans la
version qui la livre ; un correctif interne à une version jamais publiée ne s'écrit pas.
