-- Le schéma de la Famille v1 (core-init.sql de b0bd431af) et une table de
-- cloche réduite : la base d'avant la v2, pour le banc de migration.
CREATE TABLE IF NOT EXISTS `families` (
  `id` varchar(191) NOT NULL,
  `ownerUserId` varchar(255) NOT NULL,
  `ownerName` varchar(255) NOT NULL,
  `ownerColor` varchar(16) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `families_ownerUserId_key` (`ownerUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_members` (
  `id` varchar(191) NOT NULL,
  `familyId` varchar(191) NOT NULL,
  `userId` varchar(255) NOT NULL,
  `kind` varchar(10) NOT NULL,
  `displayName` varchar(100) NOT NULL,
  `color` varchar(16) NULL,
  `jellyfinName` varchar(255) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `family_members_familyId_userId_key` (`familyId`, `userId`),
  KEY `family_members_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `family_invitations` (
  `id` varchar(64) NOT NULL,
  `familyId` varchar(191) NOT NULL,
  `ownerUserId` varchar(255) NOT NULL,
  `inviteeUserId` varchar(255) NOT NULL,
  `inviteeName` varchar(255) NOT NULL,
  `status` varchar(12) NOT NULL DEFAULT 'pending',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `expiresAt` datetime(3) NOT NULL,
  `respondedAt` datetime(3) NULL,
  `snoozedUntil` datetime(3) NULL,
  PRIMARY KEY (`id`),
  KEY `family_invitations_inviteeUserId_status_idx` (`inviteeUserId`, `status`),
  KEY `family_invitations_ownerUserId_createdAt_idx` (`ownerUserId`, `createdAt`),
  KEY `family_invitations_familyId_status_idx` (`familyId`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `jellyfinUserId` varchar(255) NOT NULL,
  `type` varchar(30) NOT NULL,
  `title` varchar(255) NOT NULL,
  `refId` varchar(255) NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
