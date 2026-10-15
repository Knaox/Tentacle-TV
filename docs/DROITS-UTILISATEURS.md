# Droits des utilisateurs et contrôle parental — Jellyfin décide, Tentacle applique

> Carnet de conception du lot « droits » (2026-10-15). Il fixe le CONTRAT que les
> quatre chantiers partagent ; chacun le complète là où il le précise, sans le
> contredire. Une divergence se remonte au coordinateur, elle ne se tranche pas seul.

## 1. Le principe

- **Jellyfin est la source unique des droits.** Tout droit d'un compte est un champ de
  sa `UserPolicy` Jellyfin. Tentacle n'en garde AUCUNE copie : il la relit, l'écrit dans
  Jellyfin, la relit. Un changement fait dans le tableau de bord de Jellyfin se voit
  dans Tentacle ; un changement fait dans Tentacle se voit dans Jellyfin.
- **Lecture fraîche** : cache mémoire de 30 s au plus par compte, vidé à chaque écriture
  faite par Tentacle (même règle que `services/jellyfinPolicy.ts`).
- **Fermé à l'échec** : politique illisible (Jellyfin muet, compte inconnu) ⇒ le compte
  est traité comme le PLUS restreint possible pour tout ce qui est contenu (rien
  d'extérieur affiché, aucune demande acceptée), jamais comme libre.
- **Le serveur décide de tout** ; un client n'applique rien lui-même, il affiche ce que
  le serveur lui donne. Un titre interdit à un compte ne lui parvient par AUCUN chemin :
  liste, recherche, recommandation, fiche, lecture, aperçu, notification, extension.

## 2. Plateformes

- **Édition des droits : web et bureau seulement** (le bureau rend la build web). Ni
  mobile, ni TV, ni webOS : aucune entrée, aucun écran.
- **Application des droits : partout**, puisque c'est le serveur (et Jellyfin) qui filtre.

## 3. Le contrat partagé — `packages/shared/src/userRights/`

Recopié octet pour octet dans `apps/backend/src/userRights/` (test miroir, comme
`serverCapabilities` et `family`). Les noms ci-dessous traversent le réseau : ils ne se
renomment jamais une fois livrés.

### 3.1 `userRightsContract.ts`

- `USER_RIGHTS_FIELDS` : liste FERMÉE `cléTentacle → { jellyfin: "ChampPolicy", group, kind }`.
  `kind` ∈ `boolean | integer | stringList | folderList | unratedList | schedules | enum`.
  Groupes et champs (à confirmer contre l'OpenAPI de Jellyfin 10.11 : un champ absent de
  10.11 n'entre pas) :
  - `account` : `isAdministrator`, `isDisabled`, `isHidden`, `enableRemoteAccess`,
    `maxActiveSessions`, `loginAttemptsBeforeLockout`
  - `libraries` : `enableAllFolders`, `enabledFolders`, `enableAllChannels`, `enabledChannels`
  - `parental` : `maxParentalRating`, `maxParentalSubRating`, `blockUnratedItems`,
    `blockedTags`, `allowedTags`, `accessSchedules`
  - `playback` : `enableMediaPlayback`, `enableAudioPlaybackTranscoding`,
    `enableVideoPlaybackTranscoding`, `enablePlaybackRemuxing`,
    `forceRemoteSourceTranscoding`, `remoteClientBitrateLimit`, `syncPlayAccess`
  - `offline` : `enableContentDownloading`, `enableMediaConversion`
  - `management` : `enableContentDeletion`, `enableContentDeletionFromFolders`,
    `enableCollectionManagement`, `enableSubtitleManagement`, `enableLyricManagement`,
    `enableLiveTvAccess`, `enableLiveTvManagement`, `enableRemoteControlOfOtherUsers`,
    `enableSharedDeviceControl`, `enablePublicSharing`
- `UserRightsDto` : `{ userId, name, rights: UserRights, readAt }` — `rights` porte TOUS
  les champs de la liste.
- `UserRightsPatch` : sous-ensemble de `UserRights` (au moins un champ).
- `UserRightsOptions` : `{ libraries: { id, name, collectionType }[], channels: { id, name }[],
  parentalRatings: { name, score, subScore }[], unratedItemTypes: string[], knownTags: string[] }`
  — lus dans Jellyfin (`/Library/VirtualFolders`, `/Localization/ParentalRatings`, etc.).
- `UserRightsRefusal` (liste fermée, réponse `{ error }`) : `unknown_user`, `family_guest`,
  `last_admin`, `self_lockout`, `invalid_value`, `jellyfin_unreachable`, `jellyfin_refused`.

### 3.2 Routes (`USER_RIGHTS_ROUTES`) — `requirePersonalAdmin`, jamais une TV

| Geste | Méthode | Chemin |
|-------|---------|--------|
| `options` | GET | `/api/admin/users/rights/options` |
| `read` | GET | `/api/admin/users/:userId/rights` |
| `update` | PATCH | `/api/admin/users/:userId/rights` (corps `UserRightsPatch`) → `UserRightsDto` |

Règles d'écriture : relire la politique complète juste avant, ne changer QUE les champs
du correctif (validés : types, bibliothèques et canaux qui existent, notes de la table de
Jellyfin), réécrire (`POST /Users/{id}/Policy`) en gardant tout le reste à l'octet près
(`AuthenticationProviderId`, `PasswordResetProviderId`…), relire et rendre l'état RÉEL.
Refus : retirer l'administration au dernier administrateur (`last_admin`) ; un
administrateur ne se désactive ni ne se retire l'administration lui-même (`self_lockout`) ;
un invité de la Famille ne se règle pas ici (`family_guest` : il suit son créateur et le
contrôle parental de la Famille). Journal `[user-rights]` : qui, quel compte, quels NOMS
de champs — jamais une valeur.

### 3.3 Capacités du serveur (version `1.30.0`)

- `admin.userRights` — les trois routes ci-dessus.
- `family.parentalControls` — le contrôle parental des invités (§ 4).

### 3.4 Précisions du socle (étape A)

- **Champs confirmés** contre l'OpenAPI de Jellyfin 10.11.0 et 10.11.11 (`UserPolicy`,
  identique en 12.2) : les 37 champs du § 3.1 existent tous, aucun n'est retiré.
- `UserRightsFieldSpec` porte en plus, quand il le faut : `min`/`max`/`nullable` (`integer` ;
  `null` = « sans limite » pour les deux notes), `among: "libraries" | "channels"`
  (`folderList` : `enabledFolders` et `enableContentDeletionFromFolders` choisissent parmi les
  bibliothèques, `enabledChannels` parmi les canaux), `values` (`enum` : `syncPlayAccess`).
- `maxParentalRating` / `maxParentalSubRating` sont des SCORES de la table de Jellyfin
  (`ParentalRatingScore.score` / `subScore`), pas des noms : la valeur doit exister dans
  `UserRightsOptions.parentalRatings`.
- Validation STRICTE et partagée (`userRightsPatch.ts`, miroir) : une clé inconnue refuse le
  correctif entier sans être nommée ; une valeur fausse le refuse en nommant sa CLÉ
  (`{ error: "invalid_value", fields }`) ; identifiants normalisés (minuscules, sans tirets) ;
  étiquettes rognées, dédoublonnées, 1 à 200 caractères, 500 au plus par liste ; plage horaire
  `0 ≤ début < fin ≤ 24`, sans champ de plus.
- Statuts HTTP des refus : `unknown_user` 404, `family_guest` / `last_admin` / `self_lockout`
  409, `invalid_value` 400, `jellyfin_unreachable` 503, `jellyfin_refused` 502.
- Le correctif `update` est borné à 60 par minute et par adresse.

## 4. Contrôle parental de la Famille

- **Qui** : le PROPRIÉTAIRE règle le contrôle parental de tout invité de la famille ; un
  MEMBRE, de ses propres invités seulement. Jamais celui d'un membre ni du propriétaire :
  ce sont de vrais comptes, réglés par l'administrateur (§ 3).
- **Geste** : entrée `setGuestParental` dans `FAMILY_ROUTES` (`PUT
  /api/family/guests/:userId/parental`, appelant `personal`, comme `setGuestPhoto`) ;
  corps `GuestParentalControls` = `{ maxParentalRating, maxParentalSubRating,
  blockUnratedItems, blockedTags, accessSchedules }` ; l'état se lit avec l'invité (DTO
  de la Famille enrichi, champ additif).
- **Jamais plus large que le créateur** : l'invité reçoit l'INTERSECTION des restrictions
  de son créateur et de son contrôle parental — note maximale = la plus basse des deux,
  types non classés et étiquettes bloquées = l'union, étiquettes permises du créateur
  imposées, plages horaires jamais plus larges. Écrit dans SA politique Jellyfin : c'est
  Jellyfin qui l'applique.
- **Le créateur change, l'invité suit** : quand les restrictions du créateur changent (par
  Tentacle OU directement dans Jellyfin), ses invités sont recalculés — à l'écriture faite
  par Tentacle, à chaque ouverture d'un profil d'invité, et par un guet périodique léger.
  Le contrôle parental voulu pour l'invité est gardé par Tentacle (c'est un réglage de la
  Famille, pas un droit Jellyfin) ; la politique EFFECTIVE, elle, vit dans Jellyfin.

### 4.1 Précisions (étape A, décisions du coordinateur)

- Contrat dans `packages/shared/src/family/familyParental.ts` (miroir, ré-exporté par
  `familyContract.ts`).
- **État lu avec l'invité** : deux champs ADDITIFS de `FamilyProfileDto` —
  `parental?: GuestParentalControls | null` (la valeur VOULUE) et
  `parentalCeiling?: GuestParentalCeiling | null` (les restrictions du créateur, le plafond :
  `maxParentalRating`, `maxParentalSubRating`, `blockUnratedItems`, `blockedTags`,
  `allowedTags`, `accessSchedules` ; null si Jellyfin est muet). Remplis SEULEMENT pour un
  appelant qui peut régler cet invité (le propriétaire, ou le membre qui l'a créé) ; ABSENTS
  pour tout autre appelant.
- `setGuestParental` : `PUT`, corps = le contrôle ENTIER (remplacement), réponse
  `GuestParentalDto` = `{ parental, parentalCeiling }`, 30 par minute.
- `parentalOptions` : `GET /api/family/parental/options`, appelant `personal`, réservée à qui
  peut régler au moins un invité (`family.not_owner` sinon) → `FamilyParentalOptionsDto` =
  `{ parentalRatings, unratedItemTypes, knownTags }`, le sous-ensemble de `UserRightsOptions`,
  mêmes formes ; UNE fonction de lecture sert les deux routes.
- Refus : codes existants de la Famille (`family.invalid_input`, `family.not_owner`,
  `family.jellyfin_*`) — aucun code nouveau.
- **Formes des valeurs, communes au contrat admin et à la Famille** (conformes à Jellyfin
  10.11) : `maxParentalRating` = score Jellyfin, `number | null` ; `maxParentalSubRating` =
  `number | null` ; `blockUnratedItems` = noms de l'enum `UnratedItem` ; `accessSchedules` =
  `{ dayOfWeek, startHour, endHour }[]` en camelCase, `dayOfWeek` ∈ `Sunday`…`Saturday` |
  `Everyday` | `Weekday` | `Weekend`, heures DÉCIMALES (`double` chez Jellyfin : 20.5 = 20 h 30),
  `0 ≤ startHour < endHour ≤ 24` ; `syncPlayAccess` ∈ `CreateAndJoinGroups` | `JoinGroups` |
  `None` ; `remoteClientBitrateLimit` en bits/s, 0 = illimité.

## 5. Le filtrage du contenu — `apps/backend/src/services/contentPolicy/`

- `getContentPolicy(userId)` → la politique de contenu du compte (note maximale, types non
  classés bloqués, étiquettes, bibliothèques, plage horaire en cours) ; `isRestricted`
  (vrai dès qu'une note maximale, une étiquette bloquée/permise ou un type non classé est
  posé) ; cache 30 s ; `invalidateContentPolicy(userId)`.
- **Titres de la bibliothèque** : toute lecture faite pour un compte passe son `userId` à
  Jellyfin (qui applique note, étiquettes, bibliothèques). Jamais la clé d'API sans
  `userId` pour un résultat rendu à un compte.
- **Titres extérieurs** (TMDB : recommandations hors bibliothèque, saga, « À demander »,
  Vigie) : `filterExternalTitles(userId, titles)` — certification TMDB (`release_dates`,
  `content_ratings`, drapeau `adult`) ramenée sur l'échelle de notes de Jellyfin (même
  table, même pays de métadonnées d'abord). **Un compte restreint ne voit JAMAIS un titre
  extérieur sans certification exploitable** ; `adult` = toujours caché à un compte
  restreint. Un compte non restreint : chemin court, aucune requête TMDB.
- **Pont des extensions** — champ OPTIONNEL de `PluginBackendContext` (venu en 1.30.0 :
  une extension le teste avant de l'appeler) :

  ```ts
  contentPolicy?: {
    isRestricted(userId: string): Promise<boolean>;
    filterExternalTitles(userId: string, titles: { mediaType: "movie" | "tv"; tmdbId: number }[]):
      Promise<{ mediaType: "movie" | "tv"; tmdbId: number }[]>;
    allowsExternalTitle(userId: string, title: { mediaType: "movie" | "tv"; tmdbId: number }): Promise<boolean>;
  };
  ```

  Une exception du pont ⇒ l'extension refuse (fermé à l'échec). Absent (cœur d'avant) ⇒
  comportement d'avant : le contrôle parental n'existait pas.

### 5.1 Précisions du socle (étape A)

- `services/contentPolicy/` : `getContentPolicy`, `invalidateContentPolicy`, `isRestricted`,
  `filterExternalTitles(userId, titles)` (générique : rend les objets REÇUS, dans l'ordre),
  `allowsExternalTitle`, `contentPolicyBridge()`. La politique illisible est
  `closedContentPolicy` : note 0, tous les types non classés bloqués, aucune bibliothèque —
  gardée 5 s seulement (30 s pour une politique lue).
- Le pont est BRANCHÉ dès l'étape A dans `pluginBackendLoader.ts`. Tant que l'étape D n'a pas
  posé la correspondance des certifications, un compte restreint ne reçoit AUCUN titre
  extérieur (fermé à l'échec) ; un compte non restreint, tout, sans requête TMDB.
- Le pont nettoie ce qu'il reçoit : une entrée mal formée (type inconnu, `tmdbId` non entier
  positif) est écartée, jamais laissée passer.

## 6. Les chantiers

| Chantier | Branche | Contenu |
|----------|---------|---------|
| Socle serveur | `lot-droits/socle` | § 3 et § 4 côté serveur, § 5 (service, titres extérieurs, pont), capacités |
| Filtrage | `lot-droits/filtrage` | Chaque chemin du cœur qui rend du contenu à un compte (§ 7) |
| Interface | `lot-droits/interface` | Web + bureau : fiche des droits dans l'admin, contrôle parental dans la Famille |
| Vigie | `lot-droits/vigie` (dépôt Tentacle-Plugin-Seer) | Découverte, recherche, fiche, demandes, `titles.*` filtrés par le pont |

## 7. Chemins à fermer (audit du chantier Filtrage, 2026-10-15)

### 7.1 Ce que Jellyfin fait, et ne fait pas (mesuré sur 10.11.11, Jellyfin jetable)

| Requête (clé d'API sauf mention) | Note / étiquettes / non classés | Bibliothèques |
|---|---|---|
| `/Items?Recursive=true&userId=U`, `/Items/Latest?userId=U`, `/Search/Hints?userId=U` | filtrés | filtrées |
| `/Items?ids=…&userId=U` | filtrés | **NON filtrées** |
| `/Items/{id}?userId=U`, `POST /Items/{id}/PlaybackInfo?userId=U`, `/Items/{id}/Similar?userId=U` | 404 | 404 |
| `/Search/Hints`, `/Items` SANS `userId` | **tout** | **tout** |
| `/Videos/{id}/stream`, `/Videos/{id}/master.m3u8` — clé, jeton DU COMPTE restreint, ou (fichier tel quel) sans jeton | **servis** | **servis** |
| Plages horaires | vérifiées à l'authentification d'un jeton de COMPTE seulement — jamais avec la clé d'API (appareils, recherche, recos, push) | |

D'où trois règles : (1) une liste d'ids ne se filtre jamais par `ids=` seul — relevé complet
`/Items?Recursive=true&userId=` (`services/search/userAccess.ts`) ou `/Items/{id}?userId=` un
par un (`services/itemAccess/itemVisibility.ts`, verdict 30 s) ; (2) un flux est gardé par le
proxy, pas par Jellyfin ; (3) la porte DIRECTE de Jellyfin (lecture directe, port publié) sert
un fichier à qui connaît son id : hors de portée de Tentacle — d'où l'importance de ne jamais
rendre l'id d'un titre interdit, par aucun chemin.

### 7.2 Relevé — chemin → risque → correctif

État : ✅ fermé (commit) · ⏳ à fermer ici · 🧱 attend le socle (`getContentPolicy`,
`filterExternalTitles`) · 🔌 autre chantier.

**Proxy Jellyfin (`routes/jellyfinProxy*`)**
- ✅ Cache des lectures (Latest, Resume, NextUp, Views) → clé = 16 premiers caractères du jeton,
  identiques pour TOUS les JWT d'appareil, lue avant toute validation : deux TV (ou un faux
  jeton) se servaient la réponse d'un autre compte → clé = empreinte SHA-256 du jeton entier.
- ✅ Jeton d'appareil (TV jumelée, profil de TV) et « voir en tant que » : clé admin prêtée,
  une requête de catalogue sans `userId` lisait pour l'administrateur → `userId` du compte
  posé d'office (`deviceUserScope.ts`, étendu de la seule session de profil du bureau).
- ✅ Flux (`Videos/{id}/stream|master.m3u8|main.m3u8|hls1/…|Subtitles/…`, `Audio/{id}/…`), tout
  jeton : servis pour un titre interdit → `streamAccess.ts`, 404 si `/Items/{id}?userId=` refuse.
- ✅ `PlaybackInfo` d'appareil : part désormais avec `userId` → 404 de Jellyfin.
- ✅ Trickplay (`routes/jellyfinTrickplay.ts`) : appareil → clé admin sans contrôle, et
  `Cache-Control: public` → visibilité vérifiée, `private`.
- 🧱 Plages horaires d'un appareil (clé prêtée) : jamais appliquées → refus hors plage par
  `getContentPolicy` (proxy ET `requireAuth`, qui garde `/Users/Me` 5 min).
- Accepté : images (`Items/{id}/Images`) — Jellyfin les sert sans jeton, le proxy n'y change rien.

**Recommandations « Pour vous » (`services/reco/**`, `routes/reco*.ts`)**
- Bibliothèque : index par compte (`candidates/libraryIndex.ts`, clé + `userId`) — correct.
- ✅ Un titre de la bibliothèque INTERDIT au compte revient comme titre EXTÉRIEUR (affiche TMDB,
  « Demander ») par TMDB, Vigie, voisins, tendances, pouls du serveur, communauté, Affiner
  → retiré à la porte du service (`pageService`) : tout extérieur dont la clé `movie:|tv:` est
  dans le catalogue mais pas dans `getUserAccess(compte)` (`search/libraryRights.ts`, sans
  requête de plus) ; droits illisibles → extérieurs retirés.
- ✅ Instantané et pool en base : un `jellyfinItemId` devenu invisible y reste → même porte.
- 🧱 Titres extérieurs non filtrés (certification, `adult`) → `filterExternalTitles` à la même
  porte, AVANT la coupe des rangées ; `pool/debug` aussi.
- 🧱 Fraîcheur : index du compte et `userAccess` vivent 10 min → relancés par
  `invalidateContentPolicy` ; chemin court seulement si non restreint ET toutes bibliothèques.
- 🧱 `reco/people/*` : « connu pour » d'une personne TMDB → vidé pour un compte restreint.

**Affiner (`routes/swipe.ts`, `services/swipe/**`)**
- ✅/🧱 Pile : pool + `/trending` et `/top_rated` TMDB (cache global 6 h) → mêmes deux filtres
  avant `mixDeck`. 🧱 `details/:type/:tmdbId` : synopsis de tout titre → `allowsExternalTitle`.

**Saga, collections, saisons manquantes**
- Membres de bibliothèque : `getUserAccess` — correct.
- ✅/🧱 `GET /api/sagas/:id` → `parts` TMDB rend TOUS les volets, interdits compris (« Demander »
  sur l'Apple TV) → garder un volet s'il est membre visible, sinon s'il n'est pas caché dans la
  bibliothèque ET passe `filterExternalTitles`.
- 🔌 Saisons manquantes (`titles.gaps`) : calculées par Vigie → chantier Vigie (pont).

**Recherche (`services/search/**`)**
- Catalogue commun relevé au nom de l'admin, filtré à chaque réponse par `getUserAccess` (sans
  `ids=`) ; épisodes par clé + `userId` du compte — correct. 🧱 Fraîcheur 10 min (cf. recos).
- 🔌 « À demander » : titres TMDB servis par Vigie → chantier Vigie.

**Derniers ajouts**
- Rangée regroupée (`latestAdditions.ts`) : inventaire au nom du compte — correct (cache : ✅).
- `jellyfinUserEvents.ts`, `jellyfinPoller.ts` : signal `home:update` sans titre — rien à faire.

**Notifications et push**
- ✅ « Nouveau titre » (`libraryAddedRecipients.ts`) : diff au nom de l'admin, envoyé à TOUT
  abonné sans filtre → par destinataire, ne garder que les titres qu'il voit ; échec = rien.
- ✅ « Demande disponible » (`notificationPushWorker.ts`) : poussé au demandeur sans contrôle
  → visibilité du titre pour `jellyfinUserId` avant l'envoi, sinon rien.

**Héros, accueil**
- ✅ `heroArtworkFor`, `isFixedHeroItemVisible` : `/Items?userId=&Ids=` (bibliothèques non
  filtrées) → `/Items/{id}?userId=`.

**Résolutions TMDB → bibliothèque**
- ✅ `GET /api/tmdb/resolve` : au nom de l'admin → rend l'id d'un titre interdit → `userId` du compte.
- ✅ Likes / Ma liste par TMDB (`likesTmdb.ts`, `watchlistTmdb.ts`, `watchlistPending.ts`) :
  `findLibraryItemByTmdb` au nom de l'admin → au nom du compte (sinon branche « en attente »).
- 🧱 `GET /api/tmdb/trailers` : vidéos de tout `tmdbId` → `allowsExternalTitle`.

**Watch Together**
- ✅ Invitation (`watchTogetherInvites.ts`) : nom et id du titre lus au nom de l'HÔTE et
  envoyés à l'invité → lus au nom de la CIBLE ; invisible pour elle : ni nom ni id.
- ✅ `wt:setItem` / état du salon : id diffusé à tous sans contrôle → refusé si un membre ne voit
  pas le titre (`stale_item`, messages suivants tenus dans l'ordre) ; inviter ou accepter sur un
  titre en lecture caché à la cible : refusé.
- ✅ Affinité : `jellyfinItemId` pris chez le premier membre → celui du membre qui le voit.

**Divers**
- ✅ `GET /api/leaderboard/:userId/top-series` : séries d'un AUTRE compte, adulte compris → ne
  garder que ce que le DEMANDEUR voit ; un invité de la Famille n'est pas une cible.
- ✅ `GET /api/playback/segments/:itemId` : au nom de l'admin → 404 si le compte ne voit pas.
- Aperçus et bandes-annonces de la bibliothèque (`catalogTitle.ts`, `trailerPreview*`) : au nom
  du compte — correct (garde 10 min, 🧱 fraîcheur). 🧱 Par `tmdbId` : `allowsExternalTitle`.
- Téléchargements hors ligne (`downloads.ts`) : jeton du compte + politique relue — correct.
- « Voir en tant que » : `request.user.userId` = le compte visé — correct (proxy : ✅).
- Partage public (`share.ts`) : titres au nom du PROPRIÉTAIRE du lien, voulu (lien anonyme) — à
  trancher par le coordinateur, pas filtré.
- Top Shelf Apple TV : image statique, aucun titre — rien à faire.
- `idfStore.ts`, `viewingStats`, `watchTime` : statistiques sans titre rendu — rien à faire.

## 8. Règles de chantier

- Jamais un changement de politique sur le Jellyfin RÉEL (dev et prod partagent le même
  Jellyfin) : toute écriture se prouve sur un Jellyfin JETABLE (conteneur, colima). Sur le
  réel, lecture seule et comptes Knaoxtest / Knaoxtest2 seulement.
- Aucun bump, aucun changelog, aucun `versions.json` : le coordinateur s'en charge.
- 300 lignes au plus par fichier, code en anglais, commentaires en français, un commit
  par étape, jamais de push ni de tag.
