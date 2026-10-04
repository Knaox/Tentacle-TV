# Navigation TV — télécommande, focus, Retour : une seule source

L'Apple TV refaite (`apps/tv`, chemin « redesign ») est la **source de vérité**
de la navigation : focus, voisins, entrées, Retour, appui maintenu, raccourcis,
lecteur, panneaux. Tout ce qui DÉCIDE quitte le code tvOS pour un seul endroit
commun, `packages/tv-core`, que toutes les plateformes lisent. Android TV recevra
plus tard une table de traduction de sa télécommande et un petit adaptateur —
sans recoder un seul comportement.

Ce document est l'index. Il fixe l'architecture, le contrat (chemins et API
exacts), la règle de rangement et la place de l'adaptateur tvOS ; chaque
domaine documente sa partie dans `docs/tv-navigation/<domaine>.md`.

## Les trois couches

```
 Siri Remote, Menu, pavé tactile
        │  (événements natifs)
        ▼
 ADAPTATEUR tvOS — apps/tv/src/platform/tvos/            ← lit, puis applique
        │  readTvosEvent → RemoteSignal
        ▼
 2. TABLE DE TRADUCTION — tv-core remote/bindings/tvos.ts ← données
        │  signal → intention (IntentEvent)
        ▼
 1. INTENTIONS — tv-core remote/intents.ts               ← le vocabulaire
        │  observateurs (voir passer) puis pile des contextes
        ▼
 3. COMPORTEMENTS — tv-core focus/ nav/ player/ cards/ … ← décident (purs)
        │  décision (des données)
        ▼
 ADAPTATEUR tvOS : guides de focus, préférences, sections natives,
 MenuPressInterceptor, navigation — il APPLIQUE, il ne décide pas
```

1. **Intentions** — ce que veut l'utilisateur, sans rien de matériel : aller
   vers, valider, maintenir, revenir, lecture/pause, glisser.
2. **Tables de traduction** — de simples données, une par plateforme : tel
   signal natif porte telle intention. Ce soir, seule tvOS est écrite.
3. **Comportements** — dans chaque contexte, ce que produit une intention.
   Modules purs (ni React ni React Native), testés par vitest, rangés dans les
   dossiers de domaine de tv-core. L'adaptateur tvOS ne fait qu'APPLIQUER leurs
   décisions avec les outils natifs. On ne remplace pas le moteur de focus
   géométrique de tvOS : on en extrait les décisions.

## Le contrat — `packages/tv-core/src/remote/`

Tout s'importe de `@tentacle-tv/tv-core` (ou `@tentacle-tv/tv-core/remote`).

| Fichier | Exporte | Rôle |
|---|---|---|
| `intents.ts` | `RemoteIntent`, `MoveIntent`, `SelectIntent`, `BackIntent`, `TransportIntent`, `PlayPauseIntent`, `HoldIntent`, `SwipeIntent`, `DragIntent`, `PageIntent`, `RemoteIntentType`, `IntentOf<T>`, `HoldKey`, `HoldPhase`, `DragPhase`, `PageDirection`, `REMOTE_INTENT_TYPES`, `HOLD_KEYS`, `isBaseIntent`, `directionOf`, `holdDirection` ; réexporte `Direction`, `Intent`, `TransportCommand`, `isHorizontal`, `directionSign` | le vocabulaire |
| `signals.ts` | `RemoteSignal`, `SignalPhase` (`down` · `change` · `up`), `SignalMotion`, `IntentEvent` | le signal natif lu, l'intention datée |
| `bindings/types.ts` | `RemoteBindings`, `PressBinding`, `HoldBinding`, `SwipeBinding`, `DragBinding`, `NoiseBinding`, `SystemControl`, `RemoteTraits`, `PressIntent`, `boundSignals` | le format d'une table |
| `bindings/tvos.ts` | `TVOS_BINDINGS`, `readTvosEvent`, `TvosNativeEvent`, `TVOS_KEY_ACTIONS`, `TVOS_TOUCH_STATES` | la Siri Remote |
| `translate.ts` | `createTranslator`, `Translator`, `holdPhaseOf`, `dragPhaseOf` | signal → intention |
| `contexts.ts` | `createRemoteContexts`, `RemoteContexts`, `RemoteContextKind`, `REMOTE_CONTEXT_ORDER`, `RemoteBehavior`, `RemoteContextSpec`, `RemoteContextHandle`, `Resolution` | intention → comportement, selon le contexte |
| `input.ts` | `createRemoteInput`, `RemoteInput` | l'entrée unique d'une plateforme |

### Le vocabulaire

| Intention | Sens | Siri Remote (tvOS) |
|---|---|---|
| `{ type: "move", direction }` | aller d'un pas (`haut` · `bas` · `gauche` · `droite`) | bord du pavé cliqué, flèche du clavier |
| `{ type: "select" }` | valider | clic au centre du pavé |
| `{ type: "retour" }` | revenir | Menu (Retour) |
| `{ type: "transport", command }` | touche média dédiée | — (LG, Android TV) |
| `{ type: "playPause" }` | la bascule Lecture/Pause — son sens dépend du contexte | Lecture/Pause |
| `{ type: "hold", key, phase }` | maintenir OK, Lecture/Pause ou une direction : `start` · `update` · `end` | appui maintenu (0,5 s) |
| `{ type: "swipe", direction }` | glisser rapide vers un côté | glisser sur le pavé |
| `{ type: "drag", phase, x, y, vx, vy }` | le doigt sur le pavé : `start` (le simple TOUCHER) · `move` · `end` | pan, tant qu'un écran le tient |
| `{ type: "page", direction }` | page vers le haut ou le bas | Page ↑ / ↓ (clavier) |

Les valeurs d'origine (`"haut"`, `"retour"`, `"lecture"`…) ne changent pas : la
LG les lit dans `input/keys.ts`, que `remote/` réexporte sans y toucher. Toute
`Intent` d'origine est une `RemoteIntent` (vérifié par le typage). Ce que la
télécommande a mais que l'app ne reçoit jamais (bouton TV, Menu maintenu, Siri,
volume, anneau du pavé) est listé dans `TVOS_BINDINGS.system`.

### Voir passer, ou prendre

`createRemoteInput(bindings)` est l'entrée unique : l'adaptateur lui donne
chaque signal (`receive`), une fois, et elle les fait passer dans cet ordre :

1. `observeSignals` — le signal brut (diagnostic) ;
2. la table le traduit ; pas d'intention : on s'arrête ;
3. `observe` — chaque intention, sans la prendre : réveiller un habillage,
   relancer une attente. Les observateurs voient l'état d'AU MOMENT du geste ;
4. `contexts.dispatch` — la pile la résout : UN contexte la prend.

`onDemand` dit à l'adaptateur quand s'abonner au natif (premier écouteur) et
quand s'en défaire (dernier parti).

### La pile des contextes

```
clavier > panneau > lecteur > écran      (REMOTE_CONTEXT_ORDER)
```

On consulte les contextes ACTIFS dans cet ordre ; à rang égal, le plus
récemment activé passe devant (la règle de `nav/backLayers.ts`). Le premier
dont `decide` rend une décision prend l'intention ; `null` la laisse passer au
suivant ; personne : le défaut de la plateforme (moteur de focus natif, UIKit).

```ts
const handle = input.contexts.register({
  kind: "panel",
  name: "seasonsSheet",
  decide: (intent) => (intent.type === "playPause" ? { submit: true } : null), // PUR
  apply: (decision, event) => submitTicked(),                                   // au geste
});
handle.setActive(isFocused);  // écran d'arrière-plan : inactif
handle.update({ decide, apply }); // fermetures neuves à chaque rendu, sans changer de rang
handle.refresh();             // ses décisions ont changé : les décisions anticipées se relisent
handle.remove();
```

Les TYPES de décision appartiennent aux domaines (`focus/`, `nav/`, `player/`…) :
la pile ne fait que l'aiguillage. Elle est générique sur les rangs
(`createRemoteContexts(["menu", "overlay", "page", "rail"])` suit la même règle).

### Deux temps : décider d'avance, décider au geste

Sur tvOS, deux intentions sont tranchées par le natif AVANT que le JS ne les voie :

- **`move`** — le moteur de focus déplace le focus à l'enfoncement ; l'appui
  n'arrive au JS qu'au relâchement (~60 ms après, mesuré). Un `swipe` est
  annoncé à la fin du glisser, que le focus a déjà suivi ;
- **`retour`** — `MenuPressInterceptor` prend Menu ou le laisse à UIKit dès
  l'enfoncement : il faut savoir AVANT l'appui si quelqu'un le prendra.

D'où la règle : **`decide` est pur**, sans effet. On peut l'appeler sans geste
(`contexts.resolve(intent)`) et poser le résultat comme ÉTAT natif, relu à
chaque `subscribe` : guides de focus, `nextFocus*`, `hasTVPreferredFocus`,
`isTVSelectable`, `MenuPressInterceptor.enabled`. Les autres intentions
(`select`, `playPause`, `hold`, `swipe`, `drag`, `page`) se décident au geste
(`dispatch`).

Un comportement ne suppose jamais ces délais : il lit les faits de la plateforme
dans la table (`TVOS_BINDINGS.traits` : `focusMovesBeforeIntent`,
`pressOnRelease`, `announcedHolds`, `holdThresholdMs`, `backDecidedAhead`,
`touchSurface`, `dragOnDemand`), jamais `Platform.OS`.

### Retour : la pile de chaque écran

`retour` est la seule intention qu'AUCUN contexte de la pile globale ne
décide : l'appui Menu part d'un élément focalisé, donc d'UN écran, et c'est la
pile de couches de cet écran qui le résout (`nav/backLayers`, qui suit la même
règle que `contexts.ts` — `docs/tv-navigation/retour-rail.md`, T4). La portée
du Retour de l'écran pose `MenuPressInterceptor.enabled` d'avance depuis SA
pile ; au relâchement, elle fait passer Menu par l'entrée unique
(`receiveMenu()` : les observateurs voient `retour`), puis applique la
résolution de son écran. Une `Modal` fait de même :
`onRequestClose={withMenuIntent(close)}`. Un contexte global qui déciderait
`retour` doublerait l'action.

## La règle de rangement

- **`remote/`** (T1) ne contient que le vocabulaire, les tables, la traduction
  et la résolution. Aucune règle de comportement.
- **Une règle va dans le dossier de domaine EXISTANT de tv-core** qui en parle :

  | Dossier | Ce qui y va | Tâche du lot |
  |---|---|---|
  | `focus/` | voisins, sections, entrée d'un écran, garde et reprise du focus, « au-delà du bord » | T3, T7 |
  | `nav/` | Retour (`backLayers`), rail, suite de fiches | T4 |
  | `player/` | lecteur : flèches, saut et maintien, avance rapide, glisser, panneaux du lecteur | T5 |
  | `cards/` | cartes : OK maintenu, panneau d'actions, échelle de note | T6 |
  | `input/` | machines d'appui : appui long, verrou d'OK | T1 |

  Un écran (T7) n'a pas de dossier : sa règle rejoint le domaine dont elle
  parle (une entrée → `focus/`, un Retour → `nav/`).
- **Un dossier nouveau seulement si aucun ne convient** (par exemple des
  panneaux qui ne relèvent ni de `cards/` ni de `nav/`) — et son document le
  justifie.
- Partout : module pur (ni React, ni React Native, ni minuteur caché — horloge
  injectable), testé par vitest, 300 lignes au plus, code en anglais,
  commentaires en français. Il lit des `RemoteIntent`, jamais un `eventType` ;
  il lit `RemoteTraits`, jamais `Platform.OS`.

## L'adaptateur tvOS — `apps/tv/src/platform/tvos/`

Il a le droit de contenir :

- **`input/`** (T1) — l'UNIQUE abonnement à `TVEventHandler` du chemin
  refondu, `readTvosEvent` → `receive`, les autres sources natives (Menu du
  `MenuPressInterceptor` et des `Modal`, rendus en signal `menu`), la prise du
  pan (`TVEventControl.enableTVPanGesture`), et les crochets React qui
  observent les intentions ou inscrivent un contexte ;
- **les applicateurs** de chaque domaine : le code qui traduit une décision en
  outil natif — `TVFocusGuideView`, `nextFocus*`, `hasTVPreferredFocus` et
  réclamations, `isTVSelectable`, `MenuPressInterceptor.enabled`, sections
  natives. Un dossier par domaine :

  | Dossier | Tâche |
  |---|---|
  | `platform/tvos/input/` | T1 — l'entrée unique (ci-dessus) |
  | `platform/tvos/focus/` | T3 — focus et rangées |
  | `platform/tvos/back/` | T4 — Retour et rail |
  | `platform/tvos/player/` | T5 — lecteur |
  | `platform/tvos/panels/` | T6 — panneaux et cartes |
  | `platform/tvos/screens/` | T7 — un fichier par écran |

Il n'a PAS le droit de contenir : un seuil, une durée, un « si le focus est sur
telle clé, alors aller là », ni rien dont Android TV aurait aussi besoin. Ce qui
décide va dans tv-core.

Autour de lui, rien ne change de rôle : `redesign/` (les vues) n'importe
toujours ni `TVEventHandler` ni `useTVEventHandler`, ni `BackHandler`, ni
`TVEventControl`, ni `TVFocusGuideView` (lint) ; `redesignWiring/` branche les
écrans (données, composition) et passe par l'adaptateur pour tout ce qui est
natif. Android TV (l'ancienne UI, aiguillée par `redesignGate.ts`) et webOS
(`apps/tv-webos`) ne sont pas touchés par ce lot.

## Porter une autre télécommande (Android TV : posé le 2026-10-05)

Rien à recoder dans les comportements. Deux pièces, et c'est tout :

1. **La table** `packages/tv-core/src/remote/bindings/androidtv.ts` (faite), au
   format `RemoteBindings` : chaque signal natif → son intention. Une
   plateforme qui annonce l'enfoncement ET le relâchement choisit sa phase
   (`on: ["up"]`), sans quoi l'appui compterait deux fois ; la répétition d'une
   touche tenue passe par `RemoteSignal.repeat`. Ses `traits` disent ce qui
   diffère de tvOS (`backDecidedAhead: false`, pas de surface tactile,
   `playPauseKey`…), ses `hints` les mots qui nomment ses touches, et ses
   tests vérifient qu'aucun signal n'est oublié.
2. **L'adaptateur** `apps/tv/src/platform/androidtv/input/` (fait) : un
   abonnement aux événements natifs, une lecture en `RemoteSignal`, et
   `createRemoteInput(ANDROIDTV_BINDINGS)` — le pendant de
   `platform/tvos/input/remoteInput.ts` ; puis les applicateurs de chaque
   domaine avec les outils natifs d'Android (`requestFocus`, `nextFocus*`).

**Le point d'entrée neutre.** Le reste de l'app n'importe pas un adaptateur :
il importe `platform/<domaine>` — `index.ts` (l'Apple TV, la base : tsc le lit,
Metro le prend sur tvOS) et son jumeau `index.android.ts`, aux MÊMES noms.
C'est fait pour la télécommande (`platform/input`) ; chaque domaine porté
suit le même modèle. Les faits de l'appareil qui ne sont pas la télécommande
(Liquid Glass…) : `platform/traits.ts` / `traits.android.ts`. La garde du lint
couvre les fichiers `.android` et autorise `platform/androidtv/` comme
`platform/tvos/`. Contrôle : tsc en `.ios` ET en `.android`
(`moduleSuffixes`).

Les comportements, eux, lisent déjà des intentions et des `traits` : ils
servent tels quels. Détail Android : `tv-navigation/remote.md`.

Le focus d'Android TV (lot « Android TV = Apple TV », A1) : la section native
`com.tentacletv.focus.TentacleFocusSection` (mêmes props que tvOS), les
variantes `.android.ts` de `platform/tvos/focus/` vers
`platform/androidtv/focus/`, et la croix MAINTENUE à la place du glisser —
`input/repeatPacing.ts`, `focus/burstFollow.ts` :
[`tv-navigation/android-focus.md`](tv-navigation/android-focus.md).

## Les documents par domaine

| Document | Domaine | Tâche |
|---|---|---|
| [`tv-navigation/remote.md`](tv-navigation/remote.md) | la télécommande : intentions, table tvOS, entrée unique, relevé des points d'entrée | T1 |
| [`tv-navigation/banc.md`](tv-navigation/banc.md) | le banc de référence (scénarios dorés `apps/tv/harness/nav-golden`) | T2 |
| [`tv-navigation/focus.md`](tv-navigation/focus.md) | focus et rangées | T3 |
| [`tv-navigation/retour-rail.md`](tv-navigation/retour-rail.md) | Retour et rail | T4 |
| [`tv-navigation/lecteur.md`](tv-navigation/lecteur.md) | lecteur | T5 |
| [`tv-navigation/panneaux-cartes.md`](tv-navigation/panneaux-cartes.md) | panneaux et cartes | T6 |
| [`tv-navigation/ecrans.md`](tv-navigation/ecrans.md) | écrans | T7 |
| [`tv-navigation/inventaire.md`](tv-navigation/inventaire.md) | l'inventaire, la garde (lint) et l'audit | T8 |
| [`tv-navigation/android-focus.md`](tv-navigation/android-focus.md) | focus et défilement rapide sur Android TV | A1 |
| [`tv-navigation/android.md`](tv-navigation/android.md) | Android TV refondu : Retour, panneaux, écrans | lot Android, A3 |
