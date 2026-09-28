# Vos statistiques de visionnage

La page « Vos statistiques » (`/stats` sur le web, le bureau et le miroir ;
écran `stats` sur le mobile) montre à chacun ce qu'il a regardé, quand,
comment, et ce que ses recommandations ont appris de lui. Pas de TV, pas de
webOS (`Stats = Unavailable` dans `lazyPagesTv.tsx`).

## Le contrat : `GET /api/stats/me`

`?period=30d|year|all&tz=<IANA>&lang=fr|en[&refresh=1]` — les statistiques du
compte APPELANT, jamais d'un autre : l'identifiant vient du jeton, aucun
paramètre ne le désigne. Le contrat canonique est
`packages/shared/src/types/viewingStats.ts`, recopié octet pour octet dans
`apps/backend/src/services/viewingStats/contract.ts` (verrou :
`contractMirror.test.ts`). On modifie shared, puis :

```bash
cp packages/shared/src/types/viewingStats.ts apps/backend/src/services/viewingStats/contract.ts
```

Réponses : 200 ; 401 sans jeton ; 503 sans Jellyfin configuré ; 502 si
Jellyfin ne répond pas. Un serveur plus ancien répond 404 : les clients
l'annoncent (« Serveur à mettre à jour ») plutôt que d'échouer.

## D'où viennent les chiffres

Trois natures, jamais mélangées sans le dire :

| Nature | Source | Sert à |
|---|---|---|
| **Mesuré** | `watch_segments` (le collecteur interroge `/Sessions` toutes les 15 s) | durées réelles, rythme jour × heure, écrans, records |
| **Estimé** | durée des titres marqués « vus » (`RunTimeTicks`), chacun compté UNE fois | le temps d'avant la première mesure |
| **Compté** | Jellyfin (`IsPlayed`) | films et épisodes vus — exacts |

Le **raccord** est celui du classement de visionnage (`leaderboard/`) : un titre
dont la dernière lecture précède la première mesure (l'« époque », tous comptes
confondus) ou n'a pas de date est estimé ; après, seule la mesure compte. Le
total « depuis le début » d'un compte est donc celui du classement.

Garde-fous :

- **Marquage en masse** : quatre titres ou plus « vus » dans la même minute
  n'ont pas de date fiable. Ils comptent dans « depuis le début », jamais dans
  une période datée ni dans la frise (`undatedSeconds`).
- **Plancher de bruit** : moins d'une minute ne fait ni un genre, ni une
  langue, ni un visage, ni un appareil, ni une série — une lecture d'essai de
  2 s n'apparaît nulle part.
- **Fuseau** : jours et heures sont ceux de l'APPAREIL (`tz`, lu par
  `deviceTimeZone()`), calculés par tranches de 15 minutes UTC — tout décalage
  du monde en est un multiple, changements d'heure compris.
- **« Revu »** : un film n'est « vu 2 fois » que si la mesure l'a vu à 60 % ou
  plus sur deux jours distincts. `PlayCount` compte les reprises, pas les
  visionnages : il ne sert pas.

Genres, langues, décennies, acteurs et réalisation viennent des fiches TMDB
**déjà en cache** (`tmdb_meta_cache`, aucun appel TMDB), pour les 250 titres qui
pèsent le plus ; au-delà, les genres Jellyfin rapprochés des ids TMDB
(`genreNames.ts` — une étiquette AniDB comme « super power » n'est pas un
genre). Un titre compte dans chacun de ses genres : les parts ne somment pas à
100 %, et la page le dit.

« Ce que vous aimez » lit le profil du moteur de recommandations TEL QUEL
(`taste_profiles.anchors` : les titres au poids positif, sauf l'envie seule),
avec les notes, coups de cœur, favoris. Aucun recalcul, aucune reconstruction
déclenchée d'ici.

## Coût

Un calcul (170 à 300 ms mesurés sur les comptes de test) lit tout une fois,
produit les TROIS périodes, puis abandonne ses données brutes : seul le résumé
(~12 Ko par période) reste en mémoire, 10 minutes, 30 comptes au plus. Changer
de période ne relance rien. « Tirer pour rafraîchir » recalcule au plus une
fois toutes les 30 s. Parcours Jellyfin paginés (500), champs réduits, images
coupées ; les étiquettes d'images ne sont demandées que pour les titres
affichés.

## Les clients

- Web / bureau / miroir : `apps/web/src/pages/Stats.tsx` et
  `components/stats/`. Graphiques en SVG maison (pas de bibliothèque), règles
  du skill dataviz ; la palette catégorielle (marque, accent, ambre #D97706) est
  validée par script en sombre ET en clair. Entrées : menu utilisateur (en
  tête), profil Electron étroit, profil du miroir.
- Mobile : `apps/mobile/src/screens/StatsScreen.tsx` et `components/stats/`
  (react-native-svg). Entrée : en tête du Profil.
- Partagé : `useViewingStats` (api-client), mises en forme
  (`createStatsFormatter`), lecture du rythme, profil de spectateur
  (`viewerBadges`), titre vedette — `packages/shared/src/viewingStats/`.

## Pièges connus

- **Hermes n'a ni `Intl.PluralRules`, ni `DisplayNames`, ni
  `RelativeTimeFormat`** (sondé sur le simulateur ; `DateTimeFormat` et le
  fuseau existent). i18next y retombe sur « 1 = singulier » : `heroFigure`
  rend un nombre de pluriel déjà tranché (« 1,7 heure » partout), et les noms
  de langues sont calculés par le SERVEUR.
- Aucun mot « téléchargement » dans l'espace `stats` (lu par le mobile) :
  `statsVocabulary.test.ts` le garde.
- Chrome sans tête : un viewport très haut fige `Page.captureScreenshot` —
  capturer par tranches en faisant défiler.
