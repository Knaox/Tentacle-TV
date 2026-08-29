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
-- (CREATE TABLE IF NOT EXISTS) : aucune table n'est jamais supprimee.
-- => Ajouter ici toute nouvelle table / migration additive cote core.

CREATE TABLE IF NOT EXISTS `share_links` (
  `id` varchar(191) NOT NULL,
  `token` varchar(32) NOT NULL,
  `ownerUserId` varchar(255) NOT NULL,
  `ownerUsername` varchar(255) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `share_links_token_key` (`token`),
  UNIQUE KEY `share_links_ownerUserId_key` (`ownerUserId`),
  KEY `share_links_token_idx` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`jellyfinUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
