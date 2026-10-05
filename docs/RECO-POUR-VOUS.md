# « Pour vous » — ce qui en sort, quand, et ce qui fait le goût

Les recommandations ne proposent que ce que l'utilisateur n'a **pas encore
jugé**. Trois règles, sur toutes les plateformes, avec le serveur.

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
