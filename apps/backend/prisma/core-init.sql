-- Initialisation idempotente des tables CORE.
--
-- Pourquoi ce fichier au lieu de `prisma db push` ?
-- `prisma db push` synchronise TOUTE la base sur schema.prisma et SUPPRIME les
-- tables qui n'y sont pas declarees. Or les tables du plugin Seer
-- (seer_requests, seer_cleanup_queue, seer_user_settings) sont creees et gerees
-- par le plugin lui-meme (raw SQL, colonnes snake_case) et ne sont volontairement
-- PAS dans schema.prisma. Un db push les droperait (ou echouerait sur les donnees).
--
-- On applique donc ici les tables core de facon purement additive
-- (CREATE TABLE IF NOT EXISTS) : aucune table de PLUGIN n'est jamais touchee.
-- Une table ou une colonne du COEUR retiree par une evolution se supprime ici
-- explicitement, avec IF EXISTS (idempotent) — voir les blocs « 1.17 ».
-- => Ajouter ici toute nouvelle table / migration additive cote core.

CREATE TABLE IF NOT EXISTS `share_links` (
  `id` varchar(191) NOT NULL,
  `token` varchar(32) NOT NULL,
  `ownerUserId` varchar(255) NOT NULL,
  `ownerUsername` varchar(255) NOT NULL,
  `kind` varchar(20) NOT NULL DEFAULT 'watchlist',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `share_links_token_key` (`token`),
  UNIQUE KEY `share_links_ownerUserId_kind_key` (`ownerUserId`, `kind`),
  KEY `share_links_token_idx` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le partage s'est généralisé (watchlist + favoris) : les bases d'avant
-- reçoivent `kind` et l'unicité passe de (ownerUserId) à (ownerUserId, kind).
-- Les liens existants deviennent kind='watchlist' et restent valides.
ALTER TABLE `share_links` ADD COLUMN IF NOT EXISTS `kind` varchar(20) NOT NULL DEFAULT 'watchlist';
ALTER TABLE `share_links` DROP INDEX IF EXISTS `share_links_ownerUserId_key`;
CREATE UNIQUE INDEX IF NOT EXISTS `share_links_ownerUserId_kind_key` ON `share_links` (`ownerUserId`, `kind`);

-- Code de jumelage de provisionnement (singleton). Voir schema.prisma > ProvisioningCode.
CREATE TABLE IF NOT EXISTS `provisioning_codes` (
  `id` varchar(191) NOT NULL,
  `code` varchar(32) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  `expiresAt` datetime(3) NULL,
  `jellyfinUserId` varchar(255) NULL,
  `username` varchar(255) NULL,
  `jellyfinAccessToken` text NULL,
  `token` text NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `provisioning_codes_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jeton de push Expo par appareil mobile. Voir schema.prisma > PushDevice.
CREATE TABLE IF NOT EXISTS `push_devices` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `expoPushToken` varchar(255) NOT NULL,
  `platform` varchar(10) NOT NULL,
  `lastSeen` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `push_devices_expoPushToken_key` (`expoPushToken`),
  KEY `push_devices_jellyfinUserId_idx` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preferences de notification push par utilisateur. Voir schema.prisma > NotificationPreference.
CREATE TABLE IF NOT EXISTS `notification_preferences` (
  `jellyfinUserId` varchar(255) NOT NULL,
  `libraryAdded` tinyint(1) NOT NULL DEFAULT 0,
  `seerAvailable` tinyint(1) NOT NULL DEFAULT 0,
  `tickets` tinyint(1) NOT NULL DEFAULT 1,
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.17 : préférence push « tickets », ACTIVÉE par défaut (les deux autres sont
-- opt-in). Une base existante ne repasse pas par le CREATE ci-dessus — ajout
-- idempotent (MariaDB).
ALTER TABLE `notification_preferences` ADD COLUMN IF NOT EXISTS `tickets` tinyint(1) NOT NULL DEFAULT 1;

-- Colonne de livraison push sur les notifications existantes (additif, idempotent MariaDB).
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `pushedAt` datetime(3) NULL;
CREATE INDEX IF NOT EXISTS `notifications_type_pushedAt_idx` ON `notifications` (`type`, `pushedAt`);

-- Revendication générique de contenu par un plugin (anti-doublon notifs). Voir schema.prisma > ContentClaim.
CREATE TABLE IF NOT EXISTS `content_claims` (
  `tmdbId` int NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `mediaType` varchar(10) NOT NULL,
  `title` varchar(500) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  PRIMARY KEY (`tmdbId`, `jellyfinUserId`),
  KEY `content_claims_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Instantané persistant des IDs biblio (détection d'ajouts par diff). Voir schema.prisma > LibraryKnownId.
CREATE TABLE IF NOT EXISTS `library_known_id` (
  `itemId` varchar(64) NOT NULL,
  PRIMARY KEY (`itemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registre persistant des annonces push par (clé de contenu, utilisateur) — anti-re-notification. Voir schema.prisma > AnnouncedContent.
CREATE TABLE IF NOT EXISTS `announced_contents` (
  `contentKey` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `notifiedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`contentKey`, `jellyfinUserId`),
  KEY `announced_contents_notifiedAt_idx` (`notifiedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Séries retirées automatiquement de « Ma liste » (tout le disponible vu), à
-- remettre au prochain épisode. Voir schema.prisma > WatchlistAutoRetired.
CREATE TABLE IF NOT EXISTS `watchlist_auto_retired` (
  `seriesId` varchar(64) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `retiredAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`seriesId`, `jellyfinUserId`),
  KEY `watchlist_auto_retired_jellyfinUserId_idx` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Segments de visionnage MESURÉS par Tentacle (remplace le greffon Playback
-- Reporting). Une ligne = une suite continue de lecture d'un titre sur une
-- session. Le temps est échantillonné toutes les 15 s, jamais extrapolé.
-- Voir schema.prisma > WatchSegment.
CREATE TABLE IF NOT EXISTS `watch_segments` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `sessionKey` varchar(191) NOT NULL,
  `itemId` varchar(64) NOT NULL,
  `itemType` varchar(20) NOT NULL,
  `itemName` varchar(500) NOT NULL,
  `seriesId` varchar(64) NULL,
  `seriesName` varchar(500) NULL,
  `clientName` varchar(100) NULL,
  `deviceName` varchar(191) NULL,
  `seconds` int NOT NULL DEFAULT 0,
  `runtimeSeconds` int NULL,
  `startedAt` datetime(3) NOT NULL,
  `lastSeenAt` datetime(3) NOT NULL,
  `closedAt` datetime(3) NULL,
  PRIMARY KEY (`id`),
  KEY `watch_segments_jellyfinUserId_startedAt_idx` (`jellyfinUserId`, `startedAt`),
  KEY `watch_segments_jellyfinUserId_seriesId_idx` (`jellyfinUserId`, `seriesId`),
  KEY `watch_segments_startedAt_idx` (`startedAt`),
  KEY `watch_segments_sessionKey_itemId_closedAt_idx` (`sessionKey`, `itemId`, `closedAt`),
  KEY `watch_segments_closedAt_idx` (`closedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bail d'exclusivité du collecteur : une seule instance mesure à la fois, sinon
-- deux backends sur la même base compteraient chacun le même visionnage.
-- Voir schema.prisma > WatchTimeLease.
CREATE TABLE IF NOT EXISTS `watch_time_lease` (
  `id` varchar(32) NOT NULL,
  `owner` varchar(64) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Préférences de pistes PAR CONTENU. Voir schema.prisma > ItemTrackPreference.
--
-- Elle manquait ici alors que le modèle existait depuis longtemps dans
-- schema.prisma. En production le schéma n'arrive QUE par ce fichier : la table
-- n'y a donc jamais été créée, `GET /api/preferences/items` répondait 500
-- (Prisma P2021, « table does not exist ») à chaque démarrage de client, et le
-- miroir hors ligne des préférences restait vide. Rien ne signalait l'oubli —
-- en développement on passe par `prisma db push`, qui crée tout.
--
-- DDL relevé par `SHOW CREATE TABLE` sur une base où Prisma l'avait créée,
-- plutôt qu'écrit à la main : types, valeurs par défaut et noms d'index sont
-- donc exactement ceux que Prisma attend.
CREATE TABLE IF NOT EXISTS `item_track_preferences` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `itemId` varchar(255) NOT NULL,
  `audioLang` varchar(10) DEFAULT NULL,
  `subtitleLang` varchar(10) DEFAULT NULL,
  `subtitleMode` varchar(20) NOT NULL DEFAULT 'none',
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `item_track_preferences_jellyfinUserId_itemId_key` (`jellyfinUserId`,`itemId`),
  KEY `item_track_preferences_jellyfinUserId_idx` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Réglages de lecture par compte. Voir schema.prisma > PlaybackSettings.
--
-- DDL écrit sur le modèle EXACT des blocs relevés par `SHOW CREATE TABLE`
-- ci-dessus (varchar(191) pour un id cuid, tinyint(1) pour un Boolean,
-- datetime(3) et default current_timestamp(3) pour @default(now())) : en
-- production le schéma n'arrive QUE par ce fichier — un modèle Prisma sans
-- son bloc ici est une table qui n'existera jamais (incident
-- item_track_preferences, ci-dessus).
CREATE TABLE IF NOT EXISTS `playback_settings` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `introAction` varchar(10) NOT NULL DEFAULT 'auto',
  `introCountdown` tinyint(1) NOT NULL DEFAULT 1,
  `introDelayMs` int(11) NOT NULL DEFAULT 3000,
  `outroAction` varchar(10) NOT NULL DEFAULT 'button',
  `outroCountdown` tinyint(1) NOT NULL DEFAULT 1,
  `outroDelayMs` int(11) NOT NULL DEFAULT 3000,
  `recapAction` varchar(10) NOT NULL DEFAULT 'off',
  `recapCountdown` tinyint(1) NOT NULL DEFAULT 1,
  `recapDelayMs` int(11) NOT NULL DEFAULT 3000,
  `previewAction` varchar(10) NOT NULL DEFAULT 'off',
  `previewCountdown` tinyint(1) NOT NULL DEFAULT 1,
  `previewDelayMs` int(11) NOT NULL DEFAULT 3000,
  `nextCard` tinyint(1) NOT NULL DEFAULT 1,
  `nextCountdown` tinyint(1) NOT NULL DEFAULT 1,
  `nextAutoPlay` tinyint(1) NOT NULL DEFAULT 1,
  `nextTrigger` varchar(16) NOT NULL DEFAULT 'outroStart',
  `nextBeforeEndSeconds` int(11) NOT NULL DEFAULT 45,
  `beforeEndEnabled` tinyint(1) NOT NULL DEFAULT 1,
  `beforeEndMode` varchar(8) NOT NULL DEFAULT 'percent',
  `beforeEndValue` int(11) NOT NULL DEFAULT 98,
  `beforeEndRules` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `playback_settings_jellyfinUserId_key` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Le repli « avant la fin » par bibliothèque, ajouté après coup : une table
-- déjà créée ne repasse pas par le CREATE ci-dessus (additif, idempotent).
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `beforeEndEnabled` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `beforeEndMode` varchar(8) NOT NULL DEFAULT 'percent';
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `beforeEndValue` int(11) NOT NULL DEFAULT 98;
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `beforeEndRules` text DEFAULT NULL;

-- La durée du compte à rebours « épisode suivant », réglable depuis la 1.20.9
-- (elle était figée à dix secondes dans le moteur). Additif, idempotent.
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `nextCountdownMs` int(11) NOT NULL DEFAULT 10000;

-- Le générique de fin d'un FILM, réglé à part de celui des épisodes (1.20.9).
-- Additif, idempotent — comme les colonnes ci-dessus.
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `outroFilmAction` varchar(10) NOT NULL DEFAULT 'auto';
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `outroFilmCountdown` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `outroFilmDelayMs` int(11) NOT NULL DEFAULT 5000;

-- L'affiche plein écran de fin d'épisode, réglable depuis la 1.20.11 —
-- indépendante de la fiche « à suivre ». Additif, idempotent.
ALTER TABLE `playback_settings` ADD COLUMN IF NOT EXISTS `nextFinalCard` tinyint(1) NOT NULL DEFAULT 1;

-- Le verdict des vignettes sur le générique de fin (services/frameAnalysis.ts).
-- Un cache, jamais une source : la table peut être vidée sans rien perdre
-- d'autre qu'une demi-seconde de calcul au prochain lancement du média.
CREATE TABLE IF NOT EXISTS `media_frame_analysis` (
  `itemId` varchar(64) NOT NULL,
  `version` int(11) NOT NULL,
  `runtimeMs` int(11) NOT NULL,
  `verdict` text DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`itemId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Moteur de recommandation. DDL sur le modèle exact des blocs relevés par
-- `SHOW CREATE TABLE` (varchar(191) pour un id cuid, tinyint(1) pour un
-- Boolean, double pour un Float, datetime(3), updatedAt sans défaut).
-- Voir schema.prisma, section « Moteur de recommandation ».
-- ─────────────────────────────────────────────────────────────────────────────

-- Notes explicites (1..10). Voir schema.prisma > UserRating.
CREATE TABLE IF NOT EXISTS `user_ratings` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `mediaType` varchar(10) NOT NULL,
  `tmdbId` int(11) NOT NULL,
  `jellyfinItemId` varchar(64) NULL,
  `seasonNumber` int(11) NOT NULL DEFAULT 0,
  `episodeNumber` int(11) NOT NULL DEFAULT 0,
  `score` int(11) NOT NULL,
  `syncStatus` varchar(16) NOT NULL DEFAULT 'pending',
  `syncAttempts` int(11) NOT NULL DEFAULT 0,
  `nextSyncAt` datetime(3) NULL,
  `tmdbSyncedAt` datetime(3) NULL,
  `deletedAt` datetime(3) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_ratings_identity_key` (`jellyfinUserId`, `mediaType`, `tmdbId`, `seasonNumber`, `episodeNumber`),
  KEY `user_ratings_jellyfinUserId_idx` (`jellyfinUserId`),
  KEY `user_ratings_syncStatus_nextSyncAt_idx` (`syncStatus`, `nextSyncAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.17 : AniList retiré. Les colonnes qu'il était seul à écrire (`anilistId`,
-- `anilistSyncedAt`) et la chaîne morte `tvdbId` / `isAnime` — qui n'existait
-- que pour ancrer le mapping AniList — sortent des bases existantes.
-- `DROP COLUMN IF EXISTS` (MariaDB) : rejouer est sans effet.
ALTER TABLE `user_ratings` DROP COLUMN IF EXISTS `anilistId`;
ALTER TABLE `user_ratings` DROP COLUMN IF EXISTS `anilistSyncedAt`;
ALTER TABLE `user_ratings` DROP COLUMN IF EXISTS `tvdbId`;
ALTER TABLE `user_ratings` DROP COLUMN IF EXISTS `isAnime`;

-- « J'aime » d'un titre HORS bibliothèque (Vigie). Voir schema.prisma > UserLike.
CREATE TABLE IF NOT EXISTS `user_likes` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `mediaType` varchar(10) NOT NULL,
  `tmdbId` int(11) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_likes_jellyfinUserId_mediaType_tmdbId_key` (`jellyfinUserId`, `mediaType`, `tmdbId`),
  KEY `user_likes_jellyfinUserId_idx` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Profil de goût (vecteur de facettes JSON). Voir schema.prisma > TasteProfile.
CREATE TABLE IF NOT EXISTS `taste_profiles` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `facets` mediumtext NOT NULL,
  `signalCount` int(11) NOT NULL DEFAULT 0,
  `ratingMean` double NOT NULL DEFAULT 0,
  `ratingStdDev` double NOT NULL DEFAULT 0,
  `animeShare` double NOT NULL DEFAULT 0,
  `schemaVersion` int(11) NOT NULL DEFAULT 1,
  `computedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `taste_profiles_jellyfinUserId_key` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Part d'animé, ajoutée après la première livraison du moteur : une base
-- existante la reçoit ici (idempotent), une base neuve la tient du CREATE.
ALTER TABLE `taste_profiles` ADD COLUMN IF NOT EXISTS `animeShare` double NOT NULL DEFAULT 0;

-- Réglages de recommandation par compte. Voir schema.prisma > RecoSettings.
CREATE TABLE IF NOT EXISTS `reco_settings` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `personalized` tinyint(1) NOT NULL DEFAULT 1,
  `includeVigie` tinyint(1) NOT NULL DEFAULT 1,
  `community` tinyint(1) NOT NULL DEFAULT 1,
  `shareHistory` tinyint(1) NOT NULL DEFAULT 1,
  `explorationBalance` int(11) NOT NULL DEFAULT 70,
  `providerFilter` varchar(255) NOT NULL DEFAULT '[]',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reco_settings_jellyfinUserId_key` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Filtre de plateformes (1.17.0) : les installations existantes ne passent pas
-- par le CREATE TABLE ci-dessus — ajout idempotent.
ALTER TABLE `reco_settings` ADD COLUMN IF NOT EXISTS `providerFilter` varchar(255) NOT NULL DEFAULT '[]';

-- Cache des rangées de recommandation. Voir schema.prisma > RecommendationCache.
CREATE TABLE IF NOT EXISTS `recommendation_cache` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `rowKey` varchar(64) NOT NULL,
  `payload` mediumtext NOT NULL,
  `generatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expiresAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recommendation_cache_jellyfinUserId_rowKey_key` (`jellyfinUserId`, `rowKey`),
  KEY `recommendation_cache_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- « Ne plus me proposer ». Voir schema.prisma > RecommendationFeedback.
CREATE TABLE IF NOT EXISTS `recommendation_feedback` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `itemKey` varchar(32) NOT NULL,
  `action` varchar(20) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `recommendation_feedback_jellyfinUserId_itemKey_key` (`jellyfinUserId`, `itemKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mise en page de l'accueil par compte. Voir schema.prisma > HomeLayout.
CREATE TABLE IF NOT EXISTS `home_layouts` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `heroMode` varchar(20) NOT NULL DEFAULT 'reco',
  `heroFixedItemId` varchar(64) NULL,
  `rows` text NOT NULL,
  `cardDensity` varchar(10) NOT NULL DEFAULT 'normal',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `home_layouts_jellyfinUserId_key` (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- L'accueil par défaut assume la personnalisation (1.16) : seul le DÉFAUT de
-- colonne s'aligne — les lignes existantes portent des valeurs explicites et
-- ne bougent pas. Rejouer ce SET DEFAULT est sans effet (idempotent).
ALTER TABLE `home_layouts` ALTER `heroMode` SET DEFAULT 'reco';

-- Comptes externes liés (guest session TMDB). Voir schema.prisma > ExternalAccount.
CREATE TABLE IF NOT EXISTS `external_accounts` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `provider` varchar(20) NOT NULL,
  `guestSessionId` varchar(64) NULL,
  `expiresAt` datetime(3) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `external_accounts_jellyfinUserId_provider_key` (`jellyfinUserId`, `provider`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.17 : AniList retiré. Les comptes liés AniList et leurs jetons chiffrés
-- partent ; `accessToken` et `externalId` n'étaient écrits que par cette OAuth.
-- Le DELETE précède les DROP : une ligne sans ses colonnes ne dirait plus rien.
DELETE FROM `external_accounts` WHERE `provider` = 'anilist';
ALTER TABLE `external_accounts` DROP COLUMN IF EXISTS `accessToken`;
ALTER TABLE `external_accounts` DROP COLUMN IF EXISTS `externalId`;

-- Cooccurrences item-item (communautaire, seuil vie privée userCount >= 5).
-- Voir schema.prisma > ItemCooccurrence.
CREATE TABLE IF NOT EXISTS `item_cooccurrences` (
  `itemAKey` varchar(32) NOT NULL,
  `itemBKey` varchar(32) NOT NULL,
  `score` double NOT NULL,
  `userCount` int(11) NOT NULL,
  `computedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`itemAKey`, `itemBKey`),
  KEY `item_cooccurrences_itemAKey_idx` (`itemAKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Poids IDF par facette, recalculés chaque jour. Voir schema.prisma > FacetIdf.
CREATE TABLE IF NOT EXISTS `facet_idf` (
  `facetKey` varchar(191) NOT NULL,
  `docCount` int(11) NOT NULL,
  `idf` double NOT NULL,
  `computedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`facetKey`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cache de métadonnées TMDB. Un cache, jamais une source.
-- Voir schema.prisma > TmdbMetaCache.
CREATE TABLE IF NOT EXISTS `tmdb_meta_cache` (
  `mediaType` varchar(10) NOT NULL,
  `tmdbId` int(11) NOT NULL,
  `payload` mediumtext NOT NULL,
  `fetchedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expiresAt` datetime(3) NOT NULL,
  PRIMARY KEY (`mediaType`, `tmdbId`),
  KEY `tmdb_meta_cache_expiresAt_idx` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.17 : la correspondance d'identifiants animé (AniList) n'existe plus. Table
-- du COEUR, créée par nous puis abandonnée : la doctrine « jamais de DROP » du
-- haut du fichier protège les tables des plugins, pas celle-ci. Idempotent.
DROP TABLE IF EXISTS `anime_id_map`;

-- Personnes aimées explicitement (rangées « Avec {acteur} »).
-- Voir schema.prisma > UserLikedPerson.
CREATE TABLE IF NOT EXISTS `user_liked_people` (
  `id` varchar(191) NOT NULL,
  `jellyfinUserId` varchar(255) NOT NULL,
  `personId` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `profilePath` varchar(255) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_liked_people_jellyfinUserId_personId_key` (`jellyfinUserId`, `personId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────────────────────────────────────
-- Purge de `server_config` : clés abandonnées par une évolution.
-- La table n'est pas créée ici — c'est le `prisma db push` du setup qui la
-- fait naître. Sur une base VIERGE, ce script s'exécute avant le setup et
-- s'arrête donc ici (comme il s'arrête déjà sur l'ALTER de `notifications`
-- plus haut) : rien n'est perdu, il n'y a rien à purger, et le prochain
-- démarrage le rejoue en entier. D'où sa place en toute fin de fichier. Un
-- DELETE sans ligne correspondante est sans effet : idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.17 : l'interrupteur serveur « Déclenchement auto-play » n'existe plus —
-- les réglages de lecture PAR COMPTE (`playback_settings`) sont la seule source.
DELETE FROM `server_config` WHERE `key` = 'autoplay_next_enabled';

-- 1.17 : AniList retiré — identifiants du client OAuth déclaré par instance.
DELETE FROM `server_config` WHERE `key` IN ('anilist_client_id', 'anilist_client_secret');

-- 1.17 : la page Thème de l'admin (presets saisonniers, surcharge de jetons,
-- CSS personnalisé) est retirée ; `/api/theme` sert un état constant. Les six
-- clés sont celles de l'ancien themeStore, énumérées plutôt que LIKE : `_` y
-- est un joker.
DELETE FROM `server_config` WHERE `key` IN (
  'theme_active_name', 'theme_active_tokens_override', 'theme_active_css_source',
  'theme_active_css_content', 'theme_active_css_url', 'theme_active_css_hash'
);
