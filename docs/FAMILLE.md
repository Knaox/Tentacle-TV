# La Famille — carnet

Décisions de Damien du 2026-10-04 ; elles font foi. Ce carnet dit le CONTRAT
(ce que les clients consomment) et le MÉCANISME (ce que le serveur garantit).
Une règle, une source :

| Quoi | Où |
|------|----|
| Limites, réponses, corps | `packages/shared/src/family/familyContract.ts` |
| Codes d'erreur, temps réel, notifications | `packages/shared/src/family/familyProtocol.ts` |
| Routes et appelants permis | `packages/shared/src/family/familyRoutes.ts` (`FAMILY_ROUTES`) |
| Règles pures (PIN, capacité, invitations, candidats, noms) | `packages/shared/src/family/familyRules.ts` |
| Lecture d'un refus, clés i18n (clients seulement) | `packages/shared/src/family/familyLabels.ts`, espace i18n `family` |
| Miroirs du serveur (octet pour octet, `familyMirror.test.ts`) | `apps/backend/src/family/` |
| Schémas d'entrée (zod) | `apps/backend/src/services/family/familySchemas.ts` |
| Appels et crochets | api-client `family/familyApi.ts`, `family/familyTvApi.ts`, `hooks/useFamily.ts`, `hooks/useFamilyLive.ts` |
| Tables | `schema.prisma` › `Family`, `FamilyMember`, `FamilyInvitation`, `ProfilePin`, `ProfilePinAttempt`, colonnes de `PairedDevice` ; `core-init.sql` (additif) |

## Les rôles

- **Propriétaire** : tout compte du serveur sauf un invité ; UNE famille au
  plus. Il invite, crée des invités, retire, supprime, dissout. La famille naît
  à son premier invité ou à sa première invitation.
- **Membre** : un compte EXISTANT qui a accepté une invitation ; membre de
  plusieurs familles s'il le veut. Le retirer le sort de la famille, jamais de
  Jellyfin.
- **Invité** : un VRAI compte Jellyfin créé par le serveur (clé d'API), caché
  (`IsHidden`), au mot de passe fort jeté aussitôt — personne n'y entre ; seules
  les TV du propriétaire l'ouvrent. Mêmes bibliothèques et restrictions que le
  propriétaire, jamais administrateur, aucun droit de gestion, de suppression
  ni de téléchargement. Nom Jellyfin ASCII reconnaissable : « Lea - invite de
  Damien » (`guestAccountName`). Il n'apparaît dans AUCUNE liste — seulement
  dans les sessions en cours, étiqueté `familyGuestOf` (« Invité · famille de X »).
  Le supprimer supprime son compte Jellyfin (sa lecture est perdue).
  Déjumeler une TV ne supprime JAMAIS un invité.
- **Limites** : 6 profils par famille, propriétaire et invitations en attente
  compris, dont 3 invités au plus.

## L'Apple TV : jumelage, profils, sessions

Seule l'Apple TV passe aux profils ; Android TV et webOS gardent leur jumelage.

### 1. Une TV d'avant les profils

Son jeton d'appareil (`paired_device`, ligne `paired_devices`) reste ce qu'il
était : la session complète du compte qui l'a jumelée. Rien ne change pour
elle tant qu'elle n'appelle pas l'échange.

### 2. L'échange — `POST /api/family/tv/enroll`

Une fois, quand le serveur annonce la Famille (`/api/config` ›
`features.family`), la TV échange son jeton contre un **jeton de jumelage
« profils seuls »** (JWT de type `tv_pairing`). Dans la même transaction, la
ligne du jumelage change d'empreinte, passe en mode profils
(`profilesSince`), et l'appareil Jellyfin de l'ancien jeton est voué à
disparaître (journal `paired_device_cleanups`).

Pourquoi un échange plutôt qu'un drapeau : **aucune porte existante ne
reconnaît ce type de jeton** (`verifyDeviceToken` exige `paired_device`). Le
proxy, le trickplay, les routes REST, la socket et le rafraîchissement le
refusent d'office — une porte oubliée échoue FERMÉE. Le jeton de jumelage ne
sert qu'à trois choses : lister les profils, en ouvrir un, se déjumeler. Le
PIN du propriétaire n'est donc pas une façade : sans session de profil ouverte
par le serveur (PIN compris), la TV ne lit rien.

- L'ancien jeton est refusé partout (401 `revoked`) — SAUF pour rejouer
  l'échange tant que le nouveau n'a pas servi (`legacyTokenHash`) : une
  réponse perdue ne coûte pas un rejumelage. Le premier usage du nouveau
  jeton l'efface.
- Rejouer l'échange avec le jeton de jumelage le rend tel quel.
- Un serveur ramené à une version d'avant la Famille ne connaît plus ce jeton :
  la TV doit être rejumelée.

### 3. « Qui regarde ? » — `GET /api/family/tv/profiles`

Le propriétaire de la TV (le compte qui l'a jumelée) en tête, puis sa famille
— les membres si la Famille est active, les invités si les deux interrupteurs
le sont (`isProfileKindAllowed`). Chaque profil dit `hasPin` et, sur CETTE TV,
`lockedUntil`. `pickerRequired` dès deux profils ; sinon la TV ouvre le seul.
`stickyProfileId` : le profil « Rester sur ce profil ». Les avatars se lisent
sans jeton (`/api/jellyfin/Users/{id}/Images/Primary?tag=…`).

### 4. La session de profil — `POST /api/family/tv/sessions`

`{ profileId, pin?, remember? }` → `{ token, user, profile, remembered }`.

- Le serveur vérifie que le profil appartient à la famille de CETTE TV, que
  les interrupteurs le permettent, et le PIN (scrypt, jamais envoyé ni comparé
  sur la TV). Erreurs : `family.pin_required`, `family.pin_invalid`
  (`attemptsLeft`), `family.pin_locked` (`lockedUntil`),
  `family.profile_unavailable`, `family.disabled`, `family.guests_disabled`.
- Le jeton rendu est un **jeton d'appareil comme ceux du jumelage**, au nom du
  profil (`isAdmin` toujours faux), porté par une ligne ENFANT de
  `paired_devices` (`parentId` = le jumelage de la TV). Il passe toutes les
  portes comme un jumelage : proxy, socket, canal de session,
  `/api/config/streaming` (qui rend son jeton Jellyfin PROPRE : Quick Connect,
  DeviceId dérivé de son empreinte — un par couple TV × profil ; Quick Connect
  coupé : mode proxy, comme le jumelage).
- **Une seule session de profil par TV** : en ouvrir une ferme la précédente
  (`family:profile-ended` `replaced`).
- `remember: true` pose « Rester sur ce profil » : au lancement, la TV rouvre
  ce profil SANS PIN. `remember` absent ou faux l'ôte. Tout retrait, tout
  changement de PIN de ce profil l'efface ; fermer volontairement la session
  aussi.
- En quittant un profil, la TV oublie ses jetons : le rouvrir repasse par le
  serveur, et par le PIN.

### 5. Fin d'une session, déjumelage

- Ce qui coupe une session de profil, IMMÉDIATEMENT : départ ou retrait du
  membre, suppression de l'invité, changement de PIN, dissolution, coupure
  par l'admin, compte supprimé, déjumelage. Jeton refusé chez Tentacle ET chez
  Jellyfin (`DELETE /Devices`), socket prévenue (`family:profile-ended`
  + `reason`, puis fermeture 4010), et aux portes REST un 401
  `{ revoked: true, profileEnded: true }` — la TV revient à « Qui regarde ? »
  (elle ne se déjumelle PAS sur ce 401-là).
- « Changer de profil » : `POST /api/pair/self/revoke` porté par le jeton de
  la session — ne ferme QUE cette session.
- « Déjumeler » : `POST /api/pair/self/revoke` porté par le jeton de
  jumelage — la TV et toutes ses sessions de profil. La liste « mes
  appareils » et l'admin déjumellent de même ; les sessions de profil n'y
  figurent jamais.
- Le jeton de jumelage d'une TV déjumelée reçoit 401
  `{ code: "family.pairing_required", revoked: true }` : là, la TV se déjumelle.

### 6. « Gérer les profils » — `POST /api/family/tv/manage/unlock`

Depuis la session du PROPRIÉTAIRE seulement. S'il a un PIN, le serveur
l'exige (mêmes essais, même blocage) et ouvre la gestion dix minutes
(`manageUntil`) ; sans PIN, ouverte d'office. Les routes `ownerTv` de
`FAMILY_ROUTES` (lister, créer ou supprimer un invité, inviter, retirer un
membre, annuler une invitation) ne passent qu'ainsi. JAMAIS depuis une TV :
accepter, refuser, quitter, poser son propre PIN, dissoudre.

## Sessions personnelles, sessions de TV

Accepter, refuser, « plus tard », quitter, poser son PIN, le PIN d'un invité,
dissoudre : **session personnelle** seulement — le jeton Jellyfin du web, du
bureau, du mobile. Jamais un jeton d'appareil (TV d'avant ou session de
profil), jamais « voir en tant que » : `family.personal_session_required`.

Une session de profil REGARDE (bibliothèque, lecture, notes, Ma liste,
préférences) mais n'administre rien : ni jumelage d'un autre appareil, ni
compte (suppression, mot de passe), ni Famille personnelle, ni
administration. Sans quoi un membre retiré garderait un accès par une TV
jumelée depuis son profil.

## Invitations

- Candidats (`GET /api/family/candidates?q=`) : les comptes visibles à
  l'écran de connexion de Jellyfin, filtrés par la saisie ; un compte CACHÉ
  par son nom exact seulement ; jamais un invité, soi-même, un membre, une
  invitation en attente, un compte désactivé, le compte de démonstration
  (`selectCandidates`). Un refus ne distingue jamais un compte caché d'un nom
  qui n'existe pas (`family.candidate_invalid`).
- Identifiant d'invitation : 128 bits aléatoires (base64url) — jamais un
  cuid. Et chaque geste vérifie le destinataire.
- Expire en 7 jours. Anti-abus (`inviteBlock`) : une seule en attente par
  (famille, compte) ; 7 jours après un refus du même compte ; 10 envois par
  24 h et par propriétaire ; 10 en attente par destinataire.
- Le destinataire est prévenu par la cloche (`family_invite`), un push
  (préférence `family`, activée par défaut) et l'AFFICHE au lancement du web,
  du bureau et du mobile (`incoming`, en direct par `family:update`
  `invitations`). « Plus tard » la tait 24 h (`snoozedUntil`), la cloche garde.
- Le propriétaire voit ses invitations en attente (annulables) et la réponse
  dans sa cloche (`family_invite_accepted` / `_declined`).

## Code PIN

Quatre chiffres par profil, facultatif. Chacun le pose pour lui-même
(`PUT /api/family/pin`) ; le propriétaire pour ses invités. Haché par scrypt
(sel propre), jamais rendu. Les essais se comptent par TV et par profil
(`profile_pin_attempts`) : cinq, puis 15 min, 1 h, 4 h, 24 h de blocage
(`FAMILY_PIN_LOCK_STEPS_MS`) ; une réussite efface. Poser, changer ou
retirer un PIN coupe le profil sur les TV et ôte « Rester sur ce profil ».
Le PIN du propriétaire protège aussi « Gérer les profils ».

## Temps réel, cloche, push

- `family:update` `{ scope: "owned" | "memberships" | "invitations" }` : relire
  `["family"]` (`useFamilyLive`).
- `family:profile-ended` `{ reason }` sur le socket d'une session de profil,
  puis fermeture 4010.
- La cloche garde des DONNÉES : `title` = le nom de l'autre, `refId` =
  l'invitation ou la famille ; le client compose la phrase
  (`family:notifications.<type>`). Une invitation répondue, annulée ou expirée
  quitte la cloche du destinataire.
- Push : seule `family_invite` part (préférence `family`).

## Le compte de démonstration (revue Apple)

Reconnu par le serveur : le compte de provisionnement désigné dans
l'administration (`provisioning_codes.jellyfinUserId`). Il ne crée RIEN chez
Jellyfin : ses invités sont VIRTUELS (`isVirtual`, identifiant
`virtual-…`) — ils regardent sous son propre compte — ; il n'invite personne,
n'est jamais candidat, ne rejoint aucune famille (`account.reviewAccount`).

## Administration

Deux interrupteurs dans `server_config`, ACTIVÉS par défaut
(`GET`/`PUT /api/admin/family`) : « Familles » et « Profils invités ». Les
couper refuse toute nouvelle action et coupe les sessions de profil en cours
— membres et invités pour le premier, invités pour le second. La session du
propriétaire sur sa propre TV reste.

## Compatibilité

- Capacité : `/api/config` › `features.family` (`{ v, enabled, guests }`).
  Absente : serveur d'avant — les clients ne montrent rien de la Famille ; pas
  de minServer imposé.
- Une TV d'avant les profils garde son jumelage ; les clients publiés ne
  voient aucun changement (champs ajoutés, jamais retirés).

## Sécurité

Tout se décide côté serveur, à l'identique en HTTP et en HTTPS : rien ne
dépend du TLS, d'un cookie Secure ni d'une API web réservée aux contextes
sécurisés. Aucun jeton ni PIN dans une URL ni un journal (`[family]` sans
secret). Personne ne peut inviter au nom d'un autre, accepter à la place d'un
autre, entrer sans invitation, ouvrir un profil depuis une TV qui n'est pas
celle du propriétaire, obtenir un jeton pour un compte hors de sa famille,
garder un accès après un retrait, lister les comptes cachés, deviner un
identifiant d'invitation, contourner un PIN, ni atteindre une fonction
d'administration par un profil.
