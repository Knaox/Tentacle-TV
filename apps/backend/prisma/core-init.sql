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
