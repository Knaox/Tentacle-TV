/**
 * Les CAPACITÉS du serveur — le serveur décide de ce que les clients montrent.
 *
 * Un client ne montre JAMAIS une option, une section ou une fonction que son
 * serveur ne sait pas faire : un appareil à jour face à un serveur plus ancien
 * n'en voit rien et n'en subit aucun effet. Le serveur déclare ce qu'il sait
 * faire dans `GET /api/config` → `capabilities` ; les clients ne lisent que
 * cette déclaration, par une seule porte (`useServerCapability`,
 * `ServerCapabilityGate` dans api-client) — jamais un `if (version >= x)`.
 *
 * Une fonction purement CLIENT (fréquence d'écran, réglages du lecteur…)
 * n'a pas de clé : rien ne dépend du serveur.
 *
 * MIROIR : ce fichier est recopié octet pour octet dans
 * `apps/backend/src/serverCapabilities/serverCapabilities.ts` (le backend ne
 * dépend pas de `@tentacle-tv/shared` — tsc CommonJS, image Docker sans
 * packages/). On le modifie ICI, puis :
 *
 *   cp packages/shared/src/serverCapabilities/serverCapabilities.ts apps/backend/src/serverCapabilities/
 *
 * `capabilitiesMirror.test.ts` (backend) refuse toute divergence. Aucun
 * import : le fichier doit compiler seul des deux côtés.
 */

/**
 * Liste FERMÉE : clé → version du serveur qui l'a apportée (`since`).
 *
 * ⚠️ Les clés traversent le réseau (JSON de `/api/config`) : une clé ne se
 * RENOMME jamais et ne se retire pas tant qu'un client livré la lit. Une
 * nouvelle fonction qui dépend du serveur ajoute SA clé ici, avec la version
 * du serveur qui la livrera.
 *
 * `since` ne sert qu'aux serveurs d'AVANT la déclaration (≤ 1.23.x), qui ne
 * rendent pas `capabilities` : une clé y vaut présente si leur version atteint
 * `since`. Toutes les clés d'aujourd'hui datent de 1.24.0 : un serveur d'avant
 * n'en a donc aucune, et les clients restent dans le comportement d'avant.
 * Dès qu'un serveur déclare, SA liste fait foi, quelle que soit sa version.
 */
export const SERVER_CAPABILITIES = {
  /** L'état de Jellyfin suivi et dit aux lecteurs : `server:jellyfin` sur le canal
   *  de session, `/api/health` › `jellyfin`, et la reprise des lectures à son retour. */
  "jellyfin.health": "1.24.0",
  /** « Installer / réparer la détection des passages » (`/api/admin/jellyfin/segment-plugins`)
   *  et sa recommandation du tableau de bord. */
  "admin.segmentPlugins": "1.24.0",
  /** La section d'administration « Accès à distance » (`/api/admin/remote-access`). */
  "admin.remoteAccess": "1.24.0",
  /** « Accès depuis l'extérieur » qui gouverne ce qui est publié, l'adresse publique
   *  détectée (`/api/admin/remote-access/public-ip`) et la lecture directe sans
   *  adresse publique de Jellyfin (l'adresse privée suffit). */
  "admin.remoteExposure": "1.24.0",
  /** Les titres demandés masqués des recommandations (`GET /api/reco/requested`). */
  "reco.requestedTitles": "1.24.0",
  /** L'état des sessions du tableau de bord décrit par le serveur : « direct »,
   *  « En analyse », limite de débit de l'appareil (`transcodeMemory`). */
  "admin.sessionStates": "1.24.0",
  /** Le passage de MariaDB à SQLite dit aux clients : `/api/health` › `database`
   *  (`migrating`, `failed`) et les 503 `{ state: "migrating" }` du mode maintenance —
   *  l'écran d'attente, jamais une panne. */
  "server.databaseMigration": "1.25.0",
  /** Le lecteur de bande-annonce des téléviseurs : `GET /api/trailers/resolve` rend
   *  aussi `qualities` (un maître relayé par hauteur) et `subtitles` (les pistes de
   *  YouTube, relayées en WebVTT). Sans elle, ni qualité ni sous-titres à l'écran. */
  "trailers.player": "1.26.0",
  /** L'app Windows : le Jellyfin de la machine détecté, installé (installateur officiel vérifié)
   *  et démarré par son hôte depuis l'assistant (`/api/setup/jellyfin/local`, `/install`, `/start`). */
  "setup.jellyfinInstall": "1.27.0",
  /** L'app Windows : la boîte « Choisir un dossier » de l'Explorateur pour les bibliothèques
   *  (`/api/setup/jellyfin/pick-folder`), depuis un navigateur sur la machine même. */
  "setup.folderPicker": "1.27.0",
  /** « Réanalyser maintenant » : une vraie analyse demandée à Jellyfin par la clé d'administration
   *  (`POST /api/admin/library/rescan` — un titre, ou toutes les bibliothèques). */
  "admin.libraryRescan": "1.27.0",
  /** La rangée « Films pour vous » de la page reco (`?themes=1`, clé de rangée
   *  `forYouMovies`), que l'accueil peut aussi épingler. */
  "reco.moviesRow": "1.27.1",
  /** L'aperçu de bande-annonce au survol d'une carte : `GET /api/trailers/preview`
   *  (un titre de la bibliothèque, ou un titre TMDB) rend une bande-annonce choisie,
   *  VÉRIFIÉE et relayée par ce serveur — ou un refus, et rien ne s'anime. */
  "trailers.preview": "1.30.0",
  /** « Qui regarde ? » sur le BUREAU et « Changer de profil » : les routes
   *  `/api/family/picker/*` (profils de la famille, session de profil d'un appareil
   *  ouverte par la session personnelle, préférence « au lancement » par plateforme). */
  "family.desktopProfiles": "1.30.0",
  /** La photo d'un invité de la Famille, posée par son propriétaire ou son créateur
   *  (`PUT /api/family/guests/:userId/photo`) : la galerie des avatars s'ouvre
   *  pour lui — Réglages › Famille, et sa session de profil sur le bureau. */
  "family.guestPhotos": "1.30.0",
  /** « Vous regardez encore ? » : le réglage du COMPTE (`GET/PUT /api/preferences/still-watching`,
   *  diffusé en direct, portée `still-watching`). Sans elle, la fonction ne tourne pas : un appareil
   *  à jour face à un serveur d'avant ne met jamais une lecture en pause de lui-même. */
  "playback.stillWatching": "1.30.0",
  /** « Qui regarde ? » à l'ouverture réglé par l'administration, plateforme par plateforme
   *  (`GET/PUT /api/admin/family/picker` : coupé pour tous, ou laissé au choix de chaque
   *  appareil — le bureau avec un défaut) ; `launchPolicy` dans « Qui regarde ? » du bureau,
   *  `askAtLaunch` dans celui des TV. */
  "family.pickerPolicy": "1.30.0",
  /** Le catalogue des bandes-annonces d'un titre : `GET /api/trailers/catalog` rend la liste
   *  ORDONNÉE par le serveur (la saison de l'épisode d'abord, la langue du serveur d'abord),
   *  AlloCiné compris (serveur français), lue par le relais — Dailymotion aussi — avec le repli
   *  `409 { fallback: "embed" }` quand YouTube bride ; et la carte « Bandes-annonces » de
   *  l'administration (`/api/admin/trailers`). */
  "trailers.catalog": "1.30.0",
  /** La préparation des aperçus : `POST /api/trailers/preview/warm` — le client dit les titres à
   *  l'écran, le serveur prépare leur aperçu en fond (jamais d'extraction YouTube) et rend ceux qui
   *  sont prêts : leur survol n'a plus rien à demander. Sans elle, l'aperçu se décide au survol. */
  "trailers.previewWarm": "1.30.0",
  /** Les droits d'un compte, lus et écrits dans SA politique Jellyfin depuis l'administration
   *  (`/api/admin/users/:userId/rights`, `/api/admin/users/rights/options`) — web et bureau. */
  "admin.userRights": "1.30.0",
  /** Le contrôle parental d'un invité de la Famille (`PUT /api/family/guests/:userId/parental`),
   *  posé par son propriétaire ou son créateur ; son état dans `FamilyProfileDto.parental`. */
  "family.parentalControls": "1.30.0",
  /** Chaque notification porte sa CIBLE et son ÉTAT (`notifications/notificationTarget.ts`) :
   *  `GET /api/notifications` sert `target` et `state`, le push emporte `data.target`. La cloche
   *  ouvre sans elle la route du type, comme avant ; l'écran des nouveautés n'en parle qu'avec elle. */
  "notifications.targets": "1.30.0",
  /** Les sources « Pour vous — Films » et « Pour vous — Séries » du bandeau principal de
   *  l'accueil (`heroMode` `recoMovies` / `recoSeries`, `/api/preferences/home-layout`) :
   *  un serveur d'avant refuserait la mise en page qui les porte. */
  "home.heroRecoKinds": "1.30.0",
  /** Supprimer des titres de la bibliothèque (web, bureau) : `GET /api/library/deletion/rights`
   *  dit où le compte peut supprimer, `POST /api/library/deletion` supprime par le jeton DU
   *  COMPTE, titre par titre (Jellyfin juge chacun), et fait tomber les caches du serveur. */
  "library.delete": "1.30.0",
  // ── Lot « droits 2 » (2026-10-15), fiche des droits et partage public ──
  /** Le droit « Partage public » de Jellyfin (`EnablePublicSharing`) gouverne tout lien
   *  public — Ma liste, favoris, statistiques : `GET /api/share/access` dit au compte s'il
   *  peut partager ; sans le droit, la création est refusée et ses liens existants ne
   *  servent plus rien. Sans la clé, les boutons « Partager » restent comme avant. */
  "share.publicRight": "1.30.0",
  // ── Lot « droits 2 », S4 : la Famille — parents, membres mineurs, droits de création ──
  /** Le rôle de PARENT (`PUT /api/family/members/:userId/role`, `FamilyProfileDto.parent`) : le
   *  propriétaire le donne à un membre, qui gère alors les enfants (invités, membres mineurs). */
  "family.roles": "1.30.0",
  /** Le contrôle parental d'un MEMBRE mineur (`PUT /api/family/members/:userId/parental`), écrit
   *  dans sa politique Jellyfin (base ∩ voulu), base rendue à l'identique au retrait. */
  "family.memberParental": "1.30.0",
  /** Les droits de créer une famille et des invités, par compte (`/api/admin/family/accounts/:userId`)
   *  et leur défaut (`/api/admin/family/creation`) ; `FamilyAccountDto.creation` ; refus
   *  `family.create_family_denied` / `family.create_guests_denied`. */
  "family.creationRights": "1.30.0",
  /** Gérer la Famille depuis une SESSION DE PROFIL, TV ou bureau : le propriétaire ou un membre,
   *  avec les droits de son rôle, derrière SON code PIN — un code posé depuis sa session personnelle
   *  (`family/familyCallers.ts`). Sans elle, le bureau ne montre rien de la Famille à un profil. */
  "family.profileManage": "1.30.0",
  /** Les BIBLIOTHÈQUES qu'une famille permet à un invité ou à un membre mineur
   *  (`GET|PUT /api/family/profiles/:userId/libraries`), écrites dans sa politique Jellyfin
   *  (plafond ∩ voulu), rendues au départ. Sans elle, le contrôle parental n'en montre rien. */
  "family.libraryLimits": "1.30.0",
  /** L'administration décide si les invités peuvent demander des films : l'interrupteur
   *  `FamilySwitches.guestRequests` (COUPÉ par défaut, mise à jour comprise) et le droit de compte
   *  `grantGuestRequests` (défaut NON, `FamilyAccountDto.creation`) ; refus
   *  `family.guest_requests_denied` ; case d'un invité SUSPENDUE (`FamilyGuestRights.suspended`)
   *  sans le droit. Sans elle, la case « peut demander » se règle comme avant. */
  "family.guestRequestsAdmin": "1.30.0",
  // ── Lot « droits 2 » : lecture et Watch Together (docs/DROITS-UTILISATEURS.md § 9.2) ──
  /** L'accès du compte à Watch Together, tiré de `SyncPlayAccess` de sa politique Jellyfin
   *  (`GET /api/watch-together/access` → `full | joinOnly | none`) : `none` ne voit plus rien de
   *  Watch Together, `joinOnly` plus rien qui crée un salon. Sans elle, comme avant. */
  "watchTogether.access": "1.30.0",
  /** Les droits de lecture du compte pour CE client (`GET /api/playback/rights` : lecture,
   *  conversions de l'image et du son, changement de conteneur, plafond de débit d'après
   *  l'adresse réelle), et leur garde dans le proxy (403 `playback_not_allowed`,
   *  `conversion_not_allowed`). Sans elle, les lecteurs font comme avant. */
  "playback.rights": "1.30.0",
  // ── Lot « droits 2 » — S1, accès du compte ──
  /** L'accès du compte (`IsDisabled`, `AccessSchedules` de Jellyfin) : `GET /api/account/access`,
   *  refus 403 `{ error: "account_access", … }` à toutes les portes, annonce `account:access` sur
   *  le socket. Les clients montrent la page « compte désactivé / hors plage ». */
  "account.access": "1.30.0",
  // ── Lot TV du 16/10 : la galerie des avatars sur la TV ──
  /** Un jeton d'APPAREIL (TV jumelée, session de profil d'une TV) pose la photo Jellyfin de SON
   *  compte par le proxy (`POST /Users/{soi}/Images/Primary`, `deviceWrites.ts`) : la galerie des
   *  avatars s'ouvre sur la TV. Sans elle, le proxy refuse (403) : aucune entrée, aucune invitation.
   *  `GET /api/avatars/device-photo` → `{ allowed }` : non pour le compte de démonstration (revue Apple). */
  "avatars.devicePhoto": "1.30.0",
  /** « Reproposer le code PIN et la photo » d'un profil de la famille (`POST
   *  /api/family/profiles/:userId/prompts/reset`, droits de `canResetPrompts`) : la date est rendue
   *  dans les profils (`promptsResetAt` : vue d'ensemble, TV, « Qui regarde ? » du bureau), et le
   *  rappel `familyPin` masqué du compte est réaffiché. Sans elle : aucun bouton, et les appareils
   *  gardent leur « Plus tard ». */
  "family.promptsReset": "1.30.0",
  // ── Lot 1017 : « Tendances actuelles » en tête de « Pour vous » ──
  /** La rangée `trendingNow` en TÊTE de la page reco (`?trendingNow=1`) : les tendances TMDB de
   *  la semaine, films et séries, dans l'ordre de TMDB — ni le goût ni les statistiques du compte —,
   *  et la préférence du COMPTE qui l'allume (`trendingNow` de `/api/preferences/reco`, allumée par
   *  défaut). Sans elle, aucun interrupteur : un serveur d'avant ignore le paramètre. */
  "reco.trending": "1.31.0",
  // ── Lot « mobile = bureau » (2026-10-20) : Watch Together partagé ──
  /** L'adhésion à une salle Watch Together est PAR APPAREIL (l'empreinte du jeton), plus par
   *  compte : seuls les appareils liés reçoivent la séance ; un autre appareil du même compte
   *  n'en reçoit que l'avis `wt:elsewhere` (`GET /api/watch-together/group/elsewhere`) et peut
   *  s'y AJOUTER (`POST /api/watch-together/group/join-here`). Le mobile n'a Watch Together
   *  qu'avec elle : sans elle, téléphone et bureau d'un même compte se marcheraient dessus. */
  "watchTogether.deviceMembership": "1.31.1",
  /** « Tous prêts » : l'état d'une salle porte `allReady`, et le serveur ignore `wt:skipPropose`
   *  avant — aucun saut de passage (intro, résumé, générique) tant que les membres attendus pour
   *  le titre ne sont pas tous posés. Sans elle, les clients en jugent d'après l'état seul. */
  "watchTogether.readyGate": "1.31.1",
  /** « X est en train d'écrire… » dans le chat d'une salle (`wt:typing`, début / fin, éteint
   *  par le serveur après 6 s sans nouvelle, jamais relayé à soi-même). Sans elle, rien n'est
   *  envoyé : un serveur d'avant répondrait `invalid` à chaque frappe. */
  "watchTogether.typing": "1.31.1",
  /** L'ARRIVÉE dans une séance qui joue (20/10 soir) : « Rejoindre » d'un membre déjà dans le
   *  groupe gèle la salle AU CLIC et l'attend (`POST /api/watch-together/group/arrive`), comme une
   *  invitation acceptée. Sans elle, le lecteur s'ouvre comme avant (la salle se gèle à son
   *  ouverture). Accepter, « Rejoindre ici » et les messages tirés des états n'en dépendent pas. */
  "watchTogether.arrival": "1.31.1",
  /** « Qui regarde ? » sur le MOBILE (téléphone, tablette) : la plateforme `mobile` des routes
   *  `/api/family/picker/*` (`FAMILY_PICKER_PLATFORMS`) — profils de la famille, session de
   *  profil de l'appareil, PIN vérifié par le serveur, comme le bureau. Sans elle, le mobile
   *  ne montre ni « Qui regarde ? » ni « Changer de profil ». */
  "family.mobileProfiles": "1.31.1",
  // ── Lot mobile du 20/10 : les droits s'appliquent partout, sans redémarrage ──
  /** Les droits d'un compte changés (fiche des droits, Famille, tableau de bord de Jellyfin)
   *  s'annoncent à ses appareils : `rights:changed` sur le socket, et le client relit ce qu'il
   *  montre (`useRightsLive`). Sans elle, la fraîcheur des requêtes, comme avant. */
  "rights.live": "1.31.1",
  /** Les titres gardés hors ligne jugés par le serveur pour l'identité EN SESSION (compte, ou
   *  profil de la famille) : `POST /api/library/visibility` → visibles, cachés, disparus. Un
   *  titre caché ne se lit plus, même gardé avant le retrait du droit. Sans elle, comme avant. */
  "offline.verdicts": "1.31.1",
  /** Ce que la SESSION peut faire, dit par le serveur (`GET /api/account/abilities` : lecture,
   *  hors ligne, Watch Together, partage, suppression, tickets, extensions, compte, jumelage, push,
   *  invitations) : un client ne montre aucun geste que la session n'a pas le droit de faire.
   *  Sans elle, chaque client fait comme avant. */
  "account.abilities": "1.31.1",
  // ── Lot mobile 20/10 : notifications du téléphone synchronisées ──
  /** Une push d'une notification porte son identifiant (`data.notificationId`), la catégorie
   *  `tentacle.notification` (iOS : balayer la bannière = la marquer lue) et la pastille de
   *  l'icône (le nombre de non lues). Le mobile réconcilie alors le centre du système et le
   *  serveur : lue ou balayée n'importe où = lue partout. Sans elle, rien ne se synchronise. */
  "notifications.pushSync": "1.31.1",
  /** « Qui regarde ? » dans le NAVIGATEUR : la plateforme `web` des routes `/api/family/picker/*`,
   *  le jeton du compte mis en réserve par le serveur pendant un profil (cookie httpOnly, rendu
   *  derrière son code PIN), la déconnexion qui coupe tout. Sans elle, le web ne montre ni
   *  « Qui regarde ? » ni « Changer de profil » (un serveur d'avant refuse la plateforme). */
  "family.webProfiles": "1.31.1",
  // ── Retours de l'alpha mobile (21/10) : l'ouverture réglée simplement ──
  /** « Qui regarde ? à l'ouverture » en UN interrupteur et des plateformes cochées (Ordinateurs,
   *  Navigateur, Téléphones et tablettes, TV) : `enabled` et `platforms` dans
   *  `GET/PUT /api/admin/family/picker`, `launchAsk` dans « Qui regarde ? » de chaque plateforme
   *  (`/api/family/picker/profiles`). Sans elle : l'ancien réglage (`family.pickerPolicy`), et le
   *  mobile demande comme avant. */
  "family.launchPlatforms": "1.31.1",
  // ── Retours de l'alpha mobile (21/10) : le centre de notifications ──
  /** La liste de la cloche se PAGINE : `GET /api/notifications?before=<id>` rend la page qui
   *  suit cette notification, et l'en-tête `X-Notifications-Next` dit le curseur de la suivante
   *  (absent : c'était la dernière). Le centre du mobile charge alors toutes les notifications
   *  du compte en défilant (et « Non lues » les trouve toutes). Sans elle : les vingt dernières. */
  "notifications.paging": "1.31.1",
  // ── Retours de l'alpha mobile (21/10) : garder hors ligne va au bout, application quittée ──
  /** La préparation d'un fichier Allégé tenue par le SERVEUR (`/api/downloads/prepared/:itemId`) :
   *  elle avance que le téléphone soit là ou non, se lit pendant qu'elle s'écrit, se reprend par
   *  plage d'octets après une coupure, et une push silencieuse (`data.type = "offline:prepared"`)
   *  réveille l'iPhone quand elle s'achève sans lui. Sans elle, le téléphone tire le transcodage
   *  en direct (`/light`), comme avant. */
  "offline.serverPrepare": "1.31.1",
  // ── Octave : la musique de la bibliothèque, et les extensions isolées (docs/octave/CONTRATS.md) ──
  /** La musique de la bibliothèque Jellyfin servie par le cœur (`/api/music/*` : index et
   *  recherche, favoris, playlists, flux direct, événements `music:*`). Sans elle : aucun mode
   *  Octave, aucune entrée musique. */
  "music.library": "1.40.0",
  /** Le runtime ISOLÉ des modules serveur d'extension (processus à part, API d'hôte fermée) et le
   *  contrat `music` du manifeste relayé par `/api/plugins/active`. Sans elle : aucun résultat,
   *  aucune lecture ni geste hors bibliothèque. */
  "plugins.isolatedRuntime": "1.40.0",
  /** Le point d'extension `music.suggest` relayé par `/api/plugins/active` : pendant la frappe, la
   *  barre d'Octave demande des SUGGESTIONS LOCALES à l'extension (ses index, aucune requête
   *  réseau de sa part), la recherche complète ne part qu'à la validation. Sans elle : suggestions
   *  de la bibliothèque et recherches récentes seulement. */
  "music.suggest": "1.40.0",
  /** `POST /api/music/match` : ce que la bibliothèque a parmi des titres et albums montrés hors
   *  bibliothèque (vue album, artiste, playlist, recherche, file), sur l'index local. Sans elle :
   *  seule la recherche remplace un titre par celui de la bibliothèque, d'après ses propres résultats. */
  "music.libraryMatch": "1.40.0",
  /** L'IMPORT d'une playlist d'un autre service dans Octave (`POST /api/music/import`, musicImport.ts) :
   *  Spotify, Apple Music, Deezer et une liste collée lus par le serveur, rapprochés de la bibliothèque,
   *  playlist Jellyfin créée au nom du compte ; les absents ne vont qu'à une extension qui déclare
   *  `importTracks`. Sans elle : aucune entrée « Importer une playlist ». */
  "music.playlistImport": "1.40.0",
  /** L'ORDRE des listes d'Octave (`musicListOrder.ts`) : tri par date d'ajout, écoutes, titre…, le tri
   *  choisi gardé par liste et par COMPTE (`/api/music/lists/:key/prefs`), l'ordre personnalisé (une
   *  poignée par titre) gardé pour les likés et appliqué à la playlist Jellyfin elle-même
   *  (`/api/music/playlists/:id/order`). Sans elle : la playlist dans son ordre, les likés comme
   *  avant, aucune barre de tri. */
  "music.listOrder": "1.40.0",
  /** GÉRER une playlist dans Octave au-delà du nom : sa DESCRIPTION (Jellyfin `Overview`), lue dans le détail
   *  (`GET /api/music/playlists/:id` → `description`) et écrite par `PATCH /api/music/playlists/:id`
   *  { description }. Renommer et supprimer viennent de `music.library`. Sans elle : aucun champ de description. */
  "music.playlistManage": "1.40.0",
  /** L'ORDRE DE LA SOURCE d'une playlist importée, gardé par le serveur (`musicSourceOrder.ts`) : chaque arrivée à
   *  sa place, « Date d'ajout » par le rang dans la source (`sourceIndex` des entrées), et la remise dans l'ordre
   *  de la source (`POST /api/music/playlists/:id/source-order`). Sans elle : aucune entrée « Remettre dans l'ordre ». */
  "music.playlistSourceOrder": "1.40.0",
  /** Le PARTAGE d'une playlist (`musicShare.ts`) : un lien par playlist, non devinable et révocable
   *  (`/api/music/playlists/:id/share`), gardé par le droit « Partage public » ; son document public
   *  (`/api/music/share/:token` : métadonnées des titres seulement) et sa page (`/octave/share/:token`) ;
   *  et l'import d'un lien d'un AUTRE serveur Tentacle (source `tentacle` de `POST /api/music/import`).
   *  Sans elle : ni « Partager », ni lien Tentacle reconnu à l'import. */
  "music.playlistShare": "1.40.0",
  /** Les LIENS partagés d'Octave (`shazamLink.ts`, `octaveOpenLink.ts`) : `GET /api/music/links/track?url=` lit le
   *  titre et l'artiste d'un lien Shazam (la recherche les pose), et la page d'ouverture `/octave/open/<page>`
   *  (« Ouvrir dans l'app Tentacle », sans script) qu'on envoie pour une playlist partagée. Sans elle : le lien
   *  Shazam se cherche par ce que le texte dit (message, slug), et l'on partage la route nue. */
  "music.sharedLinks": "1.40.0",
  /** Une playlist PARTAGÉE entre comptes du même serveur (`musicPlaylistMembers.ts`) : le propriétaire donne à un
   *  compte (jamais un invité de la Famille) le droit de lire, d'ajouter, ou d'ajouter et retirer — tenu par le
   *  serveur (`/api/music/playlists/:id/members`) ; chacun garde SON ordre ; un membre peut la quitter. Sans elle :
   *  ni « Partager avec… », ni badge, ni playlist d'un autre compte. Rien à voir avec `music.playlistShare`. */
  "music.playlistMembers": "1.40.0",
  /** Les FAVORIS de la bibliothèque d'Octave (`musicLibraryShelves.ts`) : un album, un artiste, une playlist en
   *  favori (le favori Jellyfin ; gardé par Tentacle pour une playlist reçue et tout élément hors bibliothèque),
   *  servis en tête de chaque rubrique (`/api/music/library/shelves`), et l'ORDRE PERSONNEL de chaque rubrique
   *  (`/api/music/library/order/:section` : glisser, « Mettre en haut »). Sans elle : ni cœur sur une carte, ni
   *  « Vos favoris », la bibliothèque dans l'ordre d'avant. */
  "music.libraryFavorites": "1.40.0",
  /** Un ajout à une playlist entre EN TÊTE (lot fl, 30/10 : en ordre personnalisé, le titre ajouté s'affiche en
   *  haut) : le serveur date aussitôt chaque ajout de l'utilisateur (« Derniers ajouts » juste, où qu'il entre) et
   *  chaque arrivée posée par l'extension (`jellyfin.playlistInsert` + `addedAt`). Sans elle : le client ajoute à
   *  la fin, comme avant (un ajout en tête y serait daté comme une arrivée posée à sa place). */
  "music.addOnTop": "1.41.0",
  /** Les requêtes DÉLÉGUÉES à l'appareil (`client.fetch`, `pluginClientFetch.ts`) : une extension fait
   *  exécuter ses requêtes déclarées par le bureau qui la sollicite, depuis SA connexion, et un flux
   *  peut s'y lire en direct (`PlaybackSource.direct`). Sans elle : tout passe par le serveur. */
  "plugins.clientFetch": "1.40.0",
  /** La NAVIGATION réglée par l'extension (`navigation` du manifeste, `pluginNavigation.ts`) : le
   *  nom de ses pages et leur place par défaut (barre principale, « Plus », ou MASQUÉE de toute la
   *  navigation, sa route gardée), fusionnés dans les `navItems` de `/api/plugins/active` (`primary`,
   *  `hidden`). Sans elle : pages épinglées d'office sous le nom du manifeste, et l'extension n'offre
   *  pas ce réglage. */
  "plugins.navigation": "1.40.0",
  /** « Accès à Octave » : un droit TENTACLE par compte (allumé par défaut), réglé dans la fiche des
   *  droits d'un utilisateur (`/api/admin/users/:userId/octave`), avec la rubrique « Musique · Octave »
   *  (les droits Jellyfin qui touchent la musique). Le serveur le tient (routes musique,
   *  extension de musique). Sans elle : la fiche d'avant, Octave comme avant. */
  "octave.rights": "1.40.0",
  /** Les ÉCOUTES dans le tableau de bord des sessions : le lecteur d'Octave déclare ce qu'il joue
   *  (`playback:declare`, canal de session) et applique pause, reprise, arrêt venus de
   *  l'administration ; une lecture d'extension (hors bibliothèque) y paraît et s'y commande ; les
   *  sessions de musique portent artistes, album et pochette. Sans elle : rien n'est déclaré, la
   *  musique de la bibliothèque paraît par Jellyfin seul, comme avant. */
  "sessions.musicControl": "1.40.0",
  /** Garder hors ligne la MUSIQUE (Octave, bureau) : `POST /api/music/offline/plan` dit, pour des
   *  titres de la bibliothèque, d'où les tirer et sous quelle forme (l'original, ou l'Allégé audio
   *  `a256` de `/api/downloads/light` quand l'administration le permet), et
   *  `users.rights` dit `keepOffline` à une extension (titre hors bibliothèque, route `offline` du
   *  contrat `music`). Sans elle : aucun bouton « Garder hors ligne » dans Octave. */
  "offline.music": "1.40.0",
} as const satisfies Record<string, string>;

export type ServerCapability = keyof typeof SERVER_CAPABILITIES;

export const SERVER_CAPABILITY_KEYS = Object.keys(SERVER_CAPABILITIES) as ServerCapability[];

export function isServerCapability(value: unknown): value is ServerCapability {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(SERVER_CAPABILITIES, value);
}

/** Ce que `GET /api/config` apporte à la décision (le reste est ignoré). */
export interface ServerCapabilitiesSource {
  version?: unknown;
  /** Les clés déclarées. ABSENT : serveur d'avant la déclaration (≤ 1.23.x). */
  capabilities?: unknown;
}

/** « 1.22.3 » → [1, 22, 3] ; un segment illisible vaut 0. */
function versionParts(version: string): number[] {
  return version.trim().replace(/^v/i, "").split(/[.+-]/).slice(0, 3).map((part) => Number.parseInt(part, 10) || 0);
}

function reaches(version: string, since: string): boolean {
  const x = versionParts(version);
  const y = versionParts(since);
  for (let i = 0; i < 3; i++) {
    const delta = (x[i] ?? 0) - (y[i] ?? 0);
    if (delta !== 0) return delta > 0;
  }
  return true;
}

/**
 * Ce qu'un serveur de CETTE version déclare (côté serveur, `declaredCapabilities.ts`) :
 * les clés dont `since` est atteint par sa version — une fonction livrée dans le code
 * mais promise à une version plus récente reste cachée tant que le serveur ne l'est
 * pas. « 1.40.0+preview.<sha> » (version fixée au build) vaut 1.40.0.
 */
export function serverCapabilitiesAt(version: string): ServerCapability[] {
  return SERVER_CAPABILITY_KEYS.filter((key) => reaches(version, SERVER_CAPABILITIES[key]));
}

/**
 * Les capacités d'un serveur, décidées UNE fois :
 * - il déclare `capabilities` → sa liste, réduite aux clés que CE client connaît ;
 * - il ne déclare rien (serveur d'avant) → les clés dont `since` est atteint
 *   par sa version (aujourd'hui : aucune) ;
 * - pas de réponse, réponse illisible → aucune. Rien n'est deviné : une
 *   fonction absente vaut le comportement d'avant, jamais une erreur.
 */
export function resolveServerCapabilities(source: ServerCapabilitiesSource | null | undefined): ReadonlySet<ServerCapability> {
  if (!source || typeof source !== "object") return new Set();
  if (Array.isArray(source.capabilities)) return new Set(source.capabilities.filter(isServerCapability));
  if (typeof source.version !== "string" || !source.version) return new Set();
  const version = source.version;
  return new Set(serverCapabilitiesAt(version));
}

/** Les clés que CE client connaît et que son serveur ne déclare pas. */
export function missingServerCapabilities(capabilities: ReadonlySet<ServerCapability>): ServerCapability[] {
  return SERVER_CAPABILITY_KEYS.filter((key) => !capabilities.has(key));
}

/**
 * La version de serveur la plus récente qu'exige une capacité manquante —
 * « mettez à jour vers au moins X » ; `null` si rien ne manque.
 */
export function newestMissingSince(capabilities: ReadonlySet<ServerCapability>): string | null {
  let newest: string | null = null;
  for (const key of missingServerCapabilities(capabilities)) {
    const since = SERVER_CAPABILITIES[key];
    if (newest === null || !reaches(newest, since)) newest = since;
  }
  return newest;
}
