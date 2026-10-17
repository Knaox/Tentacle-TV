# « Pour vous » — ce qui en sort, quand, et ce qui fait le goût

Les recommandations ne proposent que ce que l'utilisateur n'a **pas encore
jugé**, et la page qu'on lit ne bouge pas sous les yeux. Ces règles valent sur
toutes les plateformes, avec le serveur.

Le MOTEUR lui-même (sources, score, rangées, banc) : `docs/RECO-MOTEUR.md`.

## 1. Un titre jugé sort des recommandations

« Jugé » = ajouté à **Ma liste** (ou mis de côté pour elle, carte Vigie),
**aimé** (le cœur), **marqué vu**, ou **noté**. Côté serveur, c'est une
exclusion au service de chaque page (`serveContext` → `accountExclusionKeys`
+ index de bibliothèque en mémoire) :

| Geste | Exclusion servie |
|-------|------------------|
| note, « Ne plus me proposer », like Vigie, verdict d'Affiner, mise de côté (`watchlist_pending`, les deux drapeaux) | base, relue à chaque requête |
| titre DEMANDÉ (extension de demandes), pour le seul compte qui l'a demandé | base (`recommendation_feedback`, action `requested`) — masqué seulement : ni goût, ni ancre, ni statistique (`services/reco/requestedTitles.ts`) |
| cœur, Ma liste, « vu » d'un titre de la bibliothèque | index en mémoire, retouché dès que la requête du proxy a réussi (`userDataPatchOf` → `patchLibraryMemo`), sans attendre le balayage |

## 2. Jamais sous le curseur : le retrait au LÂCHER

Côté client (`packages/api-client/src/reco/recoRetirement.ts`), une carte
de recommandation est **tenue** tant que :

- sa **rangée** est survolée (web, bureau — `RecoRow`, et le héros
  `RecoBillboard`) : la rangée est aussi **figée** (`useHeldRecoItems`),
  rien n'y bouge sous le curseur, ni un titre jugé, ni une page resservie ;
- sa **feuille d'actions** est ouverte (mobile `CardSheetScope`, miroir
  `useItemSheets`, TV `useTVCardActions`, webOS `FocusableCard` —
  `useRecoCardHold`), sortie animée comprise (`lingerMs`).

Au lâcher, « jugé » se lit dans les caches mêmes que les marqueurs de la carte
(`resolveCardMarkers` : pastille Ma liste / favori / vu, ou une note ; la mise
de côté d'une carte Vigie). Jugée, la carte **s'efface** (160 ms, opacité et
échelle — `.reco-card-leaving` sur le web, Animated sur le mobile, instantané
sous mouvement réduit), puis le titre quitte toutes les pages en cache, et
aucune page servie ensuite ne le remontre (`selectRecoPage`). Reprise pendant
le fondu : la carte reste.

Pourquoi la rangée et pas la carte : retirer une carte dès que le pointeur la
quitte fait glisser sa voisine — celle qu'on survole maintenant — sous le
curseur.

**Exception** : « Ne plus me proposer » part TOUT DE SUITE, même d'une rangée
tenue — l'utilisateur l'a demandé.

Une note posée ailleurs (fiche, fin de lecture) retire le titre tout de suite ;
posée depuis une carte tenue, elle attend le lâcher (`dropRecoItemUnlessHeld`).

## 3. Ma liste n'est pas un goût : les POTENTIELS

Un titre seulement dans Ma liste — ni vu, ni suivi, ni noté, ni aimé, ni
refusé — n'a pas été jugé. Il ne pèse **rien** dans le profil (ni ancre, ni
graine, ni « Parce que vous avez aimé… ») : c'est un **potentiel**.

- La règle, pure : `potentialsOf(anchorSet, watchlist, pending)` —
  `apps/backend/src/services/reco/potentials.ts`. « Jugé » se lit sur
  `AnchorSet.judged` : tout signal, même trop faible pour une ancre (une
  note neutre).
- Stockés à chaque reconstruction dans `taste_profiles.potentials`, relus
  par `parsePotentials` (`services/reco/anchorStore.ts`) :
  `{ key, mediaType, tmdbId, title, jellyfinId }[]` — `title` vide et
  `jellyfinId` null pour un titre mis de côté avant son arrivée (le cache
  TMDB le nomme).
- Les ancres (`parseAnchors(taste_profiles.anchors)`) ne portent plus Ma
  liste. Profil version 5 : le fan-out de démarrage reconstruit les anciens.
- Un même « j'aime » dit par plusieurs voies — cœur, like Vigie, like d'Affiner
  (qui pose le cœur, cf. `docs/SWIPE-AFFINER.md`) — ne compte qu'une fois.

La page Statistiques lit la même donnée : le goût dans les ancres, les
potentiels à part.

## 4. Un titre demandé est masqué, pas jugé

Demander un titre (à l'extension de demandes, Vigie) le retire des
recommandations — « Pour vous », Affiner, toute rangée servie — pour le SEUL
compte qui l'a demandé. Ce n'est pas un goût : il ne pèse ni sur le profil, ni
sur les statistiques.

- Serveur : l'extension le dit après chaque demande acceptée, d'où qu'elle
  parte (carte du cœur ou page de l'extension) — `ctx.recommendations.titleRequested`
  → `hideRequestedTitle` (action `requested`, qui n'écrase jamais un refus).
  `GET /api/reco/requested` rend les clés du compte.
- Client : une demande faite d'une carte du cœur pose la clé dans le cache
  `REQUESTED_TITLES_KEY` ; au retour d'une page d'extension, la liste se relit.
  Le titre sort de la pile d'Affiner, et des rangées au lâcher (règle 2) :
  « demandé » vaut jugé pour `isRecoItemJudged`.

## 5. Une page servie reste à l'écran tant qu'on y est

Le serveur recalcule la page en fond — un refus (`pokePage("feedback")`), une
note ou un cœur (`pokeProfile` → profil → `pokePage("profile")`), un pool
régénéré (`pokePage("pool")`) — puis prévient par `reco:update`. Le cache la
reçoit ; l'ÉCRAN, non. Avant cette règle, la page fraîche remplaçait celle
qu'on lisait : les rangées « Parce que vous avez aimé… » changeaient de clé,
se démontaient puis rentraient en fondu, et le héros se retirait au sort (le
tirage dépendait de la PLACE des titres) : c'est ce qui se voyait en
refusant un titre.

`useRecoPageVisit` (api-client) dit ce que l'écran MONTRE ; `useRecoPage`
reste ce que le serveur sert. Toute page qui montre des recommandations lit
le premier : « Pour vous » et l'accueil, sur le web, le bureau, le miroir, le
mobile, la TV et webOS. La règle, pure, vit dans `reco/recoPageVisit.ts` :

- **Ce qui passe sous les yeux** : seulement le titre qui SORT — refusé (il
  part tout de suite), jugé puis lâché (fondu, règle 2), noté, demandé. Toutes
  ces sorties passent par `dropRecoItemEverywhere`, qui le signale
  (`emitRecoDropped`) ; la page tenue l'écoute, même quand le cache tient déjà
  une autre page. Une rangée vidée part avec son dernier titre.
- **Les frontières** où une page recalculée entre (`servedPageVerdict`) :
  - la visite suivante — un nouveau montage lit le cache du moment ;
  - l'arrivée (`RECO_ARRIVAL_MS`, 2 s) : la page du cache s'affiche aussitôt,
    la fraîche la remplace dans la foulée ;
  - le retour après une longue absence (`RECO_LONG_ABSENCE_MS`, 30 min,
    fenêtre cachée ou app en arrière-plan, lu par le `focusManager` de
    TanStack) : il vaut une nouvelle arrivée ;
  - un geste : changer de filtre, `refetch` (réessayer, tirer pour
    rafraîchir), `showNewer` ;
  - une page encore provisoire (rien que des rangées globales, ou rien) laisse
    entrer la première page personnelle : c'est elle qu'on attendait
    (démarrage à froid, construction).
- **Le geste discret** : `hasNewer` dit qu'une page recalculée attend avec du
  NOUVEAU (un titre ou une rangée que l'écran n'a pas — une page qui ne fait
  que retirer ou réordonner n'invite à rien). Le web et le bureau le
  proposent en tête de « Pour vous » ; ailleurs, la visite suivante suffit.
- **Jamais de squelette qui revient** : le squelette n'existe que tant que la
  visite n'a RIEN à montrer.
- **Le héros ne se retire pas au sort** : le rang d'un titre dans le tirage
  dépend de la graine de la visite et de SA clé (`selectHeroSlides`), pas de
  sa place — un titre qui sort n'emporte que sa diapositive.

## 6. Sans clé TMDB, les recommandations ne sont pas activées

La clé TMDB est l'interrupteur GLOBAL de la reco : absente, `serveContext`
rend l'état `disabled` avec `tmdbConfigured: false` (champ de
`/api/reco/page` depuis le serveur 1.17), aucun profil ne se construit, le
fan-out ne part pas. Seules les rangées globales servables sans TMDB
(« Les mieux notés de votre bibliothèque ») restent servies. Poser la clé
(Administration › Métadonnées) lance le fan-out (`key-set`) ; la retirer
éteint tout de nouveau. Aucun réglage à rallumer : un serveur qui avait une
clé ne voit rien changer. Ni capacité ni champ nouveau : la cause voyage déjà
dans `tmdbConfigured`, qui prime sur `personalized` (le réglage du compte
n'y changerait rien).

Ce que la page en dit, partout pareil — un constat, jamais une alerte ni un
reproche : « Les recommandations ne sont pas encore activées : elles
demandent une clé TMDB. »

- **Web, bureau, fenêtre étroite** (`RecoTmdbOff`) : en tête de page quand
  des rangées globales sont servies, seul sous le titre sinon. Un
  administrateur en session PERSONNELLE (`useCanSetTmdbKey` : ni profil de
  la Famille) a UN bouton, « Ajouter la clé TMDB », vers
  `/admin/metadata#tmdb` (`ADMIN_TMDB_KEY_PATH`, la cible du tableau de bord
  et de l'avertissement surgissant ; l'ancre ouvre le champ, `useHashTarget`).
  Les autres lisent que leur administrateur peut les activer.
- **Apple TV, Android TV, LG** (`tvRecoNotice` → `tmdbOff`) et **mobile** :
  les mots seulement (`reco:tmdbOffDeviceHint`), aucun bouton — on n'y
  administre rien.
- Enregistrer ou retirer la clé invalide la page en cache
  (`useUpdateAdminMetadata`) : l'administrateur la voit changer aussitôt ;
  les autres comptes, au `reco:update` de leur profil ou à la péremption de
  la page.

## « Tendances actuelles » en tête (serveur 1.31.0)

La première rangée de « Pour vous », pour qui la laisse allumée (préférence du
COMPTE `trendingNow`, allumée par défaut, capacité `reco.trending`) : les
tendances TMDB de la semaine (`/trending/{movie,tv}/week`, langue du serveur,
sentinelle globale rafraîchie toutes les 12 h par le job reco), films et séries
entrelacés, **dans l'ordre de TMDB** — ni le profil de goût ni les statistiques
n'y touchent.

- **Où** : `GET /api/reco/page?trendingNow=1` (RECO_PAGE_TRENDING_PARAM), rangée
  `trendingNow` ajoutée au SERVICE (jamais dans un snapshot) —
  `services/reco/trendingHead.ts`. Un serveur d'avant ignore le paramètre ; le
  mobile et webOS ne l'envoient pas.
- **Ce qui s'applique quand même** : les exclusions du compte (règle 1),
  « bibliothèque seule », ses droits, le filtre de plateformes ; hors
  bibliothèque, les cartes absentes (Vigie) comme partout ; sans clé TMDB,
  rien. Moins de 6 titres : pas de rangée.
- **Un titre une fois** : les rangées suivantes perdent les titres de la tête
  (une rangée tombée sous 6 n'est plus servie) ; « À la une » est tiré avant.
  Seule `trending` (goûtée) reste entière, pour l'accueil qui peut l'épingler ;
  « Pour vous » ne la montre pas (`forYouPageRows`, api-client).
- **Le retrait** suit les règles 2 et 5 : c'est une rangée de la page.
