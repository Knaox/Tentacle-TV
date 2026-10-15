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
