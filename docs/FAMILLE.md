# La Famille — carnet

Décisions de Damien du 2026-10-04 — la v1 le matin, la **v2** après son essai
de l'après-midi (famille PARTAGÉE, une famille par compte) ; elles font foi.
Ce carnet dit le CONTRAT (ce que les clients consomment) et le MÉCANISME (ce
que le serveur garantit). Une règle, une source :

| Quoi | Où |
|------|----|
| Limites, réponses, corps | `packages/shared/src/family/familyContract.ts` (les limites : `familyLimits.ts`, ré-exportées) ; la TV : `familyTvContract.ts` ; le bureau : `familyPickerContract.ts` |
| Codes d'erreur, temps réel, notifications | `packages/shared/src/family/familyProtocol.ts` |
| Routes et appelants permis | `packages/shared/src/family/familyRoutes.ts` (`FAMILY_ROUTES`) |
| Règles pures (PIN, capacité, invitations, noms) | `packages/shared/src/family/familyRules.ts` |
| Droits et candidats (v2) | `packages/shared/src/family/familyRights.ts` (`familyRightsOf`, `canManageGuest`, `familyCandidates`) |
| Parents, membres mineurs, droits de création (1.30.0) | `packages/shared/src/family/familyRoles.ts` ; clients : `familyRolesClient.ts` ; carnet : docs/DROITS-UTILISATEURS.md § 9.4 |
| Lecture d'un refus, clés i18n (clients seulement) | `packages/shared/src/family/familyLabels.ts`, espace i18n `family` |
| Ce que les écrans montrent (places, gestes permis, affiche, couleurs) | `packages/shared/src/family/familyClient.ts` ; le bureau : `familyPickerClient.ts` (clients seulement) |
| Miroirs du serveur (octet pour octet, `familyMirror.test.ts`) | `apps/backend/src/family/` |
| Schémas d'entrée (zod) | `apps/backend/src/services/family/familySchemas.ts` |
| Appels et crochets | api-client `family/familyApi.ts`, `family/familyTvApi.ts`, `family/familyPickerApi.ts` (bureau, jeton personnel explicite), `hooks/useFamily.ts`, `hooks/useFamilyLive.ts` |
| Tables | `schema.prisma` › `Family`, `FamilyMember`, `FamilyInvitation`, `ProfilePin`, `ProfilePinAttempt`, colonnes de `PairedDevice` (`platform` : l'hôte d'un bureau, migration `0003`) ; `core-init.sql` (additif) |
| Services du serveur | `apps/backend/src/services/family/` (un fichier par sujet, voir « Côté serveur ») |
| Routes | `apps/backend/src/routes/family/` (posées d'après `FAMILY_ROUTES` par `familyRouting.ts`) |

## Les rôles

**UNE famille par compte, PARTAGÉE par tous ses membres (v2).** Un compte
appartient à une famille au plus, comme propriétaire OU comme membre : la base
le tient (chaque personne a SA ligne dans `family_members`, propriétaire
compris — `kind = owner` — et `userId` y est unique). Quand un membre a
accepté, la famille est celle de tous ses membres : ils la voient, leurs TV la
montrent.

- **Propriétaire** : tout compte du serveur sauf un invité, s'il n'est membre
  d'aucune famille — et, depuis la 1.30.0, si l'administration lui permet de
  FONDER une famille (`createFamily`, voir « Administration »). Lui SEUL invite,
  annule une invitation, retire un membre, règle les droits des membres, nomme
  ou retire un parent et dissout ; il ne « quitte » pas sa famille
  (`family.owner_must_dissolve`). La famille naît à son premier invité ou à
  sa première invitation.
- **Membre** : un compte EXISTANT qui a accepté une invitation. Il ne crée
  pas de famille, n'en rejoint pas d'autre et n'est plus invitable
  (`family.already_in_family`) ; un geste de propriétaire lui répond
  `family.not_owner`. Il crée des invités SI le propriétaire le lui permet
  (`FamilyMemberRights.createGuests`, par membre, COUPÉ par défaut, réglable
  depuis le web, le bureau, le mobile et la TV — `setMemberRights`) ; il ne
  supprime et ne protège (PIN) que les invités qu'il a créés, même privé du
  droit d'en créer. Retirer le droit ne supprime rien. Le retirer de la
  famille le sort, jamais de Jellyfin.
- **Parent** (1.30.0, `family.roles`) : un membre que le propriétaire a nommé
  parent (`setMemberRole`). Il gère les ENFANTS comme le propriétaire : tous
  les invités (droits, photo, PIN, contrôle parental, suppression) et le
  contrôle parental des membres mineurs ; il crée des invités sans la
  permission du propriétaire, si l'administration lui en donne le droit.
  Jamais : inviter, retirer, nommer un parent, dissoudre.
- **Membre mineur** (1.30.0, `family.memberParental`) : un membre (ni parent,
  ni administrateur Jellyfin) sur qui le propriétaire ou un parent pose un
  contrôle parental — écrit dans SA politique Jellyfin, intersection de sa
  politique de base (celle de l'administrateur) et du contrôle ; rendue à
  l'identique au retrait, à son départ, à la dissolution. Ses invités suivent.
- **Invité** : un VRAI compte Jellyfin créé par le serveur (clé d'API), caché
  (`IsHidden`), au mot de passe fort jeté aussitôt — personne n'y entre ; seules
  les TV de la famille l'ouvrent. Il porte son créateur (`createdBy`) et en
  reçoit les bibliothèques et restrictions — le propriétaire, ou le membre qui
  l'a créé : un membre n'ouvre jamais, par un invité, les bibliothèques du
  propriétaire. Jamais administrateur, aucun droit de gestion, de suppression
  ni de téléchargement. Les invités d'un membre qui part restent dans la
  famille ; le propriétaire les gère. Le propriétaire — lui seul — peut lui
  donner « peut demander des films » (`FamilyGuestRights.requestTitles`,
  coupé par défaut, `setGuestRights`) : voir « L'invité et les extensions ». Nom Jellyfin ASCII reconnaissable : « Lea - invite de
  Damien » (`guestAccountName`). Il n'apparaît dans AUCUNE liste — seulement
  dans les sessions en cours, étiqueté `familyGuestOf` (« Invité · famille de X »).
  Le supprimer supprime son compte Jellyfin (sa lecture est perdue) — pour
  de bon : voir « Un invité supprimé l'est vraiment ».
  Déjumeler une TV ne supprime JAMAIS un invité.
- **Limites** : 6 profils par famille, propriétaire et invitations en attente
  compris, dont 3 invités au plus, tous créateurs confondus.

## L'Apple TV : jumelage, profils, sessions

Les profils sont ceux de la refonte TV : l'Apple TV, et Android TV quand la refonte
y est active (`PROFILES_ENABLED`, `auth/profileEnrollment.ts`) ; l'ancienne UI
d'Android TV et webOS gardent leur jumelage.

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
- L'échange relit la ligne du jumelage et se rejoue sur un conflit d'écriture
  (`services/dbRetry.ts`) : juste après un jumelage, le serveur y écrit de
  lui-même le jeton Jellyfin de la TV, et MariaDB 11 refuserait sinon la
  transaction (1020) — vu sur un vrai Jellyfin 12.1.
- Un serveur ramené à une version d'avant la Famille ne connaît plus ce jeton :
  la TV doit être rejumelée.

### 3. « Qui regarde ? » — `GET /api/family/tv/profiles`

TOUTE la famille du compte qui a jumelé la TV (`pairedBy`), qu'il en soit le
propriétaire ou un membre : le propriétaire en tête, puis les membres, puis
les invités (chacun par ordre d'arrivée) ; les invités si les deux
interrupteurs le permettent. Sans famille, ou « Familles » coupé : le seul
compte de la TV. Chaque profil dit `hasPin`, `lockedUntil` s'il est bloqué par
trop d'essais ratés, `createdBy` (un invité) et `manage` : ce qu'il gérerait
sur cette TV derrière SON PIN (`FamilyRights` ; null pour un invité et pour le
compte de démonstration). `pickerRequired` dès deux profils — la TV ne le lit
pas : le compte de la TV dans AUCUNE famille et sans PIN s'ouvre d'office
(tv-core `soloProfile`, session `solo` reprise au démarrage puis revérifiée en
fond) ; tout autre cas montre « Qui regarde ? », même un profil seul protégé
par un code. La dernière liste lue se garde sur la TV
(`TV_PROFILES_LISTING_KEY`) : au lancement, la rangée paraît avant toute
attente et se relit en fond. `stickyProfileId` :
le profil retenu (« Ne plus proposer à l'ouverture »). `canManage` : « Gérer les
profils » existe (au moins un `manage`). Les avatars se lisent sans jeton
(`/api/jellyfin/Users/{id}/Images/Primary?tag=…`).

### 4. La session de profil — `POST /api/family/tv/sessions`

`{ profileId, pin?, remember? }` → `{ token, user, profile, remembered }`.

- Le serveur vérifie que le profil appartient à la famille de CETTE TV — celle
  du compte qui l'a jumelée — (sinon 403 `family.profile_unavailable` : une TV
  n'ouvre jamais le profil d'une autre famille), que les interrupteurs le
  permettent, et le PIN
  (scrypt, jamais envoyé ni comparé sur la TV). Erreurs : `family.pin_required`,
  `family.pin_invalid` (`attemptsLeft`), `family.pin_locked` (`lockedUntil`),
  `family.disabled`, `family.guests_disabled`.
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
  changement de PIN de ce profil l'efface — sauf sur la TV d'où le profil a
  changé SON PIN lui-même ; fermer volontairement la session aussi.
- En quittant un profil, la TV oublie ses jetons : le rouvrir repasse par le
  serveur, et par le PIN.

### 5. Fin d'une session, déjumelage

- Ce qui coupe une session de profil, IMMÉDIATEMENT et AVANT la réponse du
  geste qui la coupe : départ ou retrait du membre, suppression de l'invité,
  changement de PIN, dissolution, coupure par l'admin, compte supprimé,
  déjumelage. La famille étant PARTAGÉE, les coupures en suivent les TV : un
  membre qui part (ou qu'on retire) perd tous les AUTRES profils sur ses TV,
  et son profil quitte celles des autres ; la dissolution, comme « Familles »
  coupé, ne laisse à chaque TV que son propre compte. Le balayage coupe en
  outre toute session qu'aucune TV ne devrait plus montrer
  (`family_changed`). Jeton refusé chez Tentacle ET chez Jellyfin (`DELETE /Devices`),
  socket prévenue (`family:profile-ended` + `reason`, puis fermeture 4010),
  et aux portes REST un 401
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

Depuis la session du propriétaire OU d'un membre, sur une TV de la famille —
jamais un invité. Le serveur exige le PIN de CE profil s'il en a un (mêmes
essais, même blocage) et ouvre la gestion dix minutes (`manageUntil`) ; sans
PIN, ouverte d'office. La réponse dit les droits de la session (`rights`).
Le propriétaire passe `ownerTv` (vue d'ensemble, candidats, inviter, annuler,
retirer un membre, régler ses droits, créer ou supprimer un invité) ; un
membre passe `memberTv` (vue d'ensemble, créer un invité s'il en a le droit,
supprimer les siens) — un geste de propriétaire lui répond
`family.not_owner`. JAMAIS depuis une TV : accepter, refuser, quitter, le PIN
d'un invité, dissoudre. Son PIN, si : depuis SA session de profil (« Code
PIN »).

### 7. La séquence de l'Apple TV (pour le client)

1. `/api/config` › `features.family` absent : le jumelage d'avant, rien ne change.
2. La TV porte un jeton d'avant : fermer son socket, `enrollTvProfiles`, garder
   le jeton de jumelage À LA PLACE de l'ancien — ne plus jamais présenter
   l'ancien (il vaut « revoked » partout : l'app se déjumellerait).
3. `fetchTvProfiles` (jeton de jumelage) : 401 `revoked` → déjumelée ;
   `stickyProfileId` → ouvrir ce profil (`remember: true`, sans PIN) ;
   sinon le compte seul, sans famille ni PIN, s'ouvre (`remember: false`) ;
   sinon « Qui regarde ? » (case « Ne plus proposer à l'ouverture » =
   `remember`, décochée après « Changer de profil »).
4. `openTvProfileSession` : le jeton de session devient LE jeton de l'app
   (préférences, socket, proxy, direct, rafraîchissement).
5. `family:profile-ended` sur le socket, ou 401 `profileEnded` à une porte :
   oublier le jeton de session, revenir au 3.
6. « Changer de profil » : `endTvToken(jeton de session)`, puis le 3.
   « Déjumeler » : `endTvToken(jeton de jumelage)`.
7. « Gérer les profils » (`canManage` ; le profil qui gère a un `manage`) :
   `unlockTvManage` (SON PIN s'il en a un), puis les routes `ownerTv` ou
   `memberTv` avec le jeton de session, selon `rights`.

## Le bureau : « Qui regarde ? » et « Changer de profil » (serveur 1.30.0)

Décisions du 14/10 (lot de nuit, à valider par Damien). Contrat :
`familyPickerContract.ts` ; routes `picker*` de `FAMILY_ROUTES` ; capacité
`family.desktopProfiles` — sans elle, le bureau ne montre rien de tout ceci.

### Le principe

Sur le bureau, la **session personnelle** (le jeton Jellyfin du compte, celle
d'avant) reste la RACINE : elle seule liste les profils et en choisit un
(`personal` ; jamais une session de profil, une TV ni « voir en tant que »).

- **SON profil** : la session personnelle continue — droits complets,
  administration comprise — APRÈS son PIN s'il en a un (`checkProfilePin` :
  le compteur et les blocages des TV, partagés). Rien n'est frappé : la
  réponse est `{ personal: true }` et la session de profil de l'appareil, s'il
  y en avait une, est fermée (`closed`).
- **Un AUTRE profil** de la famille du compte — la même liste que sur sa TV
  (`visibleProfiles`), propriétaire, membres, invités — : une **session de
  profil** aux règles des TV (PIN jugé par le serveur, `profileSessionLimits`,
  invité sans Watch Together, tickets, partage ni extensions sauf « peut
  demander »), une seule par appareil (la précédente `replaced`).
- **Limite assumée (SEC-F-51)** : le PIN de SON profil est un rideau
  d'interface sur un jeton que l'ordinateur détient déjà. Le serveur le juge
  (compteur, blocage), mais aucune garde serveur n'en dépend : quelqu'un qui
  lit le stockage de l'application sur l'ordinateur contourne ce rideau, comme
  avant les profils. Le PIN d'un AUTRE profil, lui, est une vraie barrière :
  sans lui, aucun jeton.

### L'hôte de l'appareil

Les sessions de profil d'un bureau sont les lignes ENFANTS d'un **hôte** :
une ligne `paired_devices` sans parent, `platform = desktop`, au compte de la
session personnelle, née au premier autre profil choisi
(`familyPickerHosts.ts`). Son empreinte est DÉRIVÉE du jeton personnel
(`sha256("tentacle:family-picker-host:" + jeton)`) : aucun jeton ne l'ouvre,
seul le porteur de la session personnelle l'atteint, et rien du corps
(`deviceName` compris) ne vise l'appareil d'un autre compte. Deux bureaux du
même compte : deux hôtes, deux sessions.

- Il tombe, ses sessions avec, à la **déconnexion du compte sur l'appareil**
  (`POST /api/auth/logout` au jeton personnel), à la suppression du compte, à
  l'époque de jumelage, et au balayage s'il n'a plus vu sa session
  personnelle depuis **trente jours** (`PICKER_HOST_IDLE_MS` : session du
  compte expirée, ordinateur disparu). Le bureau présente sa session
  personnelle à chaque lancement (la liste) : l'abandon recule.
- Les coupures de la Famille le traitent comme une TV du compte
  (`familySessions.ts`) : un membre qui part y perd les autres profils, son
  profil quitte les bureaux des autres ; invité supprimé, PIN changé,
  interrupteurs, dissolution : comme sur les TV.
- Il n'est pas un appareil jumelé : ni dans « mes appareils », ni dans la
  liste de l'administration.

### La session de profil du bureau regarde

- **Aucune route de la Famille** ne lui répond — ni la vue d'ensemble, ni son
  PIN, ni « Gérer les profils », ni les routes des TV (403
  `family.personal_session_required`, `familyCaller.ts`) : la Famille se gère
  depuis la session personnelle de chacun.
- **Aucun jeton Jellyfin** ne lui est remis : `/api/config/streaming` répond
  `enabled: false` (avec l'identité d'appareil à adopter). Sinon, un membre
  ouvrant sans PIN le profil d'un administrateur repartirait avec un vrai
  jeton administrateur. Tout passe par le proxy : clé prêtée, bornée à SON
  compte (`userScope`, chemin et query) et aux écritures d'un appareil
  (`deviceWrites`) ; une requête de catalogue SANS `userId` reçoit le sien
  (`deviceUserScope.ts`, plateforme signée dans le jeton) — sans quoi Jellyfin
  répondait pour la clé : toute la médiathèque, sans les droits du profil.
- Comme sur une TV, le serveur frappe pour elle un jeton Jellyfin PROPRE
  (Quick Connect), qu'il garde : reports de lecture, canal de session,
  tableau de bord de Jellyfin (la lecture y paraît au nom du profil, sur le
  nom de l'appareil). Sa coupure le supprime chez Jellyfin (`DELETE /Devices`).
- Ses portes, toutes celles d'un jeton d'appareil : `Bearer` partout, proxy
  (`api_key` des flux de mpv), socket (`family:profile-ended`, fermeture 4010),
  `/api/auth/refresh` (401 `profileEnded` une fois finie), `POST
  /api/pair/self/revoke` (la ferme). Refusés (`profileSessionLimits`) :
  téléchargements, push, jumelage, compte, comptes externes, invitations.

### « Qui regarde ? » au lancement (serveur 1.30.0, `family.pickerPolicy`)

**Par APPAREIL**, dans le cadre de l'**administration**. Chaque ordinateur
garde SON choix, sur la machine (shared `familyPickerDevice.ts`) : jamais
choisi, « proposer » (`tentacle_profile_launch_ask`) ou « ne plus proposer » —
un profil retenu (`tentacle_profile_launch_stay`) ; l'un efface l'autre, par
serveur et par compte ; une déconnexion les oublie. Un autre ordinateur du
compte garde le sien. L'administration (`family_launch_policy` dans
`server_config`, `GET`/`PUT /api/admin/family/picker`) règle :
- **Ordinateurs** : « Permis » (`off` : jamais, pour personne, et la case
  disparaît) et « Activé par défaut » (`defaultOn`, VRAI par défaut) pour un
  ordinateur qui n'a jamais choisi. `PickerProfilesDto.launchPolicy` le donne
  au bureau ; `atLaunch` n'est plus que le défaut, pour les bureaux d'avant.
- **Téléviseurs** : « Permis » seulement. Coupé (`TvProfilesDto.askAtLaunch`
  faux), chaque TV ouvre au lancement le profil du compte qui l'a jumelée,
  SANS PIN (tv-core `soloProfile`, variante `solo` : apps/tv ne change pas) ;
  le serveur l'en dispense — lui seul, et seulement quand aucun PIN n'est
  envoyé (« Changer de profil » le demande, et il se vérifie). Permis : le
  comportement de toujours (« Ne plus proposer à l'ouverture », propre à
  chaque TV).

L'ancienne préférence du COMPTE (`user_profile_picker_<compte>`, routes
`pickerPreference`) reste lue et écrite pour les bureaux d'avant ; plus rien
ne décide d'après elle. Sans objet sous deux profils (`pickerRequired`).
Le compte de démonstration n'ouvre que son propre profil ; un compte d'invité
(mot de passe réinitialisé par un administrateur) n'a pas de « Qui regarde ? »
(`family.guest_account`).

### La séquence du bureau (pour le client)

1. Capacité `family.desktopProfiles` absente : rien ne change.
2. Au lancement, `GET /api/family/picker/profiles?platform=desktop` au jeton
   PERSONNEL ; `withDeviceChoice` y pose la règle de l'appareil, puis
   `pickerLaunch` (shared) dit quoi faire : « Qui regarde ? » (cette règle, ou
   l'appareil sur un autre profil dont l'application n'a plus
   le jeton — jamais le compte sans son PIN), reprendre la session de profil
   gardée, ou la session personnelle.
3. Choisir : `POST /api/family/picker/sessions` `{ platform, profileId, pin?,
   deviceName? }` → `{ personal: true }` ou `{ personal: false, token }` ; le
   jeton de profil devient celui de l'application, le jeton personnel reste
   À PART (jamais présenté pendant une session de profil, sauf pour ces routes).
4. `family:profile-ended` ou 401 `profileEnded` : oublier le jeton de profil,
   revenir à « Qui regarde ? ».
5. Se déconnecter du compte : `POST /api/auth/logout` au jeton personnel.

### Le client du bureau (`apps/web/src/profiles/`, `apps/web/src/auth/`)

- **Les sessions** (`auth/profileSession.ts`, `auth/sessionSwap.ts`) :
  `tentacle_token` / `tentacle_user` portent la session ACTIVE, lue partout ;
  pendant un profil, la session personnelle est mise de côté
  (`tentacle_account_session`, identité Jellyfin adoptée comprise) et
  `tentacle_profile_session` marque le profil (nom, couleur, rôle). Chaque
  bascule recharge la page (`profiles/switch/commitPick.ts`) : PiP fermé,
  Watch Together quitté, cache persisté effacé, rideau au nom du profil posé
  avant le rechargement et levé après (`ProfileArrival`, monté par `main.tsx`).
- **L'ouverture** (`profiles/launch/`) : la porte d'`App.tsx`, avant tout le
  reste — rien n'est monté derrière le sélecteur. Décision immédiate depuis la
  dernière réponse du serveur gardée sur la machine (`tentacle_profile_launch`,
  par serveur et par compte, sans secret), relue en fond ; sans elle (premier
  lancement), l'application s'ouvre comme avant — aucun écran d'attente — et la
  réponse du serveur vaut si elle arrive dans les 1,5 s. Seule la fin d'un
  profil fait attendre le serveur. Un profil choisi dans l'exécution (stockage de session),
  une connexion par mot de passe : plus de sélecteur jusqu'à la fermeture,
  sauf la sécurité (`verifyOutcome`). Une préférence changée ailleurs vaut dès
  l'ouverture si le serveur répond dans l'attente bornée.
- **« Ne plus proposer à la prochaine ouverture »** (case de « Qui regarde ? »,
  à l'ouverture COMME depuis « Changer de profil », tant que l'administration
  le permet ; règles `familyPickerStay.ts` et `familyPickerDevice.ts`, shared) :
  le pendant du `stickyProfileId` de la TV, gardé sur l'ordinateur. Elle arrive
  cochée si cet ordinateur ne propose déjà plus, sinon décochée ; choisir un
  profil case cochée le retient, case décochée fait proposer de nouveau. Le
  profil retenu s'ouvre seul, sans son code (donné au choix) ; bloqué, « Qui
  regarde ? » case cochée ; parti ou code posé/retiré, oublié ; jamais un AUTRE
  profil que celui en cours sur l'appareil (`pickerLaunch` garde sa règle).
  Réglages › Famille (« Sur cet ordinateur ») en est l'interrupteur : rallumé,
  il efface le profil retenu ; éteint, il retient le profil en cours.
- **« Changer de profil »** (décision du 14/10 : pas d'accès rapide, la liste
  des profils a quitté le menu) : UNE entrée sous l'en-tête d'identité du menu
  de l'avatar — et, en fenêtre étroite, de sa feuille et de la page Profil (la
  barre du haut y passe sous la bande de la fenêtre macOS). « Gérer les
  profils » (session personnelle, `profiles/switcher/useProfileMenuItems.tsx`)
  ne reste que sur la page Profil : le menu et la feuille le laissent à « Qui
  regarde ? » et à Réglages › Famille (`menuProfileItems`, revue du 15/10). Là dès
  deux profils, « Qui regarde ? » à l'ouverture proposé ou non, depuis la session
  personnelle comme depuis celle d'un autre profil (pour revenir au sien,
  derrière son code) ; absente hors ligne. Elle ouvre le MÊME « Qui
  regarde ? » qu'à l'ouverture (`ProfileLaunchScreen`, mode `switching` ;
  règles : `switchPlan.ts`), posé SUR l'application
  (`WhoIsWatchingHost`, monté par `AppLayout`) : rien n'est démonté dessous
  (PiP, Watch Together, défilement), la coquille n'est plus peinte tant
  qu'il la couvre. « Annuler » (en haut à gauche, la place de la flèche du
  pavé) et Échap la rendent telle quelle, le focus revenu à l'avatar ; le
  focus arrive sur le profil en cours, et ce profil-là choisi referme
  l'écran sans code ni serveur ; « Gérer les profils » y mène tout droit à la
  Famille depuis la session personnelle (son code d'abord sinon). Une
  bascule quitte Watch Together, ferme le PiP et recharge, comme à
  l'ouverture. À l'ouverture de l'application, ni « Annuler » ni Échap :
  il n'y a nulle part où revenir.
- **La fin d'un profil** (`auth/profileEnded.ts`, `ProfileSessionBinding`,
  garde de session, `session:revoked`) : retour à la session personnelle, puis
  « Qui regarde ? » EXIGÉ au rechargement (la raison en stockage de session) —
  jamais la déconnexion, jamais le compte sans son PIN ; ignorée pendant une
  bascule voulue (« replaced »).
- **Ce qu'une session de profil tait** : administration, jumelage, contenu
  gardé et hors ligne, Sécurité, Famille (`useFamilyAvailability`), photo du
  compte, déconnexion (revenir à son profil d'abord) ; un invité perd en plus
  Watch Together et l'Aide.
- **Réglage coupé** : l'application rouvre le dernier profil de l'ordinateur
  (`pickerLaunch` › `resume`), le compte par défaut. Aucun raccourci clavier
  global : le menu de l'avatar se parcourt aux flèches, « Changer de profil »
  en tête.
- La TV LG ne compile rien de tout cela : sa porte est substituée et
  `apps/web/src/profiles/` sort de sa feuille.

## Qui agit : toujours le porteur du jeton

L'acteur se déduit du jeton, JAMAIS d'un identifiant du corps ou de la query
(un `ownerUserId` ou un `fromUserId` glissé dans un corps est ignoré). Aucune
route n'agit sur un identifiant de famille : elles visent LA famille du
porteur (il n'en a qu'une). D'où les réponses :

- un membre qui tente un geste de propriétaire (inviter, retirer, régler des
  droits, dissoudre) ou vise un invité qu'il n'a pas créé → 403
  `family.not_owner` ;
- tout autre compte → 404 `family.not_found` : la cible n'est pas dans SA
  famille ;
- une invitation dont on n'est ni l'émetteur ni le destinataire → 404, la même
  réponse qu'une invitation qui n'existe pas (rien ne confirme son existence) ;
  un membre de SA famille qui l'annulerait → 403 `family.not_owner`.

Les limites (6 profils, 3 invités, une famille par compte) tiennent sous des
gestes CONCURRENTS : chaque geste qui change la composition d'une famille s'y
exécute seul (verrou par famille), et « une famille par compte » est une
contrainte de la BASE (`family_members.userId` unique) : fonder sa famille
écrit d'abord la ligne du propriétaire, accepter écrit la ligne du membre
avant de clore l'invitation — la seconde de deux courses échoue
(`family.already_in_family`).

## Sessions personnelles, sessions de TV

Accepter, refuser, « plus tard », quitter, le PIN et la photo d'un invité, dissoudre :
**session personnelle** seulement — le jeton Jellyfin du web, du bureau, du
mobile. Jamais un jeton d'appareil (TV d'avant ou session de profil), jamais
« voir en tant que » : `family.personal_session_required`. Son propre PIN
fait exception : aussi depuis SA session de profil sur une TV (`tvProfile`),
jamais depuis le jeton de jumelage, une TV d'avant ni « voir en tant que ».

Une session de profil REGARDE (bibliothèque, lecture, notes, Ma liste,
préférences) mais n'administre rien : ni jumelage d'un autre appareil, ni
compte (suppression, mot de passe, comptes externes), ni push, ni
téléchargements, ni Famille personnelle, ni administration. Sans quoi un
membre retiré garderait un accès par une TV jumelée depuis son profil. Un
INVITÉ, en plus : ni Watch Together (REST et socket), ni tickets, ni liens de
partage — et aucune extension, sauf si le propriétaire lui a donné « peut
demander » : alors il les utilise à SON PROPRE NOM (voir ci-dessous) ; un
MEMBRE garde ses extensions sous SON identité, ses demandes sont les siennes. Une seule liste de préfixes refusés
(`services/family/profileSessionLimits.ts`), appliquée par `requireAuth` et
`requireAdmin` — donc aussi aux routes des extensions : 403
`family.personal_session_required` ou `family.guest_account`. Une session de
profil du BUREAU suit les mêmes limites et n'a, de plus, aucune route de la
Famille (voir « Le bureau »).

### L'invité et les extensions (« peut demander »)

Décision de Damien (v2, corrigée le 04/10 : plus de délégation) : un invité à
qui le propriétaire — lui seul — a donné « peut demander des films »
(`FamilyGuestRights.requestTitles`, coupé par défaut) utilise les extensions
(Vigie…) À SON PROPRE NOM. Un mécanisme GÉNÉRIQUE du cœur, sans rien de propre
à une extension (`services/family/familyGuestExtensions.ts`, appliqué par
`requireAuth` via `profileSessionLimits.ts`) :

- **où** : les routes d'extension, et elles seules — `/api/plugins/…` (le cœur :
  `/active`, `/:id/bundle` ; chaque extension : `/api/plugins/<id>/…`).
  Partout ailleurs, rien ne change pour lui : ni Watch Together, ni tickets,
  ni partage ;
- **ce que reçoit l'extension** dans `request.user` : l'invité lui-même — son
  identifiant Jellyfin, `isAdmin: false`, `session: "tvProfile"` — et pour nom
  celui de son COMPTE Jellyfin (« Zoe - invite de Damien ») : unique et
  stable, quand le prénom du profil (« Zoé ») peut être celui d'un autre
  compte. Personne n'agit pour un autre ; une route `requireAdmin`
  d'extension lui répond 403 ;
- **sans le droit** : 403 `family.guest_account` sur toute route d'extension,
  que les clients traitent comme « aucune extension » ;
- **retrait** : le droit se lit en base à CHAQUE requête — retiré, il coupe à
  l'appel suivant ; la session de l'invité l'apprend aussi par
  `family:update` ;
- **proposé seulement s'il a un sens** : `features.family.guestRequests` est
  vrai quand une extension ACTIVE et CONFIGURÉE déclare la demande du contrat
  `titles` (`titles.request`, `services/pluginRequests.ts`) — aucune
  extension n'est nommée ; sinon les clients n'offrent pas l'interrupteur ;
- **les membres** : aucun droit de la Famille à ce sujet — leurs extensions
  sont les leurs, sous leur identité.

Côté Vigie (vérifié dans son dépôt, rien n'y change) : une demande part au
nom du compte qui la fait ; un compte inconnu de Jellyseerr y est importé
depuis Jellyfin à sa première demande (un compte caché aussi), sinon un
compte local Jellyseerr à son nom.

### Le proxy : un appareil n'écrit que ses données

Pour tout jeton d'appareil (TV d'avant, session de profil), le proxy
`/api/jellyfin/*` prête la clé d'administration de Jellyfin. Il ne laisse
donc passer, en écriture, que ce que les TV livrées envoient — relevé le
2026-10-04 sur l'Apple TV, l'Android TV (depuis tv-v1.0.0) et la LG :
négociation de lecture, reports de lecture, données de lecture, vu, favori,
Ma liste, arrêt de son transcodage (`routes/jellyfinProxy/deviceWrites.ts`,
`DEVICE_WRITE_ROUTES`). Toute lecture reste jugée par la liste blanche des
chemins ; toute autre écriture : 403, rien n'atteint Jellyfin. Un nouveau
geste d'écriture d'une TV s'ajoute à cette liste, nommé et testé.

## Invitations

- Candidats (`GET /api/family/candidates?q=`, v2) : TOUS les comptes du
  serveur, cachés de l'écran de connexion de Jellyfin compris (la Famille vit
  dans une instance — décision de Damien), affinés par la saisie (quelques
  lettres suffisent) ; jamais un invité, soi-même, un compte désactivé, le
  compte de démonstration (`familyCandidates`). Un compte déjà dans une
  famille est rendu `in_family` — sans dire laquelle —, une invitation de la
  famille l'attend : `invited` ; seul `available` s'invite. Au propriétaire
  (ou à un compte sans famille) seulement : un membre reçoit
  `family.not_owner`.
- Une famille par compte : la cible d'une invitation n'est dans aucune famille
  (`family.already_in_family`, `already_member` si c'est la vôtre). Qui entre
  dans une famille — en acceptant une invitation, ou en fondant la sienne —
  voit ses autres invitations reçues closes (et retirées de sa cloche).
- Identifiant d'invitation : 128 bits aléatoires (base64url) — jamais un
  cuid —, porté dans le CORPS des gestes (`InvitationActionBody`), jamais dans
  une URL : le serveur journalise ses URL. Les journaux n'en montrent que le
  début. Et chaque geste vérifie le destinataire.
- Expire en 7 jours : accepter une invitation expirée → 410
  `family.invite_expired`. Anti-abus (`inviteBlock`) : une seule en attente par
  (famille, compte) ; 7 jours après un refus du même compte ; 10 envois par
  24 h et par propriétaire ; 10 en attente par destinataire. Créer un invité
  (un compte Jellyfin) : 6 par 24 h et par famille, tous créateurs confondus
  (`guestQuotaBlock`).
- Le destinataire est prévenu par la cloche (`family_invite`), un push
  (préférence `family`, activée par défaut) et l'AFFICHE au lancement du web,
  du bureau et du mobile (`incoming`, en direct par `family:update`
  `invitations`). « Plus tard » la tait 24 h (`snoozedUntil`), la cloche garde.
- Le propriétaire voit ses invitations en attente (annulables) et la réponse
  dans sa cloche (`family_invite_accepted` / `_declined`).

## Code PIN

Quatre chiffres par profil, facultatif. Chacun le pose, le change ou le
retire pour lui-même (`PUT /api/family/pin`, `SetOwnPinBody`), en session
personnelle ou depuis SA session de profil sur une TV — l'acteur est toujours
la session, jamais le corps. Le changer ou le retirer exige le PIN actuel
(`currentPin`), sur toute session, compté comme à l'ouverture d'un profil
(`pin_required`, `pin_invalid`, `pin_locked`) ; un nouveau PIN mal formé est
refusé avant tout essai. Jamais un invité (`family.guest_account`) : le sien,
le propriétaire ou le membre qui l'a créé le pose ; jamais le compte de
démonstration (`family.review_account`). Haché par scrypt
(sel propre), jamais rendu. Les essais se comptent PAR PROFIL, toutes TV
confondues (`profile_pin_attempts`) : changer de TV ne remet pas le compteur à
zéro. Cinq, puis 15 min, 1 h, 4 h, 24 h de blocage
(`FAMILY_PIN_LOCK_STEPS_MS`) ; pendant un blocage, même le bon PIN échoue ;
une réussite efface. Poser, changer ou
retirer un PIN coupe le profil sur les TV et ôte « Rester sur ce profil » —
sauf, quand un profil change SON PIN depuis une TV, la session de cette TV et
son « Rester », qui restent.
Le PIN de chacun protège aussi SA gestion des profils sur les TV.

## La photo d'un invité (serveur 1.30.0)

Un invité est un compte Jellyfin caché, sans mot de passe : personne ne peut
y changer sa photo comme on change la sienne. Le serveur la relaie donc
(`PUT /api/family/guests/:userId/photo`, `SetGuestPhotoBody` → `GuestPhotoDto`),
avec SA clé, aux mêmes droits que le PIN de l'invité : le propriétaire, ou le
membre qui l'a créé (`canManageGuest` ; un autre membre : `family.not_owner`,
hors de la famille : `family.not_found`). Session personnelle seulement.
L'image voyage en base64 nu (JPEG, PNG ou WebP, `FAMILY_GUEST_PHOTO_MAX_BASE64`
au plus ; au-delà de la limite de la route, 413 avant toute lecture) ; un
refus de Jellyfin rend `family.jellyfin_refused` ou `family.jellyfin_unavailable`.
Rien ne tombe : ni ses sessions, ni son « Rester ».

Depuis, l'étiquette d'un invité n'est plus forcée à `null` : la vue de la
famille, la TV et « Qui regarde ? » rendent la sienne (`imageTag`) ; un
serveur d'avant rend toujours `null`. Capacité : `family.guestPhotos`.

Les clients ouvrent la galerie des avatars (personnages ou photo importée) :
- **Réglages › Famille** (web, bureau) : « Changer la photo » sur chaque invité
  que le compte gère ;
- **session de profil d'un invité sur le bureau** : « Changer la photo » dans
  le menu de l'avatar, et l'invitation unique s'il n'en a pas — l'appareil
  l'habille par SA session personnelle, si le serveur le dit
  (`PickerProfileDto.photoEditable`) ;
- l'Apple TV, Android TV et le mobile la MONTRENT (la TV LG n'a pas de profils).

## Temps réel, cloche, push

- `family:update` `{ scope: "family" | "invitations" }` (v1 : `owned`,
  `memberships`) : relire `["family"]` (`useFamilyLive`, quelle que soit la
  portée). Un changement de la famille partagée prévient son propriétaire ET
  chacun de ses membres (`notifyFamily`).
- `family:profile-ended` `{ reason }` sur le socket d'une session de profil,
  puis fermeture 4010.
- La cloche garde des DONNÉES : `title` = le nom de l'autre, `refId` =
  l'invitation ou la famille ; le client compose la phrase
  (`family:notifications.<type>`). Une invitation répondue, annulée ou expirée
  quitte la cloche du destinataire.
- Push : seule `family_invite` part (préférence `family`).

## Le web et le bureau (même build)

- **Réglages › Famille** (`/settings/family` ; `/family`, la route de la
  cloche, y mène ; le miroir la sert en volet du profil) : seulement si
  `/api/config` annonce la Famille — on attend sa réponse avant de conclure.
  v2 : LA famille, la même pour le propriétaire et ses membres
  (`FamilySection`) — le propriétaire invite, annule, retire, règle « peut
  créer des invités » et dissout ; un membre voit tout, crée des invités s'il
  en a le droit, ne gère que les siens, et « Quitte la famille ». Les gestes
  viennent de `familyActions` / `profileActions` (shared) ; les candidats :
  tous les comptes d'emblée, les non invitables grisés (`candidateView`).
  Invitations reçues seulement sans famille ; mon PIN. Code :
  `apps/web/src/family/`.
- **L'affiche** est montée une fois par `AppLayout` (bureau comme miroir,
  jamais sur le lecteur), avec `useFamilyLive` ; « Plus tard » et la
  fermeture la taisent, la cloche rouvre l'invitation qu'on clique. Règles
  pures, communes au mobile : shared `family/familyClient.ts`.
- **Administration** : les interrupteurs vivent dans Admin › Utilisateurs (un
  réglage, pas une alerte) ; les sessions en cours étiquettent l'invité
  (`FamilyGuestTag`).
- **« Qui regarde ? » et « Changer de profil »** : le bureau seulement,
  face à un serveur qui déclare `family.desktopProfiles` — voir « Le
  bureau ».
- Éprouvé en HTTP sur une IP du réseau : rien n'y dépend de `crypto.subtle`,
  `crypto.randomUUID` ni du presse-papiers ; le cookie de session part sans
  `Secure` sur HTTP.

## Le compte de démonstration (revue Apple)

Reconnu par le serveur : le compte de provisionnement désigné dans
l'administration (`provisioning_codes.jellyfinUserId`), et celui du mode
démonstration. Il ne crée RIEN — ni famille, ni invité, ni invitation, rien
chez Jellyfin : 403 `family.review_account`. Il n'est jamais candidat et ne
rejoint aucune famille (`account.reviewAccount`). Sa TV ne montre pas « Gérer
les profils » (`canManage: false`) : les relecteurs ne voient jamais un geste
refusé.

## Administration

Deux interrupteurs dans `server_config`, ACTIVÉS par défaut
(`GET`/`PUT /api/admin/family`, administrateur en session personnelle) :
« Familles » et « Profils invités ». Les couper refuse toute nouvelle action
(inviter, accepter, créer un invité, ouvrir un profil coupé) et coupe les
sessions de profil en cours avec leur « Rester » — pour le premier, tout profil
autre que le compte de chaque TV ; pour le second, les invités — ; les
rallumer ne ressuscite aucune session. La session du compte de chaque TV
reste. Retirer, quitter,
supprimer un invité et dissoudre restent possibles : ils ne font que réduire.

**Droits de création** (1.30.0, `family.creationRights`) : par compte, « créer
une famille » et « créer des profils invités », chacun Par défaut / Permis /
Refusé (`GET`/`PUT /api/admin/family/accounts/:userId`, rubrique « Famille »
de la fiche d'un compte) ; les deux DÉFAUTS sont sur NON
(`GET`/`PUT /api/admin/family/creation`). L'administration ne montre plus
l'interrupteur et le défaut séparément (quatre bascules qui semblaient dire
deux fois la même chose) : une rangée par fonction, trois positions —
Coupées (interrupteur coupé), Comptes permis (défaut NON), Tous les comptes
(défaut OUI) ; règle `apps/web/src/components/admin/users/familyAccess/
familyAccessModel.ts`. Les interrupteurs
restent maîtres, un administrateur Jellyfin peut toujours, et seules les
NOUVELLES créations se gardent (`family.create_family_denied`,
`family.create_guests_denied`) : une famille et des invités déjà là restent.

« Qui regarde ? » à l'ouverture, plateforme par plateforme (même page, section
voisine, `FamilyLaunchPolicySection`) : voir « Qui regarde ? » au lancement
(bureau) — aucune session n'est fermée, la règle vaut au prochain lancement.

## Côté serveur

| Sujet | Fichier (`apps/backend/src/services/family/`) |
|-------|------|
| Refus typés (code → statut du contrat) | `familyErrors.ts` |
| Interrupteurs, capacité, compte de démonstration | `familyConfig.ts` |
| PIN (scrypt), essais et blocages | `familyPins.ts` |
| Un geste à la fois par famille | `familyLock.ts` |
| Marqueur « invité » des listes, étiquette des sessions | `familyGuestMarkers.ts` |
| Cloche, push, socket | `familyNotify.ts` |
| Familles et profils en base (`familyOf` : la famille d'un compte et son rôle), refus 403 / 404 | `familyStore.ts` |
| Coupure des sessions de profil (avant la réponse) | `familySessions.ts` |
| Un invité autorisé et les extensions (à son nom) | `familyGuestExtensions.ts` |
| Comptes Jellyfin des invités | `guestAccounts.ts` |
| Journal durable des comptes d'invités à supprimer | `guestAccountCleanup.ts` |
| Invitations ; réponses et expiration | `familyInvitations.ts`, `familyInvitationAnswers.ts` |
| Invités et leur PIN ; membres, dissolution, compte disparu | `familyGuests.ts`, `familyMembers.ts` |
| Son propre PIN (session personnelle ou session de profil) | `familyOwnPin.ts` |
| Vue d'ensemble, candidats | `familyOverview.ts`, `familyCandidates.ts` |
| Apple TV : échange ; profils et sessions | `familyTvEnroll.ts`, `familyTv.ts` |
| Ouvrir, fermer la session de profil d'un appareil (TV, bureau) | `familyProfileSession.ts` |
| Le bureau : « Qui regarde ? », son hôte, « au lancement » (politique, ancienne préférence) | `familyPicker.ts`, `familyPickerHosts.ts`, `familyLaunchPolicy.ts`, `familyPickerPreference.ts` |
| Garde d'appelant des routes | `familyCaller.ts` |
| Périmètre des sessions de profil | `profileSessionLimits.ts` |
| Balayage (10 min) | `familySweep.ts` |
| Droits de création (défauts, par compte), fiche d'administration | `familyCreationRights.ts`, `familyAccountAdmin.ts` |
| Rôle de parent | `familyMemberRoles.ts` |
| Membre mineur : pose, base (règle pure), état en base, guet et base rendue | `memberParental.ts`, `memberParentalRules.ts`, `memberParentalStore.ts`, `memberParentalSync.ts` |

Le balayage (toutes les dix minutes et au démarrage) : les comptes d'invités
au journal des suppressions partent de Jellyfin ; les invitations échues
sortent de la cloche ; un compte disparu de Jellyfin (supprimé depuis son
tableau de bord) emporte sa famille ou son adhésion ; un compte DÉSACTIVÉ perd
ses sessions de profil ; une session de profil qu'aucune TV ne devrait plus
montrer est coupée (`family_changed`) et son « Rester » oublié. Jellyfin muet :
rien n'est conclu.

### Un invité supprimé l'est vraiment

Un compte d'invité ne se supprime QUE par un journal durable,
`guest_account_cleanups` (comme `paired_device_cleanups` pour les appareils) :

- suppression d'un invité, dissolution (geste du propriétaire, ou compte du
  propriétaire disparu) : l'invité quitte la base et son compte entre au
  journal dans la MÊME transaction. Le geste aboutit toujours — Jellyfin
  injoignable ou qui refuse ne l'arrête plus — ; le compte part aussitôt, et
  jusqu'à confirmation sinon ;
- création : le compte entre au journal dès que Jellyfin en rend
  l'identifiant (`creating`), et en sort quand la ligne de l'invité existe.
  Une création qui échoue (`abandoned`) ou qu'un plantage interrompt ne laisse
  aucun compte — jamais balayée avant cinq minutes : une création en cours
  n'est pas morte ;
- nouvel essai à 1 min, 5 min, 15 min, 1 h, puis toutes les 6 h, au
  démarrage et à chaque balayage ; journal `[family] Compte invité « … »` ;
- jamais une personne de la Famille (propriétaire, membre, invité vivant),
  jamais un administrateur : l'entrée est soldée, le compte reste. Un compte
  inconnu de Jellyfin compte pour supprimé ;
- tant qu'il existe, le compte reste un invité pour toutes les listes.

Le départ ou le retrait d'un membre ne supprime aucun compte : ses invités
restent dans la famille. Ce que le journal ne couvre pas, faute d'identifiant
à y écrire : la réponse perdue d'un `POST /Users/New` (Jellyfin au-delà de
5 s), un plantage entre cette réponse et l'écriture du journal ; base muette
à cet instant, le compte est supprimé sur-le-champ, sans rejeu.

### La migration v1 → v2 (`core-init.sql`)

Rejouable, sans rien perdre ; sur une base déjà en v2, rien ne bouge :

1. chaque famille reçoit la ligne de son propriétaire (`owner-<famille>`) ;
2. les invités d'avant la v2 reçoivent leur créateur — le propriétaire de LEUR
   famille, dit avant toute fusion ;
3. un compte dans plusieurs familles garde la plus ANCIENNE (date, puis
   identifiant) ; ses autres lignes partent ;
4. une famille dont le propriétaire est resté dans une autre (plus ancienne) y
   est FUSIONNÉE : ses membres et ses invités le suivent (chaînes comprises),
   ses invitations en attente se closent, puis elle disparaît, vide ;
5. les invitations en attente vers un compte désormais dans une famille se
   closent, et quittent sa cloche ;
6. l'index unique `family_members_userId_key`.

Exemple — l'essai du 04/10 : deux familles croisées (chacun propriétaire de la
sienne et membre de celle de l'autre) deviennent UNE famille, la plus ancienne
— son propriétaire, l'autre membre. Le balayage du démarrage coupe ensuite les
sessions de profil que la fusion a rendues impossibles. Banc : MariaDB 11 et
MySQL 8.0/9.6, données de chaque cas, rejeu idempotent.

Journaux : préfixe `[family]`, jamais un jeton, un PIN ni un mot de passe ;
une invitation n'y paraît que par le début de son identifiant.

## Preuves

- Bancs de bout en bout (vraies routes, base en mémoire, faux Jellyfin qui
  crée et supprime des comptes) : `apps/backend/test/family*.test.ts` — Apple
  TV, PIN et gestion, invitations, révocations, périmètre et listes, balayage ;
  v2 : `familyOneFamily` (une famille par compte, courses comprises ; invités
  des membres et leur politique), `familySharedTv` (TV de membre, coupures,
  gestion d'un membre), `familyMemberRights`, `familyGuestRequests` (le
  droit « peut demander » : l'invité à son nom, sur les extensions seules),
  `pluginRequests` (la capacité), `familyOwnPinTv` (son PIN depuis sa
  session de profil), `familyGuestCleanup` (un invité supprimé
  l'est vraiment : Jellyfin qui refuse ou se tait, plantage, création ratée).
- Le bureau : `familyPicker` (liste, choix, PIN partagé avec les TV,
  interrupteurs, deux bureaux), `familyPickerLifecycle` (déconnexion,
  rafraîchissement, coupures de la Famille, balayage, listes d'appareils,
  préférence), `configStreamingProfile` (aucun jeton Jellyfin), attaques
  `famille-securite/familleBureau*.attack.test.ts` (SEC-F-46..53, proxy
  compris). Banc réel (Jellyfin 10.11.11, 14/10) : parcours complet par
  l'API — 48 vérifications, lecture d'un film par le proxy comprise.
- Proxy : `apps/backend/test/jellyfinProxyDeviceWrites.test.ts` (vrai serveur
  amont).
- Un VRAI Jellyfin jetable (10.11 et 12.1) : `test/jellyfin-compat/suites/
  family.compat.ts` — compte invité caché, sans droit, mot de passe inconnu ;
  jeton Quick Connect propre à chaque session de profil ; coupures jusqu'à
  `DELETE /Devices` ; membre retiré, compte intact.
- Les tests d'attaque de T8 : `apps/backend/test/famille-securite/`.
- 1.30.0 : `familyCreationRights`, `familyParentRole`, `familyMemberParental`
  (`apps/backend/test/`) ; banc réel `test/famille-roles/banc/` (Jellyfin 10.11
  jetable : un membre « ≤ 6 ans » filtré par Jellyfin avec son jeton, base
  rendue à l'octet près, guet).

## Compatibilité

- Capacité : `/api/config` › `features.family` (`{ v, enabled, guests,
  guestRequests }` — `v: 2` depuis la Famille partagée ; `guestRequests` : le
  droit « peut demander » a un sens ici, une extension sachant demander un
  titre).
  Absente : serveur d'avant — les clients ne montrent rien de la Famille ; pas
  de minServer imposé.
- Parents, membres mineurs, droits de création : capacités `family.roles`,
  `family.memberParental`, `family.creationRights` (1.30.0) — absentes, les
  clients ne montrent ni rôle, ni contrôle d'un membre, ni réglage de création ;
  champs ajoutés aux DTO (`parent`, `manageRoles`, `manageMinors`, `creation`).
- Le bureau : capacité `family.desktopProfiles` (`capabilities`, 1.30.0) ;
  absente, le bureau garde sa seule session personnelle, sans « Qui
  regarde ? » ni « Changer de profil ».
- Une TV d'avant les profils garde son jumelage ; les clients publiés ne
  voient aucun changement (champs ajoutés, jamais retirés).

## Sécurité

Tout se décide côté serveur, à l'identique en HTTP et en HTTPS : rien ne
dépend du TLS, d'un cookie Secure ni d'une API web réservée aux contextes
sécurisés. Aucun jeton ni PIN dans une URL ni un journal (`[family]` sans
secret). Personne ne peut inviter au nom d'un autre, accepter à la place d'un
autre, entrer sans invitation, appartenir à deux familles, ouvrir un profil
depuis une TV qui n'est pas celle d'une personne de sa famille, obtenir un
jeton pour un compte hors de sa famille, garder un accès après un retrait,
gérer un invité qu'il n'a pas créé (membre), prêter à un invité plus de
bibliothèques que son créateur n'en a, deviner un identifiant d'invitation,
contourner un PIN, ni atteindre une fonction d'administration par un profil —
ni, sur un bureau, repartir avec un jeton Jellyfin d'un autre compte. Seule
limite assumée : le PIN de SON propre profil sur un bureau, rideau
d'interface sur une session que l'ordinateur détient déjà (« Le bureau »).
La liste des comptes du serveur (cachés compris, décision de Damien) ne se
rend qu'au propriétaire ou à un compte sans famille — jamais à un membre, un
invité ni un jeton de TV non déverrouillé.
