-- Générée par `pnpm db:migration music_playlist_sources` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_playlist_sources" (
    "playlistId" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "origin" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL,
    "slotsJson" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
