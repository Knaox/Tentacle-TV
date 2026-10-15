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

## 7. Chemins à fermer (audit du chantier Filtrage)

Proxy Jellyfin avec un jeton d'APPAREIL (TV jumelée, session de profil, qui empruntent la
clé d'administration) : lecture forcée au compte de l'appareil, et refus d'un
`PlaybackInfo` / flux / téléchargement d'un titre que ce compte ne voit pas ; « Pour vous »
et toutes les rangées de recommandations (titres de la bibliothèque ET hors
bibliothèque) ; « Derniers ajouts » en direct ; recherche ; saga / collections ; saisons
manquantes ; aperçus et bandes-annonces ; notifications et push (« nouveau titre », «
demande disponible ») ; Watch Together (rejoindre un salon qui lit un titre interdit) ;
Top Shelf ; tout `/Items?Recursive=true` fait avec la clé d'API. La liste s'allonge de ce
que l'audit trouve.

## 8. Règles de chantier

- Jamais un changement de politique sur le Jellyfin RÉEL (dev et prod partagent le même
  Jellyfin) : toute écriture se prouve sur un Jellyfin JETABLE (conteneur, colima). Sur le
  réel, lecture seule et comptes Knaoxtest / Knaoxtest2 seulement.
- Aucun bump, aucun changelog, aucun `versions.json` : le coordinateur s'en charge.
- 300 lignes au plus par fichier, code en anglais, commentaires en français, un commit
  par étape, jamais de push ni de tag.
