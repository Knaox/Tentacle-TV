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
