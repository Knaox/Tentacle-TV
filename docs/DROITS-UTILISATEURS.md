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

### 3.5 Les routes d'admin (étape B)

- `routes/adminUserRights.ts` (sous `adminRoutes`, puis `requirePersonalAdmin`), service
  `services/userRights/userRightsService.ts`, correspondance pure `policyMapping.ts`.
- Lecture d'une politique absente ou illisible champ par champ : la valeur la plus FERMÉE
  (`isDisabled` absent = désactivé, un droit absent = refusé).
- Écriture : correctif validé (`parseUserRightsPatch`, puis `patchAgainstOptions` s'il nomme des
  bibliothèques, des canaux ou des notes), politique RELUE juste avant, seuls les champs du
  correctif remplacés (les autres, `AuthenticationProviderId`, `PasswordResetProviderId` et tout
  champ inconnu d'une version future compris, repartent tels quels), `POST /Users/{id}/Policy`,
  relecture, état RÉEL rendu. Les plages horaires repartent dans la forme de Jellyfin
  (`DayOfWeek`, `StartHour`, `EndHour`, `UserId`), sans `Id`.
- **`last_admin` couvre aussi la DÉSACTIVATION** du dernier administrateur actif (au plus sûr :
  le contrat ne nommait que le retrait de l'administration) ; `self_lockout` : un administrateur
  ne se retire ni l'administration ni l'accès (`isDisabled`). Jellyfin refuse aussi de son côté.
- Après toute écriture (même refusée par Jellyfin) : `notePolicyWritten` — politique de contenu
  oubliée, et invités du compte recalculés (§ 4). Base de la Famille muette : refus
  (`jellyfin_unreachable`), jamais un réglage à l'aveugle d'un invité possible.
- Journal : `[user-rights] <admin> → <compte> : <clés>` ; les clés que Jellyfin n'a pas retenues
  y sont nommées. Jamais une valeur.

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

### 4.2 Le contrôle parental côté serveur (étape C)

- **Le voulu** est gardé dans `family_members.parentalControls` (JSON, migration
  `0006_family_guest_parental`) ; absent = aucun ; ILLISIBLE = le plus fermé (note 0, tous les
  types non classés bloqués), jamais « aucun ».
- **La règle** est pure et partagée (`effectiveGuestParental`, `familyParental.ts`, miroir) : la
  note la plus basse (à score égal, la sous-note la plus basse ; absente = sans limite), types
  non classés et étiquettes bloquées réunis, étiquettes permises du créateur imposées, plages
  recoupées jour par jour. **Deux jeux de plages qui ne se recoupent pas donnent « JAMAIS »**,
  pas une liste vide (qui voudrait dire « à toute heure » chez Jellyfin) : la plage sentinelle
  `{ Sunday, 24, 24 }` (`GUEST_SCHEDULE_NEVER`) — Jellyfin teste `début ≤ h ≤ fin` avec h < 24.
  Prouvé sur Jellyfin 10.11 : acceptée, et la connexion du compte est refusée.
- **L'écriture** (`guestAccounts.guestPolicy`) : la politique de l'invité, les bibliothèques et
  restrictions du créateur, nos interdits, PUIS le contrôle effectif. Les plages repartent au nom
  de l'invité (`UserId`), sans `Id` — avant, celles du créateur étaient recopiées telles quelles.
  Une écriture n'a lieu que si la politique change (plages comparées sans `Id`/`UserId`).
- **`setGuestParental`** : `manageableGuest` (propriétaire : tout invité ; membre : les siens ;
  sinon `family.not_owner`, hors famille `family.not_found`), corps EXACT (les cinq champs),
  note vérifiée contre la table de Jellyfin. Le voulu est gardé D'ABORD, puis la politique est
  écrite et RELUE (refus si Jellyfin ne l'a pas retenue) : si Jellyfin se tait, le guet la pose
  à son retour.
- **L'invité suit son créateur** : (1) toute écriture de politique faite par Tentacle
  (`notePolicyWritten` → `resyncGuestsOfCreator`) ; (2) chaque ouverture d'un profil d'invité
  (TV, bureau : `guestPolicySync.syncGuestPolicy`) ; (3) un guet toutes les DEUX minutes, UNE
  lecture de `/Users` pour tous les invités, une écriture seulement si quelque chose a changé.
  Un créateur introuvable : rien n'est relâché.
- **`parentalOptions`** : le propriétaire d'une famille (même sans invité encore), ou un membre
  qui a créé au moins un invité ; sinon `family.not_owner`.
- **L'état lu avec l'invité** : `withParentalState` (`GET /api/family`, session personnelle
  seulement), une lecture de `/Users` pour tous les plafonds.

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
- Le pont est BRANCHÉ dans `pluginBackendLoader.ts` (`ctx.contentPolicy`), avec le filtre réel
  (§ 5.2) depuis l'étape D.
- Le pont nettoie ce qu'il reçoit : une entrée mal formée (type inconnu, `tmdbId` non entier
  positif) est écartée, jamais laissée passer.

### 5.1 bis Plages horaires et invalidation (demande du filtrage)

- **`scheduleAllows(policy, now)`** (exportée par `services/contentPolicy`) : la règle pure qui
  décide À L'INSTANT — `ContentPolicy` ne porte que les plages brutes, jamais un « dans la
  plage » calculé à la lecture (le cache de 30 s le rendrait faux). Relue sur Jellyfin 10.11.11
  (`UserEntityExtensions.IsParentalScheduleAllowed`) : aucune plage = permis ; sinon l'heure
  LOCALE h, en heures décimales, d'un jour couvert (`Everyday`, `Weekday` lundi → vendredi,
  `Weekend` samedi et dimanche, ou le jour nommé) vérifie **`StartHour ≤ h ≤ EndHour`, bornes
  INCLUSES des deux côtés** (pas `h < EndHour`). Heure locale du serveur Tentacle.
- **`onContentPolicyInvalidated(listener: (userId: string | null) => void): () => void`** :
  appelé de façon SYNCHRONE par `invalidateContentPolicy` (identifiant normalisé, sans tirets)
  et par `clearContentPolicyCache` (`null` = tous les comptes) ; la valeur rendue désabonne ; un
  écouteur qui lève est journalisé (`[content-policy]`) et n'empêche pas les autres.

### 5.2 Certification TMDB → échelle de Jellyfin (étape D)

Relu sur la source de Jellyfin v10.11.11 (`LocalizationManager.GetRatingScore`,
`BaseItem.IsParentalAllowed`, fournisseurs TMDB films et séries) :

- **L'échelle** : un score = l'âge MINIMAL (un entier est lu tel quel comme âge), un `subScore`
  départage à score égal, 1000 = adulte (XXX), 1001 = interdit. Chaque pays a sa table
  chaîne → score ; Jellyfin n'expose par l'API que celle de son pays de métadonnées
  (`/Localization/ParentalRatings`).
- **Le titre** (`externalTitleRule.titleScore`) : comme le fournisseur TMDB de Jellyfin, la
  certification du PAYS DE MÉTADONNÉES de Jellyfin (`MetadataCountryCode`), sinon celle des
  États-Unis ; une SÉRIE sans l'un ni l'autre prend la plus stricte des autres pays (Jellyfin
  prendrait la première listée : la plus stricte n'est jamais plus large). Un FILM sans l'un ni
  l'autre n'a pas de score. Plusieurs sorties dans un pays (`release_dates`) : la plus stricte.
  **Un pays PRÉSENT** (au moins une classification non vide) **sans aucune classification lisible**
  (« NR », chaîne inconnue) **vaut « non classé », sans repli** : les États-Unis ne comptent que si le
  pays de métadonnées est ABSENT, les autres pays d'une série que si ni l'un ni l'autre n'est présent
  (décision du coordinateur, 2026-10-15 — § 9.5.2).
- **La chaîne** (`ratingTables.scoreCertification`) : (1) la table VIVANTE de Jellyfin si le pays
  est son pays de métadonnées ; (2) la table de ce pays écrite par Tentacle (28 pays, d'après les
  systèmes officiels, sur la même échelle — US, FR, GB, DE reprennent les valeurs de Jellyfin) ;
  (3) un âge lisible (« 12 », « 12+ », « -12 », « K-16 », « M/14 », « NC16 ») ou la table
  américaine, au plus strict des deux. « NR », « Unrated », « Exempt », vide, ou une chaîne
  inconnue : AUCUN score — jamais deviné.
- **La décision pour un compte restreint** (`restrictedAllows`) : caché si `adult`, sans score,
  score ≥ 1000, score au-dessus de sa note (`IsParentalAllowed` : à score égal, le `subScore` ≤
  son `maxParentalSubRating`), un mot-clé TMDB parmi ses étiquettes bloquées (Jellyfin pose les
  mots-clés TMDB en étiquettes), aucune de ses étiquettes permises, ou hors de ses plages
  horaires (heure LOCALE du serveur Tentacle — celle de Jellyfin n'est pas lisible ; hors plage,
  rien d'extérieur). Politique illisible, panne : rien.
- **Les données** : `release_dates` (film) ou `content_ratings` (série), RÉDUITS aux seules
  certifications non vides, ajoutés à la fiche du cache TMDB existant (`tmdb_meta_cache`, aucune
  table ni migration) par UN appel de plus la première fois ; une ligne périmée sert encore.
  Au plus 24 titres lus chez TMDB par appel (`EXTERNAL_FETCH_BUDGET`) : les autres sont cachés
  cette fois-ci et lus en fond. Compte non restreint : aucune lecture, liste rendue telle quelle.
- `filterExternalTitles` rend les objets REÇUS, dans l'ordre : un appelant passe ses propres
  titres (`{ mediaType, tmdbId, … }`) et garde ses champs.

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

Étape 3 (2026-10-15) codée contre les signatures de l'étape A du socle : tant que l'étape D
n'est pas fusionnée, `filterExternalTitles` refuse TOUT titre extérieur à un compte restreint —
les chemins sont branchés, la correspondance des certifications arrivera sans y toucher.

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
- ✅ Plages horaires : jamais appliquées à la clé prêtée ni aux routes du cœur → règle de Jellyfin
  (`itemAccess/accessSchedule.ts`) sur `getContentPolicy`, dans le proxy (TV) ET `requireAuth` :
  403 `outside_access_schedule` (jamais 401) ; administrateur et « voir en tant que » non bornés.
- Accepté : images (`Items/{id}/Images`) — Jellyfin les sert sans jeton, le proxy n'y change rien.

**Recommandations « Pour vous » (`services/reco/**`, `routes/reco*.ts`)**
- Bibliothèque : index par compte (`candidates/libraryIndex.ts`, clé + `userId`) — correct.
- ✅ Un titre de la bibliothèque INTERDIT au compte revient comme titre EXTÉRIEUR (affiche TMDB,
  « Demander ») par TMDB, Vigie, voisins, tendances, pouls du serveur, communauté, Affiner
  → retiré à la porte du service (`pageService`) : tout extérieur dont la clé `movie:|tv:` est
  dans le catalogue mais pas dans `getUserAccess(compte)` (`search/libraryRights.ts`, sans
  requête de plus) ; droits illisibles → extérieurs retirés.
- ✅ Instantané et pool en base : un `jellyfinItemId` devenu invisible y reste → même porte.
- ✅ Titres extérieurs (certification, `adult`) → `filterExternalTitles` à la même porte
  (`reco/recoRights.ts`, une question par liste), `pool/debug` aussi ; un extérieur dont le compte
  voit une version dans la bibliothèque passe (Jellyfin a jugé).
- ✅ Fraîcheur : écriture faite par Tentacle → `onContentPolicyInvalidated` (socle) fait tomber sur-le-champ
  relevé `userAccess`, verdicts de visibilité, index et page des recos ; changement fait dans Jellyfin →
  l'empreinte de la politique, relue toutes les 30 s (`itemAccess/policyWatch.ts`).
- ✅ `reco/people/*` : « connu pour » d'une personne TMDB vidé pour un compte restreint.

**Affiner (`routes/swipe.ts`, `services/swipe/**`)**
- ✅ Pile : pool + `/trending` et `/top_rated` TMDB (cache global 6 h) → mêmes deux filtres
  avant `mixDeck`. ✅ `details/:type/:tmdbId` : jamais le synopsis d'un titre caché, même accolé
  à un id visible.

**Saga, collections, saisons manquantes**
- Membres de bibliothèque : `getUserAccess` — correct.
- ✅ `GET /api/sagas/:id` → `parts` TMDB rend TOUS les volets, interdits compris (« Demander »
  sur l'Apple TV) → garder un volet s'il est membre visible, sinon s'il n'est pas caché dans la
  bibliothèque ET passe `filterExternalTitles`.
- 🔌 Saisons manquantes (`titles.gaps`) : calculées par Vigie → chantier Vigie (pont).

**Recherche (`services/search/**`)**
- Catalogue commun relevé au nom de l'admin, filtré à chaque réponse par `getUserAccess` (sans
  `ids=`) ; épisodes par clé + `userId` du compte — correct. ✅ Fraîcheur (cf. recos).
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
- ✅ `GET /api/tmdb/trailers` : vidéos de tout `tmdbId` → `allowsExternalTitle`.

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
  du compte — correct (garde 10 min, ✅ périmée au changement de politique). ✅ Par `tmdbId` :
  aperçu et catalogue refusés pour un titre caché, rien n'est décidé ni cherché.
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

## 9.1 Accès du compte (lot « droits 2 », S1 — 2026-10-15)

Désactivé, hors de ses plages horaires : le compte ne se sert plus de Tentacle, et une page
le lui dit à la place de l'application. Sessions simultanées et essais avant blocage :
une NOUVELLE connexion est refusée en mots clairs.

### 9.1.1 Mesuré sur Jellyfin 10.11.11 (jetable, source relue)

- **Désactiver** (`IsDisabled`) RÉVOQUE tous les jetons du compte (`RevokeUserTokens`) :
  `/Users/Me` → 401, et toujours 401 après réactivation (web et bureau se reconnectent ; une
  TV jumelée, jeton Tentacle, reprend seule). Connexion d'un compte désactivé → 403
  « Error processing request. », quel que soit le mot de passe.
- **Hors plage** : un jeton ouvert prend 403 partout (sauf `/System/Info`), rien ne dit à
  quel compte il appartient ; revenu dans la plage, le même jeton reprend. Connexion → 403.
  **Un administrateur** hors plage garde son jeton ouvert (200, exempté par
  `BaseAuthorizationHandler`) mais ne peut plus se connecter (403).
- **Sessions simultanées** : `Sessions.Count(UserId == compte) ≥ MaxActiveSessions` refuse
  la nouvelle connexion (403) — TOUTES les sessions en mémoire, même appareil compris.
  Une session HTTP seule ne cesse de compter qu'à la déconnexion, à la révocation de son
  appareil ou au redémarrage de Jellyfin ; avec une socket Jellyfin, à sa fermeture.
  `GET /Sessions` (clé d'API) les rend toutes. Quick Connect (jeton propre d'une TV) passe
  par la même garde.
- **Essais avant blocage — cassé en 10.11.11** : `InvalidLoginAttemptCount` avance (lisible
  dans la Policy), Jellyfin journalise « Disabling user … » mais ne désactive pas (entité
  `AsNoTracking`) ; une réussite ne remet pas toujours le compteur à 0. Corrigé sur
  `master` (Jellyfin 12). `LoginAttemptsBeforeLockout` : -1 = jamais, 0 = 3.

### 9.1.2 Contrat — `packages/shared/src/accountAccess/` (miroir backend, test miroir)

- `AccountAccessState` = `{ state: "allowed" }` | `{ state: "disabled", lockedOut? }` |
  `{ state: "outsideSchedule", schedules, nextOpening }` — plages en heures LOCALES du
  serveur ; `nextOpening` en ms, `null` = jamais (sentinelle `GUEST_SCHEDULE_NEVER`) ou
  inconnue (`schedules` vide : jeton dont le serveur a oublié le compte).
- Règle PURE (`accountAccessRule.ts`, horloge et fuseau injectés) : `isWithinSchedules`
  (Jellyfin : `TotalHours`, secondes comprises, bornes incluses), `nextScheduleChange`,
  `nextScheduleOpening`, `accountAccessOf` (illisible = permis : une panne ne met personne
  dehors), `reachedLoginAttempts`. `scheduleAllows` du filtrage y délègue : UNE règle.
- Route `GET /api/account/access` ; refus 403 `{ error: "account_access", …état }` ;
  annonce `{ type: "account:access", …état }` ; `auth_error` `account_access` ; fermeture
  4012. Connexion refusée : `{ message, code, maxSessions? }`, codes `account_disabled`,
  `account_locked_out`, `account_outside_schedule`, `account_max_sessions` (403) ; Famille :
  `family.max_sessions`. Capacité `account.access`.
- Vue client (`accountAccessView.ts`, pas de miroir) : lignes de plages, réouverture
  relative (aujourd'hui, demain, plus tard, jamais, inconnue) ; mots : espace `accountAccess`.

### 9.1.3 Serveur

- **Portes** (`services/accountAccess/`) : `requireAuth`, `requireAdmin`,
  `requirePersonalAdmin`, la Famille (`familyCaller`, sauf le sélecteur des TV), le proxy
  (jeton d'appareil ; jeton Jellyfin refusé par Jellyfin dont le compte est connu et
  bloqué), les vignettes, le socket. **Administrateurs compris** (décision du lot) ;
  « voir en tant que » non borné (l'administrateur regarde). Ouvertes : la route d'état,
  `POST /api/auth/logout`, `POST /api/pair/self/revoke` ; `POST /api/auth/refresh` dit 403
  au lieu de 401. Aucun jeton révoqué par Tentacle.
- **Le compte d'un jeton Jellyfin** (`tokenOwners.ts`) : chaque jeton vu valide est retenu
  (empreinte, 2 000 au plus) — c'est lui qui transforme un 403/401 de Jellyfin en
  « compte bloqué ». Après un redémarrage pendant la fermeture : « hors plage, plages
  inconnues » (le client relit toutes les cinq minutes).
- **Annonce** (`accessWatch.ts`), comptes connectés seulement : un minuteur sur le bord de
  plage le plus proche, l'invalidation faite par Tentacle, et un guet d'UNE lecture de
  `/Users` par minute (Jellyfin n'annonce aucun changement de politique), comparé à ce que
  la dernière évaluation a vu. Bloqué : `account:access`, sortie de Watch Together sans
  grâce (`ejectFromRoom` de § 9.2, raison `access_revoked`), **position de lecture écrite par la clé d'administration** (le rapport d'arrêt du
  compte serait refusé — « Reprendre » restait vide), puis sockets fermées (4012).
  Un changement fait dans Jellyfin se voit en 30 s (cache) à 90 s au plus.
- **Essais avant blocage, tenus par Tentacle** (`loginLockout.ts`, décision du coordinateur) :
  Jellyfin 10.11.11 compte mais ne bloque pas (bug corrigé en 12). Pour les connexions qui
  passent par Tentacle (web, bureau et mobile par le proxy) : après un mot de passe faux, la
  politique relue ; compteur ≥ limite (> 0) et compte actif → `IsDisabled=true` par la
  réécriture complète de la politique, et le refus dit « Ce compte est bloqué après trop
  d'essais ». Après une réussite, le compteur remis à 0 par la politique (mesuré : il tient,
  même après plus d'une minute d'activité). Un compte ACTIF au compteur resté plein — réactivé
  par la fiche des droits (écouteur `onPolicyWritten`) ou dans Jellyfin (avant la connexion
  suivante) — repart de 0 : il ne se rebloque pas au premier échec. Jellyfin refuse de
  désactiver un administrateur : il ne l'est pas. **Hors de portée** : une connexion faite
  directement à Jellyfin (son interface, une autre application) — Jellyfin 10.11 compte sans
  bloquer, et Tentacle ne l'apprend qu'à la connexion suivante par lui.
- **Jeton révoqué à la désactivation** : la politique gardée (30 s) peut dater d'avant ; un
  refus de Jellyfin pour un compte connu « permis » la fait relire (5 s au plus par compte).
- **Nouvelles connexions** (`connectRefusal.ts`) : un 403 de Jellyfin à la connexion (web,
  bureau par le proxy) est relu — désactivé (bloqué si le compteur a atteint la limite),
  hors plage, trop de sessions. Sans mot de passe, la règle de Jellyfin appliquée par
  Tentacle : jumelage (`generate`, `claim`, `tv-token`, `device/confirm`), code de
  connexion, ouverture d'un profil de la Famille (sessions seulement : un profil bloqué
  s'ouvre et sa page le dit).

### 9.1.4 Clients

- api-client : `useAccountAccess({ enabled })` — la route au montage, l'annonce et le refus
  du socket, TOUTE réponse 403 `account_access` (client Jellyfin par le proxy,
  `tentacleApiFetch`) ; bloqué, la route est relue à `nextOpening` + 2 s, au plus toutes
  les cinq minutes ; revenu : requêtes invalidées, socket rouverte avec le même jeton.
  `JellyfinError.refusal` porte une connexion refusée.
- Web et bureau, désactivé : la page dit que Jellyfin a fermé les sessions du compte. À la
  réactivation, la route répond 401 (jeton révoqué) : la page devient « Ce compte a été
  réactivé » avec « Se reconnecter » — jamais une app à moitié connectée sur un jeton mort.
- Web et bureau : `AccountAccessGate` (`main.tsx`) REMPLACE l'application — tout est
  démonté (lecteur web, mpv, PiP, miroir, fenêtres du démarrage), `/watch` quitté.
  « Se déconnecter », « Changer de serveur » (bureau), « Changer de profil » (session de
  profil). La page de connexion dit le refus en mots.
- Apple TV / Android TV : tv-core `decideAccountAccessScreen` (la page remplace les écrans,
  ne cède PAS au lecteur — l'écran de lecture se ferme —, focus d'entrée sur l'action,
  Retour jamais pris) ; `AccountAccessRedesign` l'applique. Les actions suivent la session :
  « Changer de profil » d'une session de profil, puis « Se déconnecter du serveur »
  (déjumelage, double appui) pour le compte qui a jumelé la TV ; la session « solo » du compte
  (ouverte d'office, sans famille) et une TV d'avant les profils : le déjumelage seul —
  « Qui regarde ? » n'y rendrait que ce même profil bloqué (vu au simulateur).
- « Jumeler votre TV » (web) et la connexion disent un refus par sa raison
  (`accountAccess:refusals.*`), jamais « erreur du relais » ni « identifiants invalides ».
- Mobile : rien (hors périmètre) ; il reçoit des 403 au lieu des 401 d'avant.

### 9.1.5 Prouvé (Jellyfin 10.11.11 jetable, serveur jetable, web et simulateur tvOS cloné)

- Web : plage qui se ferme pendant une lecture → page au bord (minuteur), lecteur quitté,
  position gardée (« Reprendre » à 30 %) ; réouverture → page levée seule, socket rouvert,
  aucune reconnexion. Désactivé pendant la session → page en 13 s (guet) ; « Se
  déconnecter » ; reconnexion refusée « Ce compte a été désactivé… ». `MaxActiveSessions = 1` :
  2e connexion et jumelage refusés en mots.
- Apple TV : même plage pendant une lecture → page, lecteur fermé, position gardée (4:57),
  page levée à la réouverture ; désactivé → page, levée ≤ 5 min après la réactivation, sans
  rejumelage ; « Se déconnecter du serveur » → écran de jumelage.
- Essais : à travers Tentacle, le compteur avance d'exactement 1 par essai (ni masqué ni
  doublé). Tentacle bloque au 3e mot de passe faux (`LoginAttemptsBeforeLockout = 3`), par la
  connexion web comme par le proxy du bureau ; le bon mot de passe est ensuite refusé
  « bloqué après trop d'essais » ; réactivé par la fiche des droits, le compteur est à 0 et un
  mot de passe faux ne rebloque pas. Le limiteur de Tentacle (5 connexions par minute et par
  adresse) arrête un essai AVANT Jellyfin : le compteur n'avance pas — rien n'est masqué.

### 9.1.6 Restes

- La page d'un compte DÉSACTIVÉ sur le web dure tant que la session vit ; réactivé, son
  jeton (révoqué par Jellyfin) mène à la connexion.
- « Bloqué après trop d'essais » se lit sur le compteur de Jellyfin (`InvalidLoginAttemptCount
  ≥ LoginAttemptsBeforeLockout`) : un compteur laissé plein par une connexion directe à
  Jellyfin 10.11 peut faire dire « bloqué » à un compte désactivé à la main.

- Un changement de plages fait par l'administrateur pendant la fermeture n'atteint un client
  qu'à sa relecture (au plus cinq minutes) : son socket est fermé.

## 9.2 Lecture et Watch Together

> Lot « droits 2 » (2026-10-15), chantier S2. Capacités `watchTogether.access` et
> `playback.rights` (1.30.0) ; sans elles, chaque client fait comme avant.

### 9.2.1 Ce que Jellyfin 10.11 applique seul (mesuré sur 10.11.11 jetable, source relue)

| Droit | `PlaybackInfo` | Flux, jeton du COMPTE | Flux, clé d'API (`userId`) |
|---|---|---|---|
| `EnableMediaPlayback` | rien (seul `PlayAccess: None` d'une fiche) | **servi** (200) | **servi** |
| Un seul droit de conversion coupé | `TranscodingUrl` offerte quand même | image / son **copiés de force** (`TryStreamCopy`) : flux illisible ; remux jamais gardé | **rien de gardé** (`state.User` vide) |
| Les trois coupés | `SupportsTranscoding=false`, rien de jouable, pas d'`ErrorCode` | idem | idem |
| `RemoteClientBitrateLimit` (0 = celui du serveur) | plafond jugé sur l'IP qui parle à Jellyfin (`X-Forwarded-For` de ses `KnownProxies`) | — | — |
| `ForceRemoteSourceTranscoding` | appliqué aux sources `IsRemote` (TV en direct, `.strm`) | — | — |

Derrière le proxy, Jellyfin voit Tentacle (adresse locale) : le plafond distant n'y valait jamais.
Le bureau (mpv), l'Apple TV (PrismCore) et l'Android TV fabriquent leurs URL sans `PlaybackInfo` :
rien ne les jugeait.

### 9.2.2 La règle — une seule, partagée

- Contrat `packages/shared/src/playback/playbackRights.ts` (miroir `apps/backend/src/playback/`) :
  `PlaybackRights` (`mediaPlayback`, `videoTranscoding`, `audioTranscoding`, `remuxing`,
  `maxBitrate` du client), refus `playback_not_allowed` / `conversion_not_allowed` (403 `{ code }`),
  `streamConversions(path, query, source)` (ce qu'une URL de flux fait faire au serveur, d'après
  `CanStreamCopyVideo/Audio` de Jellyfin : codec, copie permise, définition, débit, canaux, incrustation ;
  elle penche vers la COPIE quand elle ne sait pas), `playbackRefusal(rights, conversions)`.
- Un changement de conteneur (« remux ») = un flux qui ne réencode NI l'image NI le son ; un réencodage
  permis emporte le conteneur. Un remux FAIT SUR L'APPAREIL (PrismCore) ne demande rien au serveur.
- `rightsQuality.ts` : sans droit de réencoder, « Originale » seule ; le plafond borne l'échelle et
  impose un palier dès que la source le dépasse, même en « Originale » choisie à la main.
  `rightsVerdict.ts` : `negotiatedRefusal` (proposition de Jellyfin), `builtUrlRefusal` (URL fabriquée),
  `upfrontRefusal` (la fiche suffit), `rightsBitrate`.
- `planStream` / `engineTranscodingProfiles` ne changent pas : les droits jugent ce qu'ils produisent.

### 9.2.3 Le serveur

- `GET /api/playback/rights` : les droits du compte pour CE client. Politique relue par la clé
  d'administration (`/Users/{id}`), 30 s, oubliée à chaque écriture de Tentacle ; illisible : tous les
  droits (Jellyfin décide, comme avant — la visibilité du titre reste fermée à l'échec).
- **Plafond** : celui du compte, sinon celui du serveur ; client « local » = règle de Jellyfin
  (`LocalNetworkSubnets` et ses exclusions `!`, sinon RFC 1918 + ULA + site local + boucle), sur
  l'adresse RÉELLE (`getRealClientIp`). Docker Desktop / colima perdent l'adresse source : tout y paraît local.
- **Porte du proxy** (`jellyfinProxy/playbackGate.ts`, à la place de l'appel à `streamRefused`) :
  titre caché → 404 (inchangé) ; lecture interdite → 403 sur `PlaybackInfo`, flux, sous-titres, audio ;
  conversion refusée → 403 ; ce qui passe sans le droit de réencoder part en copie forcée
  (`VideoCodec=copy`, `AudioCodec=copy` — la règle de Jellyfin pour un jeton de compte, désormais
  aussi derrière la clé prêtée) ; plafond posé sur `MaxStreamingBitrate` de `PlaybackInfo` et sur les
  débits d'un flux converti. Les pistes de la source ne sont lues (10 min) que pour un compte à qui
  une conversion est refusée : un compte sans restriction ne coûte aucune requête.
- **Le fichier tel quel (`Static=true`) n'est pas plafonné** — Jellyfin non plus ; les lecteurs lisent
  leur plafond et choisissent un palier dessous.
- **Accepté** : la porte DIRECTE de Jellyfin (lecture directe avec le jeton du compte) reste hors de
  portée de Tentacle (§ 7.1, règle 3) ; Jellyfin y applique son plafond (il voit l'adresse) et sa
  copie forcée ; nos lecteurs jugent les droits avant d'y aller.
- `ForceRemoteSourceTranscoding` : Jellyfin l'applique dans `PlaybackInfo` ; rien d'ajouté. Un lecteur
  qui fabrique son URL statique (mpv) ne le voit pas — Tentacle n'expose ni TV en direct ni `.strm`.
- **Bandes-annonces** : celles de YouTube relayées ne sont PAS des médias de la bibliothèque — gardées
  pour un compte sans lecture (une affiche animée publique, sans conversion) ; les bandes-annonces
  LOCALES de Jellyfin sont des flux du proxy : refusées comme le reste.
- Un fichier gardé hors ligne (bureau) se lit sans le serveur : ses droits n'y ont plus prise.

### 9.2.4 Les lecteurs (web, bureau, Apple TV ; Android TV reçoit la même garde)

- Crochet `usePlaybackRights()` (api-client) ; rien ne se négocie avant de connaître les droits.
- Web : la `TranscodingUrl` de Jellyfin jugée telle qu'elle partira ; le débit demandé borné. Bureau
  (mpv) : l'URL fabriquée jugée. Apple TV : refus d'avance, PrismCore libre, chemin serveur jugé — et
  sans droit de réencoder, le repli demande une COPIE au lieu du HLS 8 Mb/s réencodé.
- Messages (modèle partagé des problèmes) : « La lecture n'est pas autorisée pour ce compte. » ;
  « Ce titre doit être converti pour être lu sur cet appareil, et votre compte ne le permet pas. »,
  avec l'aide « L'administrateur peut l'autoriser dans Jellyfin, dans les droits de lecture de votre
  compte. » Apple TV : cadenas, Retour seul (pas de « Réessayer »). Un 403 du proxy sans verdict
  préalable est lu par la sonde du flux (`{ code }`). Les boutons Lire des cartes restent.

### 9.2.5 Watch Together

- Tentacle n'emploie PAS le SyncPlay de Jellyfin (salons, synchronisation et protocole `wt:*` sont à
  lui) ; il en suit le droit : `SyncPlayAccess` → `full` (`CreateAndJoinGroups`), `joinOnly`
  (`JoinGroups`), `none` (`None`, et toute valeur absente). Contrat
  `packages/shared/src/types/watchTogetherAccess.ts` (miroir), `GET /api/watch-together/access`.
- Serveur : créer un salon et inviter → 403 `access_denied` hors `full` ; accepter → refusé à `none` ;
  `none` n'est ni candidat (`/users`), ni invité, ni prévenu (invitation différée comprise), et
  `/invites` lui rend une liste vide. Comme Jellyfin, le droit se juge à la création et à l'entrée :
  un hôte qui perd `full` garde son salon (sans plus inviter) ; un membre passé à `none` en sort
  (`wt:dissolved`, raison additive `access_revoked`) — aussitôt après une écriture de Tentacle, au guet
  de 30 s sinon (une lecture de `/Users`, seulement tant qu'un salon existe). `ejectFromRoom(userId,
  reason)` (`services/watchTogether/accessWatch.ts`) sert aussi à qui doit sortir un compte d'un salon.
- Web et bureau : `none` → plus aucune trace (bouton de la barre, fiche, invitations, socket,
  relecture au démarrage) ; `joinOnly` → ni « Créer un groupe », ni bouton de la fiche, ni « Inviter » :
  « Votre compte peut rejoindre un groupe quand on vous y invite, mais pas en créer un. »
- Apple TV et Android TV : Watch Together n'y existe pas — rien à masquer. Les invités de la Famille
  ont `SyncPlayAccess: None` : la règle les couvre aussi.

### 9.2.6 Hors ligne (`EnableContentDownloading`)

Vérifié sur Jellyfin jetable : `GET /api/downloads/capabilities` rend `downloads: false` et
`/api/downloads/original/:id` 404 pour un compte sans le droit ; les quatre entrées « garder hors ligne »
du bureau (carte, fiche, saison, épisode) lisent `canDownload` et disparaissent (un titre déjà gardé reste
lisible). Le web n'a pas de hors ligne. Rien de changé.

## 9.3 Fiche des droits et partage public (lot « droits 2 », S3)

### La fiche ne nomme que ce qui agit dans Tentacle

- **Retirés du contrat `USER_RIGHTS_FIELDS`** (et de la fiche, miroir recopié) : `isHidden`,
  `enableAllChannels`, `enabledChannels`, `enableCollectionManagement`, `enableSubtitleManagement`,
  `enableLyricManagement`, `enableLiveTvAccess`, `enableLiveTvManagement`,
  `enableRemoteControlOfOtherUsers`, `enableSharedDeviceControl`. Propres à Jellyfin ou sans geste
  chez nous : Tentacle n'affiche aucune chaîne Jellyfin (`UserRightsOptions.channels` et la lecture de
  `/Channels` partent aussi), et **aucun geste de Tentacle ne pilote un appareil partagé** (la seule
  télécommande est celle du tableau de bord, par la clé d'administration) — « Appareils partagés »
  est donc retiré, pas branché. La réécriture garde ces champs tels que Jellyfin les tient (testé) ;
  le § 3.1 est à lire sans eux. Un correctif qui en nomme un est refusé comme une clé inconnue.
- **Gardés, expliqués en une phrase juste** : désactivé, accès à distance, sessions simultanées,
  essais avant blocage (0 = 3 essais, mesuré par S1), administrateur, bibliothèques, les six de la
  lecture, hors ligne (« version légère » exige aussi conversion vidéo ou changement de conteneur,
  `capabilitiesFromPolicy`), suppression, partage public.
- **Watch Together** (`syncPlayAccess`) : jamais « SyncPlay » ; trois choix en boutons radio, chacun
  avec sa phrase (`ChoiceRight.tsx`). L'application est celle de S2.
- **`self_lockout` s'étend aux plages horaires** (demande du coordinateur : S1 applique les plages
  à TOUS les comptes, administrateurs compris, même connectés) : un administrateur qui se règle
  lui-même ne se pose pas un programme d'accès qui l'exclut À L'INSTANT (heure locale du serveur).
  Règle pure et partagée `selfLockoutKeys` / `schedulesAllowAt` (`userRightsPatch.ts`, miroir ; la
  règle de Jellyfin, bornes incluses), rejouée par le serveur avant toute lecture ; un programme qui
  le couvre maintenant passe (il se coupera plus tard : c'est son choix). La fiche, sur son propre
  compte, l'avertit sous l'aide (« Ces plages s'appliquent aussi à vous… ») et dit ce refus en clair
  (`refusal.self_lockout_schedule`).
- **Emplacement des droits de la Famille** : `UserRightsPanel.tsx`, dans la liste des rubriques,
  juste après « Gestion » (commentaire « Emplacement des droits de la FAMILLE ») — une ligne.

### Le contrôle parental, comme Jellyfin le montre

Relevé sur l'onglet « Contrôle parental » d'un Jellyfin 10.11.11 jetable, en français :

- Ordre : classification maximale, types non classés bloqués, étiquettes autorisées, étiquettes
  bloquées, programme d'accès — avec les libellés et aides de Jellyfin (coquille « comportants »
  corrigée).
- **Classification** : la table de `/Localization/ParentalRatings` (« Unrated » exclu), un niveau
  par couple (score, sous-score), tous ses noms réunis par « / » (« 0+/Public Averti/Tous Publics/TP/U »).
  Jellyfin n'a PAS de liste de sous-classification à part : la sous-note se choisit avec le niveau
  (table US : « TV-14 » ≠ « TV-14-D/TV-14-L/… »). Choisir un niveau écrit son score et sa sous-note
  (`null` s'il n'en a pas), comme Jellyfin.
- **Types non classés** : les sept de Jellyfin, dans son ordre et ses mots — Livres (`Book`),
  Chaînes (`ChannelContent`), TV en direct (`LiveTvChannel`), Films, Musique (Jellyfin laisse
  « Music » non traduit), Bandes-annonces, Séries ; `LiveTvProgram` et `Other` ne paraissent que
  s'ils sont posés (par l'API), décochables.
- **Programme d'accès** : jours dans l'ordre de Jellyfin (dimanche → samedi, Tous les jours, Jours
  de la semaine, Week-ends — précisés « (lun. → ven.) », « (sam., dim.) »), heures à la demi-heure
  écrites « 8:00 », la fin de journée 24 écrite « 0:00 » comme Jellyfin, ligne « 8:00 - 20:30 ».
- Le dialogue des invités de la Famille emploie les mêmes champs : il en hérite.
- **Prouvé dans les deux sens** (Jellyfin jetable `jf-fiche`, Tentacle jetable) : la fiche écrit 12,
  Livres + Séries, « famille » autorisée, « horreur » bloquée, Jours de la semaine 8:00 - 20:30 →
  relus tels quels dans le tableau de bord ; le tableau de bord écrit 16, Films + Séries,
  Week-ends 10:00 - 0:00 → relus tels quels dans la fiche. Watch Together « Rejoindre seulement »
  écrit par la fiche → « Autoriser l'utilisateur à rejoindre un groupe » dans Jellyfin.

### Le partage public (`enablePublicSharing`) — capacité `share.publicRight` (1.30.0)

- **Jellyfin 10.11 ne montre pas ce droit** dans son tableau de bord (relevé) : la fiche de Tentacle
  est le seul endroit où il se règle ; un compte neuf l'a (défaut de Jellyfin `true`).
- **Il garde TOUT lien public** (`share_links` : Ma liste, favoris, statistiques — décision du
  coordinateur).
- **Serveur** (`routes/share.ts`, `routes/shareStats.ts`, `services/share/publicSharingRight.ts`) : le droit est relu dans
  la politique du compte par la clé d'administration, gardé 30 s, oublié à toute écriture de
  politique faite par Tentacle (`onContentPolicyInvalidated`), FERMÉ à l'échec (5 s). Sans lui :
  `POST /api/share/`, `/api/share/likes/` et `/api/share/stats` → 403 `public_sharing_denied` ; un
  lien existant → 403 `share_unavailable` (la page ET la fiche d'un titre), sans rien de ce qu'il
  montrait ; le lien n'est pas détruit et revient avec le droit. `GET /api/share/access` →
  `{ publicSharing }` (pas de route commune « mes droits » : chaque domaine lit le sien).
- **Au nom du propriétaire, dans ses restrictions** : Jellyfin filtre ses favoris et Ma liste
  (`userId`) ; ses likes hors bibliothèque passent `filterExternalTitles(propriétaire, …)`.
- **Page autonome** (`static/sharePage*.ts`) : interface web coupée, `/share/<jeton>` (et la fiche
  `/share/<jeton>/<titre>`) reçoit la liste écrite par le serveur — FR/EN, AUCUN script, style sous
  nonce, `default-src 'none'`, affiches `/api/jellyfin/Items/<id>/Images/Primary` (sans jeton ni
  adresse de Jellyfin) ou TMDB à l'adresse exacte ; jamais en cache ni indexée ; « Lien
  introuvable » (404), « Lien indisponible » (403, statistiques comprises), panne (502) ; un lien de
  statistiques renvoie au client web. Interface web allumée : la page du client web, inchangée.
  Branchée dans `staticClients.ts` comme la page d'invitation, et nommée dans la liste de
  `static/webUi.ts` — PAS parmi les préfixes toujours servis, qui rendraient le client web.
- **Web / bureau** : `usePublicSharingAllowed` (api-client) — serveur qui déclare la capacité : le
  droit lu ; serveur d'avant : comme avant (boutons montrés). « Partager ma liste », « Partager mes
  titres likés » (page large et fenêtre étroite) et « Partager » des statistiques n'existent qu'avec
  le droit ; copier et révoquer
  restent dans la fenêtre de partage. La page publique dit « Partage indisponible ». Mobile et TV
  non touchés : le serveur refuse, c'est tout.
- **Prouvé** (Tentacle jetable, interface web coupée par `tentacle web off`) : lien créé, page
  autonome ouverte sans session ; droit coupé dans la fiche → API et page « indisponible », boutons
  disparus, création refusée ; droit rendu par l'API de Jellyfin → liste revenue ; révocation → 404.

## 9.4 Famille : parents, mineurs, droits de création

Lot « droits 2 », chantier S4 (2026-10-15). Contrat : `packages/shared/src/family/familyRoles.ts`
(miroir), ré-exporté par `familyContract.ts`. Capacités `family.roles`, `family.memberParental`,
`family.creationRights` (1.30.0). Banc réel : `apps/backend/test/famille-roles/banc/`.

### 9.4.1 Droits de création — gardés par Tentacle, pas par Jellyfin

- Par compte : `createFamily` et `createGuests`, chacun `inherit | allow | deny` (table
  `family_account_rights`, sans ligne = `inherit`). `inherit` suit le DÉFAUT de l'administration
  (`server_config` : `family_default_create_family`, `family_default_create_guests`, clé absente =
  NON — installation neuve comme mise à jour).
- La règle (`resolveFamilyCreation`, pure, partagée) : interrupteurs d'abord (« Familles » coupé =
  personne ; « Profils invités » coupé = aucun invité), puis administrateur Jellyfin (toujours),
  puis le réglage du compte, puis le défaut. Jellyfin muet : on ne le sait pas administrateur —
  son réglage et le défaut décident.
- Ce qui se garde : FONDER une famille (première invitation, premier invité d'un compte sans
  famille) et CRÉER un invité. Une famille existante invite encore ; rien de ce qui existe ne
  tombe. Créer un invité exige le droit du compte ET, pour un simple membre, la permission du
  propriétaire (`FamilyMemberRights.createGuests`) ; un parent l'a d'office.
- Refus : `family.create_family_denied`, `family.create_guests_denied` (403), le droit de compte
  jugé AVANT la permission du propriétaire. `FamilyAccountDto.creation` dit aux clients ce qui
  vaut ; `familyRightsOf` reçoit `{ parent, creation }`.
- Administration (`requirePersonalAdmin` par l'appelant `admin` : jamais une TV) :
  `GET|PUT /api/admin/family/creation` (les défauts), `GET|PUT /api/admin/family/accounts/:userId`
  → `AccountFamilyRightsDto` (`rights`, `defaults`, `allowed`, `isAdministrator`, sa place dans
  une famille, `restrictedBy`). Un invité de la Famille ne se règle pas (`family.guest_account`).

### 9.4.2 Le rôle de PARENT

- `family_members.isParent`, posé par le propriétaire SEUL (`PUT /api/family/members/:userId/role`,
  personnel). `FamilyProfileDto.parent`, `FamilyDto.parent` (additifs).
- Un parent gère les ENFANTS : `manageGuests: "all"` (droits, photo, PIN, contrôle parental,
  suppression d'un invité) et `manageMinors` (contrôle parental des membres mineurs) ; il crée des
  invités s'il en a le droit de compte. Restent au propriétaire : inviter, retirer, nommer un
  parent (`manageRoles`), dissoudre. Jamais un membre sous contrôle parental
  (`family.member_parental_refused` : le retirer d'abord).
- Depuis SON profil (TV ou bureau, `memberProfile`, 1.30.0 `family.profileManage`), derrière
  SON code PIN, un parent fait les mêmes gestes que dans sa session personnelle : invités
  (création, suppression, droits, PIN, photo, contrôle parental) et membres mineurs
  (docs/FAMILLE.md, « Gérer depuis un profil »).

### 9.4.3 Le MEMBRE mineur — base gardée, puis rendue

- Posé par le propriétaire ou un parent (`PUT /api/family/members/:userId/parental`, corps =
  `GuestParentalControls` ENTIER ; aucun réglage = retiré), sur un membre qui n'est ni le
  propriétaire, ni un parent, ni un administrateur Jellyfin (`family.member_parental_refused`).
  Réponse `GuestParentalDto` : `parentalCeiling` = SA politique de base.
- Écrit dans SA politique Jellyfin — sinon ses appels directs à Jellyfin ne seraient pas filtrés
  — comme `effectiveGuestParental(base, voulu)` : la règle des invités, la base à la place du
  créateur. Ses invités suivent sa politique effective (leur plafond, c'est lui).
- Table `family_member_parental` : `controls` (le voulu ; null = retiré, base à rendre), `base`
  (les six champs parentaux de l'administrateur), `written` (la dernière écriture relue),
  `restorePending`. Gardé D'ABORD, écrit ensuite, relu (refus si Jellyfin ne l'a pas retenu).
- **Un champ qui diffère de la dernière écriture a été changé ailleurs : il devient la base**
  (`rebaseMemberParental`, pure). Note et sous-note chacune pour soi (relever la note seule ne
  fait pas entrer la sous-note de la famille dans la base — prouvé, « Approved » en a une). Pour
  les listes que la famille allonge (types non classés, étiquettes bloquées) : la liste lue MOINS
  ce que la famille y avait ajouté. Étiquettes permises et plages : la valeur lue.
- Quatre moments, un seul geste (`settleMemberParental`) : la pose ou le retrait ; toute écriture
  faite par Tentacle (`notePolicyWritten` — le membre D'ABORD, ses invités ensuite) ; l'ouverture
  d'un profil de ce membre (TV, bureau) ; le guet des deux minutes (`resyncMemberParental`, une
  lecture de `/Users`, rien s'il n'y a aucune ligne), qui rejoue aussi les bases à rendre.
- **Rendue à l'identique** : contrôle retiré, membre parti ou retiré, famille dissoute → la ligne
  passe « à rendre » (durable), la base est réécrite, relue, la ligne effacée ; Jellyfin muet : le
  guet la rend à son retour. Compte disparu de Jellyfin : la ligne s'efface. Un membre devenu
  administrateur Jellyfin APRÈS la pose garde son contrôle (rien ne se relâche en silence).
- L'état se lit avec le membre (`parental`, `parentalCeiling`), au propriétaire et aux parents
  seulement — ni au membre lui-même, ni à un autre membre.

### 9.4.4 Les clients

- Web et bureau : Réglages › Famille (`ProfileRow`) — le rôle (interrupteur « Parent » du
  propriétaire, grisé et expliqué tant qu'un contrôle restreint le membre), « Contrôle parental »
  d'un membre (l'éditeur des invités, plafonné par la base, « Retirer le contrôle »). Admin ›
  Comptes : les deux défauts à côté des interrupteurs. Fiche d'un compte : la rubrique « Famille »
  (`AccountFamilyRightsGroup`, `components/admin/users/familyRights/`), repliable comme les six
  rubriques de Jellyfin et montée après « Gestion » (§ 9.3) — résumée en une ligne (ce qui vaut,
  « restreint par la famille de … »), ouverte : les deux droits en boutons radio expliqués.
- TV et mobile : rien à régler ; DTO additifs, typecheck verts. Un refus de création s'y dit par
  son code (`family:errors.create_*_denied`).

### 9.4.5 Preuves

- Bancs : `familyCreationRights`, `familyParentRole`, `familyMemberParental` (routes, base gardée
  puis rendue, administrateur par Tentacle et par Jellyfin, départs, Jellyfin muet, invités qui
  suivent), `memberParentalRules.test.ts` ; shared : `familyRoles.test.ts`,
  `familyRolesClient.test.ts`.
- Jellyfin 10.11 jetable (`famille-roles/banc`, 2026-10-15) : « TOUT EST PROUVÉ » — dont un membre
  « ≤ 6 ans » relu dans Jellyfin, ses titres filtrés par Jellyfin avec SON jeton (G seulement),
  base rendue à l'octet près (hors `Id` des plages), un parent qui règle un invité, un compte sans
  droit qui tente de fonder une famille (403) ; guet : changement direct dans Jellyfin repris en
  ~100 s.

## 9.5 Contrôle parental de bout en bout (lot « droits 2 », chantier S5)

Prouvé contre une bibliothèque RÉELLE, et rejouable : `pnpm --filter @tentacle-tv/backend
bench:parental` (`apps/backend/test/parental-bench/README.md`, jamais lancé par `pnpm test`).
Jellyfin 10.11.11 jetable, médiathèque factice aux classifications françaises de sa table (`U`,
`6+`, `10`, `12`, `16`, `18`, `X`, et AUCUNE), une étiquette bloquée, de vrais identifiants TMDB,
quatre bibliothèques dont deux refusées ; le vrai backend du dépôt, Vigie installée devant un faux
Jellyseerr aux identifiants TMDB réels, un passé d'avant la restriction (vus, en cours, favoris,
séances mesurées, avis). **La référence est Jellyfin** : ce que son API montre au compte par SON
jeton ; chaque réponse de Tentacle est lue en entier (ids, noms), et chaque titre extérieur passe un
oracle TMDB indépendant du cœur (FR, sinon US ; ≤ 6 ans ; jamais `adult` ni sans classification).

### 9.5.1 Ce que Jellyfin ne borne pas aux bibliothèques (mesuré, complète le § 7.1)

Jellyfin n'applique les bibliothèques permises qu'aux requêtes qui ne nomment ni parent, ni ids, ni
série (`AddUserToQuery`). Avec une bibliothèque refusée au compte :

| Requête | Jeton du compte | Clé prêtée + `userId` (TV, profil, « voir en tant que ») |
|---|---|---|
| `Items?Ids=…` | **servie** | **servie** |
| `Items/Latest?ParentId=<refusée>` | **servie** | **servie** |
| `Items?ParentId=<refusée>` | 401 | **servie** |
| `Shows/{série refusée}/Episodes`, `Shows/NextUp?SeriesId=` | **servie** | **servie** |
| `Items/{id}`, `PlaybackInfo`, `Similar`, `Ancestors` | 404 | 404 |
| `Items/{id}/Images/*` | 404 | 200 — et 200 SANS jeton : public, hors de portée |

Note, étiquettes et non classés sont, eux, appliqués partout (un épisode classé « 16 » d'une
série « U » est caché seul).

### 9.5.2 Fuites fermées (un commit chacune, avec son test)

1. **Proxy — listes nommées** (`jellyfinProxy/libraryListGuard.ts`) : pour un compte aux
   bibliothèques bornées (ou à la politique illisible), un parent, une série ou une saison
   invisibles rendent une liste VIDE ; une liste d'`Ids` ne garde que les titres visibles
   (`isItemVisibleTo`). Un compte libre ne coûte rien de plus que sa politique en cache.
2. **Pont des extensions** (`contentPolicy/extensionBridge.ts`) : Vigie montrait à un compte
   « 6 ans » des titres de la bibliothèque que Jellyfin lui cache (Coraline classé « 10 », Le
   Voyage de Chihiro étiqueté, Big Buck Bunny non classé, les bibliothèques refusées) comme titres
   « à demander », fiche et demande comprises — le pont ne jugeait que la classification TMDB. Il
   suit désormais la règle de « Pour vous » (`recoRights`) : caché par la bibliothèque = jamais ;
   une version vue = Jellyfin a jugé ; sinon TMDB. **`isRestricted` du pont dit si le filtre PEUT
   retirer quelque chose** : politique restreinte OU bibliothèques bornées (`limitsLibraries`) —
   un compte privé d'une bibliothèque ne s'en voit plus proposer les titres par Vigie.
3. **Aperçus préparés d'avance** (`POST /api/trailers/preview/warm`) : un sujet TMDB n'était pas
   jugé — la décision partagée prise pour un compte libre revenait à un compte restreint. Tout
   sujet passe désormais les questions de `GET /preview` avant d'être rendu ou préparé.
4. **Versos d'Affiner** : le cache de 24 h était lu avant les droits ; ils passent avant lui.
5. **Statistiques** (`viewingStats/statsRights.ts`) : séances mesurées et goût (gardés par
   Tentacle) d'un titre devenu caché revenaient, nom compris ; retirés pour un compte restreint ou
   aux bibliothèques bornées (un titre SUPPRIMÉ depuis garde sa place : `libraryRights.hidesItem`).
   La politique du compte entre dans la clé du cache des statistiques.
6. **Notifications** (`notifications/notificationRights.ts`) : un avis écrit avant une restriction
   (« Fight Club est arrivé ») restait lisible ; à la lecture, un avis qui mène à un titre caché
   n'est plus rendu ni compté parmi les non lus.
7. **« NR » du pays de métadonnées** (`externalTitleRule.titleScore`) — DÉCIDÉ par le coordinateur
   (2026-10-15), règle du § 5.2 mise à jour : un pays présent sans classification lisible arrête la
   recherche, comme le fournisseur TMDB de Jellyfin (« FR-NR » = non classé) ; les États-Unis
   seulement si le pays de métadonnées est absent ; une série ne prend la plus stricte des autres
   que sans l'un ni l'autre. Planet Earth II (FR « NR », US « TV-G ») et 31 Minutes (US « NR »)
   passaient à un compte « 6 ans ».

### 9.5.3 Parcours éprouvés (banc, 2026-10-15)

Comptes : `enfant6` (≤ 6 ans, non classés bloqués, étiquette bloquée, deux bibliothèques
refusées), `filmsseuls` (bibliothèque Films seule, AUCUN contrôle parental), un invité de la
Famille (≤ 6 ans) ouvert sur une Apple TV, `libre` en témoin. Portes : session personnelle (web,
bureau), TV jumelée par le vrai flux d'appareil, « voir en tant que », session de profil d'invité.

- **Proxy** : bibliothèque complète ÉGALE à la référence ; vues, derniers ajouts (par bibliothèque,
  regroupés), reprise, à suivre, favoris, vus, recherche (`Search/Hints`, `searchTerm`), listes
  par parent, par série, par ids ; accès DIRECTS par id (fiche, PlaybackInfo, flux, manifeste,
  vignettes, semblables) → 404.
- **Cœur** : Pour vous (page, rangées, démarrage à froid, personnes, réservoir), Affiner (pile,
  versos), recherche et épisodes, sagas TMDB, héros, résolutions et bandes-annonces TMDB,
  catalogue et aperçus (sans extraction YouTube), segments, téléchargements, statistiques,
  notifications, Ma liste / j'aime, classement, Watch Together (invitations ; affinité hors salon).
- **Vigie** : découverte (films, séries, tendances, pages pleines), recherche (hub, barre du cœur,
  saga), semblables, saga, filmographie, fiche et saisons (403), pastilles `titles.state`, saisons
  manquantes, « Mes demandes », titres attendus, avancement, calendrier ; demander un titre interdit
  → refusé, rien n'arrive chez Jellyseerr.
- **Fraîcheur** : restriction levée puis remise par la fiche des droits — les demandes faites
  entre-temps (Pulp Fiction, Game of Thrones ; témoin : « Mes demandes » les montrait) et le verso
  disparaissent AUSSITÔT.
- Relevé du 2026-10-15 : **3 377 vérifications, aucune fuite** (avant les corrections : 174 échecs).

**Client web (et bureau : même build)**, navigateur intégré, `enfant6`, un détecteur dans la page
(noms et ids interdits, texte et HTML) : accueil (héros « Le Monde de Nemo », Continuer, Derniers
ajouts), Pour vous (démarrage à froid : Bluey, Nemo, Le Roi lion, Peppa Pig, Toy Story), Affiner,
favoris (Le Roi lion seul — Saw, Pat' Patrouille, Sintel écartés), Ma liste, statistiques (Toy
Story et Bluey seuls), Films et Séries (Bluey, Peppa Pig), « Réservée » par URL directe (404),
recherche (« toy », « prince », « patrouille », « pulp » ; « ratatouille » proposé par Vigie), fiche
de Toy Story, fiche et lecture d'un titre interdit par URL (« plus dans la bibliothèque »),
notifications (le seul avis permis, 1 non lu), hub Vigie (catalogue : 10 films, tous permis) —
rien.

**Apple TV** (simulateur neuf de la place nav-golden 5, app du cache partagé, natif
`0d02ee212ee3b5bf`, détecteur `__navGolden.observe({ texts })` sur la liste interdite du compte) :
- `enfant6` par le VRAI flux de jumelage d'appareil (code, confirmation, jeton) : préconfiguration
  de la barre (Films et Séries seulement), accueil (héros et « Là où vous en étiez » : Nemo seul),
  Pour vous (dont « Spider-Man : Brand New Day », classé « TP » en France : permis, comme Jellyfin
  le jugerait), Ma liste, favoris, recherche, Films, Séries, « Réservée » forcée (« Cette
  bibliothèque est vide »), fiche de Toy Story, de Bluey, fiches interdites forcées (erreur
  générique, sans nom ni affiche) — rien.
- **Invité « Petit »** (Famille de `libre`, ≤ 6 ans) : TV jumelée au compte `libre`, « Qui
  regarde ? », session de PROFIL : barre à quatre bibliothèques (celles de son créateur), accueil,
  Pour vous, favoris, Ma liste, bibliothèques, fiche interdite forcée — rien ; Le Petit Prince et
  Pat' Patrouille (tous publics, bibliothèques de son créateur) lui restent ouverts, à raison.
- Remarque d'interface, hors de ce chantier : sur la TV, une fiche interdite ouverte par son id dit
  « Impossible de charger le contenu… interruption passagère » (le web : « plus dans la
  bibliothèque »).

### 9.5.4 Acceptés, hors de portée, signalés

- Images d'un titre interdit : publiques chez Jellyfin (200 sans jeton) — le proxy n'y change rien.
- `GET /api/preferences/home-layout` rend l'id du héros fixe même caché : c'est le choix du compte
  lui-même (le héros passe en « reprise »).
- `Persons` et `Items/Filters` de Jellyfin listent acteurs, étiquettes et classifications de toute
  la bibliothèque (aucun titre) ; Jellyfin fait de même à son propre client.
- Cache du proxy (`Latest` 30 s, `Resume` 15 s, `NextUp` 30 s, `Views` 5 min) non vidé à une
  écriture de politique : dans la fraîcheur du contrat ; une liste d'un parent refusé est vidée par
  la garde AVANT le cache.
- Porte DIRECTE de Jellyfin (port publié) : sert un fichier à qui connaît son id — d'où les règles
  ci-dessus (aucun id d'un titre interdit rendu).
- ✅ **Fermé (`6167e8b5e`)** : l'affinité diffusait `state.proposals[]` (id et titre) à tout le salon.
  Banc (`probesAffinity.ts`) : `enfant6`, entré après les matchs de `libre` et `filmsseuls`, recevait
  « Coraline » (10) par `GET /affinity`, `POST /affinity/join` et trois `wt:affinity`, et le lancement
  passait ; désormais rien, « Le Roi lion » lui parvient (témoin), lancer « Saw » → 409.
  **Décidé : commun à la salle, pas par destinataire** (`affinity/affinityRights.ts`) — une proposition
  ne part que si TOUS les membres voient son titre (`isItemVisibleTo`, fermé à l'échec), dans l'état
  (REST et socket), `matchKeys` et `match`. Un match est UNE proposition (la première réponse vaut pour
  tous, la première en attente est à l'écran de chaque participant : des listes par destinataire le
  feraient diverger), et « Regarder ensemble » mène au lecteur du groupe, que `wt:setItem` refuse dès
  qu'un membre ne voit pas le titre (§ 7.2). D'où : `matched` faux pour l'auteur du vote ; lancer →
  `answered`, la salle reçoit l'état qui ne le propose plus ; la proposition reste dans la séance et
  revient, à la diffusion suivante, au départ du membre ou à sa politique rouverte.
- ✅ **Fermé (`757eae14e`)** : la PILE d'un membre n'était jugée qu'au lancement ou à son entrée — « Le
  Roi lion » (6+) restait servi à `enfant6` passé à « U ». Chaque lot repose la question
  (`affinity/affinityCards.ts`, `isItemVisibleTo`) pour un compte restreint ou aux bibliothèques
  bornées (illisible compris) ; un compte libre ne coûte que sa politique en cache. Une carte cachée
  reste écartée tant qu'il swipe (`hidden`), rouvrir sa pile repart de zéro. Banc : retirée aussitôt
  après la fiche des droits, en 31 s après un changement fait dans Jellyfin.

## 9.6 Démarrage et « Vous regardez encore ? »

### L'ordre des fenêtres du démarrage (web et bureau)

Une seule règle, pure : `apps/web/src/startup/startupOrder.ts` (tests à côté). Chaque
porte PUBLIE son état dans un magasin de module (`startupStore.ts` : `undecided`,
`pending`, `open`, `done`) et n'ouvre qu'à son tour. Rien ne s'empile ; celle qui attend
paraît après, aucune ne se perd.

1. **`profile`** — « Qui regarde ? » et son PIN. Trois sources : l'attente bornée de
   l'ouverture du bureau (`useProfileLaunchGate`, mode `late` : jusqu'à 1,5 s, la réponse
   du serveur peut encore imposer le sélecteur, qui démonterait l'application) ;
   « Changer de profil » ouvert (`WhoIsWatchingHost`) ; le rideau du profil choisi
   (`ProfileArrival`, et `announceArrival` dès le choix), jusqu'à sa levée.
2. **`familyPin`** — « Action recommandée : posez votre code PIN » (`FamilyPinStartup`).
   Tranché quand la Famille et les rappels ont répondu, ou qu'il n'y en aura pas
   (Famille absente, hors ligne, session d'un profil, lecture en échec).
3. **`familyInvitation`** — l'affiche d'une invitation dans une famille, puis
   « Bienvenue » (`FamilyInvitationHost`). Ajoutée à la liste : elle s'empilait aussi.
   Reçue en direct pendant qu'une autre fenêtre est ouverte, elle attend sa fermeture.
4. **`whatsNew`** — « Nouveautés pour cette version ». La porte ne tranche qu'à son tour
   (sa décision est définitive) ; un serveur injoignable ne retient pas la suite.
5. **`update`** — la pop-up de mise à jour. **Décision : après les nouveautés, avant
   l'avatar.** Elle parle de la version SUIVANTE : on lit d'abord ce qu'apporte celle
   qu'on vient d'ouvrir ; l'installer redémarre l'application, et l'invitation aux
   avatars, pas encore parue, attend le lancement suivant sans être perdue. En cours
   (téléchargement, installation), elle reste à l'écran quoi qu'il arrive. Plus jamais
   sur le lecteur.
6. **`avatarInvite`** — l'invitation unique à choisir un avatar.

Une fenêtre paraît quand tout ce qui la précède est `done` et que rien de ce qui la suit
n'est `open` ; une fenêtre qui se ferme garde sa place 200 ms, le temps de son fondu
(`STARTUP_EXIT_GRACE_MS` ; `Modal` sort en 143 ms). Seul un hors-ligne ÉTABLI
(`offline-auto`, `offline-manual`) libère ce qui suit des nouveautés : `checking`, l'état
du démarrage, n'est pas une absence. Rien hors session ni sur `/watch`. L'accès suspendu (page bloquante à la
racine) passe avant tout : il n'a pas de rang. Diagnostic : `window.__tentacleStartup()`
(porte du débogage du web) rend l'état de chaque fenêtre et celle qui tient le démarrage.

Le dossier `startup/` est hors de `profiles/` exprès : le client LG compile
`StartupOverlays` mais pas `profiles/` (`EXCLUDED_WEB_DIRECTORIES`) ; ses deux portes
restent substituées, la cale de l'invitation aux avatars suit sa nouvelle signature.

Apple TV : ni nouveautés, ni PIN conseillé, ni invitation aux avatars ; l'écran de
préconfiguration est une route après « Qui regarde ? » — aucun conflit.

### « Vous regardez encore ? » — l'essai

Réglages › Lecture, sous les deux durées : **« Voir la question maintenant » → Essayer**.
L'essai remet le compteur de lecture à zéro et vaut pour la prochaine lecture : la
question paraît après **20 s de lecture sans geste**, au lieu de l'heure et demie réglée.
Le reste est le VRAI comportement : même encart, décompte du réglage, pause à
l'expiration, « Reprendre ». Consommé quand la question est posée ; éteint seul au bout
de 10 minutes sans lecture ; jamais stocké (un redémarrage l'oublie) ; il ne rallume pas
une question coupée, et couper la question y renonce. Règle : `shared/playback/
stillWatchingTrial.ts` ; magasin et battement : `api-client/playback/
stillWatchingTrialStore.ts` (`tickWithStillWatchingTrial`). Le miroir a la même ligne.

Ce que la fenêtre fait, relevé dans le lecteur web puis sur l'Electron du dépôt (mpv,
macOS Apple Silicon : fenêtre, plein écran, PiP) : elle ne prend JAMAIS le focus ;
n'importe quelle touche (Tab compris) vaut « Continuer » — au clavier, Espace met en pause
par le raccourci du lecteur ; le décompte se lit seconde par seconde ; à l'expiration, PAUSE
(jamais un arrêt) et « Lecture en pause » / « Reprendre » ; le compteur traverse
l'enchaînement d'un épisode au suivant. Sur le web, elle vit dans le conteneur qui passe en plein écran
(`VideoPlayer.tsx`) ; sur le bureau, la page la dessine au-dessus de mpv, en fenêtre comme
en plein écran (décompte, barre, « Continuer » / « Mettre en pause »). Pendant le PiP du
bureau, elle se tait (`enabled: !pip.active`, choix d'origine) : relevé, 38 s de lecture
en incrustation sans question, l'essai toujours armé jusqu'à la sortie du PiP.

### Rejouer chaque cas (Damien)

- **L'essai** : Réglages › Lecture › « Vous regardez encore ? » activé › « Voir la question
  maintenant » › **Essayer**. Lancer un épisode et ne plus toucher ni la souris ni le
  clavier : la question à 20 s, la pause 10 s plus tard (le délai de réponse réglé).
  Recharger la page oublie l'essai (il vit en mémoire).
- **Nouveautés non vues** (console du bureau, ou web de dev avec `?whatsnewgate=1`) :
  `localStorage.setItem('tentacle_whats_new_seen', '1.28.2'); location.reload()`.
- **PIN conseillé** : il revient à chaque lancement tant qu'on le ferme sans répondre ;
  « Configurer plus tard » le masque pour le compte. Le remettre :
  `fetch('/api/preferences/hints/familyPin', { method: 'PUT', headers: { Authorization:
  'Bearer ' + localStorage.tentacle_token, 'Content-Type': 'application/json' }, body:
  JSON.stringify({ dismissed: false }) })` — et un compte dans une famille, sans PIN.
- **Invitation aux avatars** : `localStorage.removeItem('tentacle_avatar_invite_seen')`, sur
  un compte sans photo.
- **Mise à jour** (build de débogage) : `__tentacleSimulateUpdate()` dans la console, juste
  après le chargement.
- **Rideau du profil** : « Changer de profil » depuis le menu de l'avatar (bureau), ou
  `sessionStorage.setItem('tentacle_profile_arrival', JSON.stringify({ id: 'x', name:
  'Essai', color: '#a855f7', imageTag: null })); location.reload()`.
- **Affiche de la Famille** : se faire inviter par un autre compte pendant que les
  nouveautés sont ouvertes — elle attend leur fermeture.
- **L'état, à tout moment** : `__tentacleStartup()` (web de dev, build de débogage).

## 9.7 Suppression de titres

> Lot « droits 2 » (2026-10-15), web et bureau seulement — ni mobile, ni TV, ni webOS, ni la
> fenêtre étroite (miroir). Capacité `library.delete` (serveur 1.30.0).

### 9.7.1 Ce que Jellyfin fait (mesuré sur 10.11.11, Jellyfin jetable ; source de 12 relue)

- **Les droits** : `EnableContentDeletion` (partout) et `EnableContentDeletionFromFolders` (des
  bibliothèques, identifiants des `CollectionFolder` = ceux des vues `/Users/{id}/Views`). Un
  administrateur suit la même règle : son droit, pas son rôle.
- **`CanDelete`** (`Fields=CanDelete`) est calculé pour le compte du jeton, ou pour le `userId`
  avec la clé d'API : vrai partout avec le premier droit, dans SES bibliothèques avec le second,
  faux sinon. Celui d'une bibliothèque elle-même est toujours faux (inutilisable).
- **`DELETE /Items/{id}`** par le jeton du compte : 204 (fichier ET dossier supprimés du disque —
  film, épisode, saison, série entière), 401 « Unauthorized access » (refusé, rien ne bouge), 404
  (déjà absent), 400 (identifiant nul). **Avec la clé d'API, aucun contrôle** : tout part.
- **`DELETE /Items?ids=a,b,c` est inutilisable** : il s'arrête au PREMIER refus (401) sans dire
  lequel — les titres d'avant supprimés, ceux d'après jamais tentés. Même code sur `master` (12).

### 9.7.2 Le serveur — `routes/libraryDeletion.ts`, `services/libraryDelete/`

Contrat : `packages/shared/src/libraryDelete/libraryDeleteContract.ts`, miroir backend
(`libraryDeleteMirror.test.ts`).

| Geste | Route | Réponse |
|-------|-------|---------|
| Où supprimer | `GET /api/library/deletion/rights` | `{ everywhere, libraryIds }` — relu par `/Users/Me` avec le jeton du compte ; « nulle part » pour toute session non personnelle, une politique illisible, un compte désactivé |
| Supprimer | `POST /api/library/deletion` `{ ids }` (1 à 20) | `{ results: [{ id, outcome }] }`, `outcome` ∈ `deleted` · `gone` · `forbidden` · `failed`, un par titre, dans l'ordre reçu |

- **Session PERSONNELLE seulement** (`403 { error: "not_personal" }` sinon) : son jeton EST le
  jeton Jellyfin du compte, par lequel Jellyfin juge chaque titre. Une TV jumelée, une session de
  profil (TV ou bureau), « voir en tant que » n'ont pas de jeton Jellyfin à elles. Le proxy refuse
  déjà tout `DELETE` d'un jeton d'appareil (`deviceWrites.ts`, inchangé ; test du lot ajouté).
- **Un `DELETE /Items/{id}` par titre**, deux à la fois, 60 s chacun au plus (une série emporte
  ses épisodes). Corps invalide (identifiant illisible, clé de trop, lot vide ou > 20) : refusé
  ENTIER, rien n'est tenté. 120 appels par minute et par adresse.
- **Après** (`afterDeletion.ts`) : les titres quittent le relevé de chaque compte
  (`dropItemsFromUserAccess` : recherche, recos, saga n'en montrent plus rien sans attendre la
  reconstruction de six heures), les verdicts de visibilité tombent, le catalogue se relève, et
  `broadcastAll` (rangées Derniers ajouts, Reprendre, Prochains, Ma liste, favoris, vus) vide les
  réponses gardées par le proxy et fait relire leurs rangées aux applications connectées.
- **Journal** `[library-delete] <compte> (<8 car.>…) : N demandés — x supprimés, y déjà absents,
  z refusés par Jellyfin, w en échec` — jamais un titre ni un chemin.
- **Pourquoi une route serveur, donc une capacité** : un appel direct à Jellyfin par le proxy
  aurait jugé de même, mais sans journal, sans vider les caches du serveur (la recherche aurait
  rendu le titre supprimé jusqu'au relevé suivant) et en exposant au client le 401 de Jellyfin,
  que `fetchWithRetry` lit comme une session expirée.

### 9.7.3 Les clients (web, bureau)

- **Porte** : `useLibraryDeletionRights` (derrière `library.delete`), puis `CanDelete` relevé par
  le client avec le jeton du compte (`useLibraryDeletableIndex`, `useDeletableEntries`, champs
  minimaux, aucune image). Rien n'est montré sans les deux. **Le relevé d'une bibliothèque garde
  `EnableUserData=true`**, comme la grille : Jellyfin ne remplit `RecursiveItemCount` d'un dossier
  que dans le calcul des données de visionnage ; sans elles, toute série paraissait vide et sortait
  du relevé (« Aucun de ces titres ne peut être supprimé » sur une bibliothèque de séries, corrigé
  le 2026-10-16).
- **Fiche** (film, série, épisode) : « ⋯ » après la note, « Supprimer de la bibliothèque ». Une
  saison n'a pas de fiche : « Supprimer la saison » au bout de sa barre (liste des épisodes).
  Réussie, la suppression le dit d'un toast et la fiche ramène en arrière (à l'accueil sans
  historique) ; un refus ou un échec garde le bilan.
- **Grilles des bibliothèques** : « Sélectionner » dans le panneau, si le compte peut supprimer
  dans CETTE bibliothèque. **Recherche** : onglets Films, Séries, Épisodes, si le compte peut
  supprimer quelque part. Jamais sur le plateau des cartes ni dans leur menu contextuel.
- **Le mode sélection** : case dans le coin haut-gauche de l'affiche (jamais au centre ; le coin
  haut-droit garde la pastille) ; titre refusé atténué avec un cadenas, non cochable ; le clic
  coche, Maj + clic coche une plage, Espace/Entrée au clavier ; le survol, l'aperçu, le plateau et
  le menu contextuel se taisent ; Échap quitte (un dialogue ouvert se ferme d'abord).
- **« Tout sélectionner »** couvre la bibliothèque filtrée ENTIÈRE — mêmes filtres, même tri
  (`catalogFilterParams`, partagé avec la grille), relevée par pages de 500 — avec son nombre,
  jamais la seule page chargée. Exceptions dites dans la barre : un filtre de plateforme (appliqué
  par le client aux titres chargés) → les titres affichés ; la recherche plafonne à 60 résultats
  par type → « Seuls les 60 premiers résultats sont proposés sur N ».
- **Confirmation** : combien, les cinq premiers titres puis « et N autres », « Les fichiers seront
  aussi supprimés du disque du serveur. C'est irréversible. », et ce qu'emporte une série ou une
  saison ; « Annuler » a le premier focus. **Progression** par lots de 20 (`aria-live`, Échap et
  le fond inopérants), « Arrêter » entre deux lots ; un lot perdu est retenté une fois, puis ses
  titres comptent en échec et la suite continue. **Bilan** : supprimés, déjà absents, puis
  NOMMÉMENT les refusés, les échecs et les titres non traités, avec « Réessayer ces titres ».
- **Caches** (`forgetDeletedItems`) : à chaque lot, les titres partis — et, pour une série ou une
  saison, ses épisodes (`SeriesId`, `SeasonId`) — quittent toutes les données en cache (pages des
  grilles et leur compte, rangées, Ma liste, Continuer, recherche et son meilleur résultat,
  saisons, épisodes) ; à la fin, tout se relit. La fiche d'un titre parti est seulement marquée
  périmée tant qu'elle est montée, puis oubliée.

### 9.7.4 Hors périmètre, à suivre

- Mobile, TV, webOS, fenêtre étroite (miroir) : aucune entrée. Le client LG lit seulement les
  droits (« nulle part » : jeton d'appareil).
- **« Voir en tant que »** : le proxy lui prête la clé d'API, et sa liste blanche laisse passer
  `DELETE Items/{id}` — un appel FORGÉ sous ce jeton supprimerait sans contrôle de Jellyfin.
  Antérieur à ce lot, réservé à un administrateur ; aucune interface de Tentacle ne l'emprunte
  (la route du lot le refuse). À fermer dans le proxy.
- Banc : Jellyfin 10.11 jetable, trois comptes (administrateur ; un compte qui ne supprime que
  dans UNE bibliothèque ; un compte sans droit), médias générés ; preuves dans le rapport du lot.

## 9.8 Bibliothèques permises par la famille, et contrôle parental simplifié sur TV (lot TV du 16/10, T2)

Décision de Damien (16/10) : sur la TV, un contrôle parental SIMPLIFIÉ — les bibliothèques
autorisées et un âge en quelques paliers, sans plages horaires — que le propriétaire ou un parent
ouvre sur un invité ou un membre mineur. « Le client, c'est juste un affichage simplifié, mais
derrière, c'est fixé par Jellyfin. » Règle FAMILIALE : un membre qui part retrouve ses droits, et
une règle de l'administrateur prime toujours.

### 9.8.1 Les bibliothèques — capacité `family.libraryLimits` (1.30.0)

- Contrat : `packages/shared/src/family/familyLibraries.ts` (miroir, ré-exporté par
  `familyContract.ts`). `GET|PUT /api/family/profiles/:userId/libraries` (`profileLibraries`,
  `setProfileLibraries`, appelants `personal`, `ownerProfile`, `memberProfile`) →
  `FamilyLibrariesDto { available, allowed }` ; corps EXACT `{ allowed: string[] | null }`.
- **Mêmes droits que le contrôle parental** : invité → `manageableGuest` (propriétaire, parent, ou
  le membre qui l'a créé) ; membre → `regulableMember` (propriétaire ou parent ; jamais le
  propriétaire, un parent, un administrateur Jellyfin : `family.member_parental_refused`).
- **Jellyfin applique** : `EnableAllFolders` / `EnabledFolders` = PLAFOND ∩ VOULU
  (`services/family/familyLibraryRules.ts`, pur). Plafond : les bibliothèques du créateur (invité),
  la base de l'administrateur (membre). `null` = toutes celles du plafond ; une liste reste une
  liste (une bibliothèque créée plus tard n'y entre pas). Plus rien en commun avec le plafond →
  AUCUNE bibliothèque : rien ne s'élargit. Une bibliothèque hors du plafond ou inconnue du serveur
  est refusée (`family.invalid_input`), comme une liste vide, un doublon ou une clé en trop.
- **Invité** : `family_members.libraryAccess` (migration `0008_family_library_limits`) ;
  `guestPolicy` recoupe après le contrôle parental ; le guet, l'ouverture d'un profil et toute
  écriture du créateur le tiennent, comme son âge (§ 4.2).
- **Membre mineur** : `family_member_parental.libraries` (voulu), `libraryBase`, `libraryWritten`.
  `settleMemberParental` écrit âge ET bibliothèques en UNE écriture (jamais deux lectures-écritures
  croisées de la politique), relit, garde. Même règle de base qu'au § 9.4.3 : l'accès lu qui
  diffère de la dernière écriture a été changé AILLEURS (l'administrateur) et devient la base. Une
  base jamais relevée (ligne posée par l'âge seul) = l'accès lu. La ligne vit tant que l'âge OU les
  bibliothèques restreignent ; les deux retirés, départ, retrait, dissolution → base rendue, à
  l'identique ; Jellyfin muet → le guet la rend.
- Comparaisons sans ordre ni forme d'identifiant (`samePolicy` normalise `EnabledFolders`).
- Tests : `familyLibraryRules.test.ts`, `test/familyLibraryLimits.test.ts` (invité, plafond du
  créateur qui se restreint, base rendue au départ et à la dissolution, l'administrateur qui change
  pendant, âge et bibliothèques ensemble, Jellyfin muet, refus d'un membre simple, d'un parent sur
  le propriétaire ou un parent, hors famille, administrateur Jellyfin, corps forgés).

### 9.8.2 La TV (Apple TV, Android TV) — `ParentalControls { userId }`

- Ouvert depuis la fiche d'un profil de « Gérer les profils » (T1), sur un profil dont le serveur
  rend `parental` (c'est-à-dire à qui peut le régler). L'état de l'âge voyage avec
  `GET /api/family` (rendu aussi à une session de profil qui GÈRE, 95235dc7c) ; l'échelle vient de
  `parentalOptions` ; les bibliothèques se lisent à la demande.
- **Âge** (tv-core `session/parentalAge.ts`) : paliers 0 (« Tout public »), 6, 10, 12, 16 ans,
  « Sans limite » ; un palier vaut le plus grand score de la table ≤ son âge (les scores de
  Jellyfin 10.11 sont des âges) ; deux paliers sur un même score n'en font qu'un, le plus jeune.
  Seule la note change (`withParentalAge`) : types non classés, étiquettes et plages réglés
  ailleurs repartent intacts. Une note réglée ailleurs hors palier se montre « Réglé ailleurs »,
  à sa place dans l'échelle, avec ses noms (`parentalRatingNames` : sans sous-note, tous ceux
  du score), jamais remplacée en silence ; une sous-note qui couvre tout son score vaut le
  palier. Le plafond plus strict se dit (cadenas), sans interdire le choix ; « Sans limite »
  sous un plafond dit « Aucune limite fixée par la famille ».
- **Vue** : deux listes alignées côte à côte, l'âge (choix unique, rond plein) et les
  bibliothèques (cases), sur la même ligne (`ParentalRow`) — jamais de pastille orpheline
  (relevé du Testeur A). HAUT / BAS dans une liste, GAUCHE / DROITE de l'une à l'autre.
- **Bibliothèques** (tv-core `session/parentalLibraries.ts`) : une case par bibliothèque
  proposée ; tout coché = `null` ; la dernière cochée ne se décoche pas.
- Chaque geste part aussitôt, une écriture après l'autre (`useSaveLane`), la vue suit le geste puis
  revient à l'état relu ; « Enregistré » au pied. La gestion refermée en route
  (`family.manage_locked`) ramène à « Gérer les profils », qui redemande le code.
- **Capacités** : âge d'un invité `family.parentalControls`, d'un membre `family.memberParental`,
  bibliothèques `family.libraryLimits` — une section que le serveur ne déclare pas n'existe pas.
- Le bureau proposera la même section « Bibliothèques » (session Famille).

## 9.9 Famille : « Les invités peuvent demander des films », décidé par l'administration

Lot du 16/10, T7. Capacité `family.guestRequestsAdmin` (1.30.0). Contrat : `familyRoles.ts`
(`grantGuestRequests`, `guestRequestState`), `familyContract.ts` (`FamilySwitches.guestRequests`,
`FamilyAdminSwitchesDto.requestExtension`, `FamilyGuestRights.suspended`), refus
`family.guest_requests_denied` (403) ; règle cliente `mayGrantGuestRequests` (`familyClient.ts`).
Serveur : `services/family/familyGuestRequests.ts`.

- **L'interrupteur** (`server_config.family_guest_requests_enabled`) : COUPÉ tant que
  l'administration ne l'a pas allumé, MISE À JOUR COMPRISE, même sur un serveur où des invités
  demandaient déjà (décision de Damien du 2026-10-16, contre la règle habituelle de
  rétrocompatibilité). Coupé : aucune famille ne donne le droit, administrateurs compris.
  `features.family.guestRequests` le suit : un client d'avant cache la case. Admin › Utilisateurs
  › Familles : une troisième rangée à trois positions (Coupé, Comptes permis, Tous les comptes),
  montrée SEULEMENT si une extension sait demander un titre (`requestExtension`).
- **Le droit de compte** `grantGuestRequests` (`family_account_rights`, `inherit | allow | deny`,
  défaut de l'administration `family_default_grant_guest_requests`, absent = NON) : réglé dans la
  fiche d'un compte (rubrique Famille) ; un administrateur Jellyfin l'a d'office. Il appartient au
  compte qui AGIT : le propriétaire ou un parent qui coche « peut demander » sur un invité.
  `FamilyAccountDto.creation.grantGuestRequests` le dit au client.
- **La case d'un invité** garde le compte qui l'a cochée (`family_members.requestTitlesGrantedBy` ;
  ligne d'avant : son créateur, sinon le propriétaire). Que ce compte perde le droit, ou que
  l'interrupteur se coupe : SUSPENDUE — gardée, `guestExtensionAccess` refuse les extensions,
  les DTO disent `requestTitles: false, suspended: true` (vue d'ensemble, « Qui regarde ? », TV).
  Le droit revenu, elle revit sans qu'on la règle de nouveau. Décocher n'exige jamais rien.
- Chaque changement (interrupteur, défaut, fiche) fait relire les familles concernées, invités
  compris (`family:update`).
- Preuves : `test/familyGuestRequestsAdmin.test.ts` (défaut coupé, parent sans le droit, appel
  direct, suspension puis rallumage, administrateur d'office) ; shared
  `familyGuestRequests.test.ts` ; web `familyAccessModel.test.ts`, `FamilySwitchesSection.test.tsx`,
  `AccountFamilyRightsGroup.test.tsx`. Banc réel (Jellyfin 10.11 jetable, 2026-10-16) : 11
  vérifications de bout en bout, « TOUT EST PROUVÉ », et l'administration éprouvée dans le
  navigateur.
