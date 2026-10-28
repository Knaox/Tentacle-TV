-- Générée par `pnpm db:migration music_playlist_shares` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_playlist_shares" (
    "token" TEXT NOT NULL PRIMARY KEY,
    "playlistId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "music_playlist_shares_playlistId_idx" ON "music_playlist_shares"("playlistId");

-- CreateIndex
CREATE UNIQUE INDEX "music_playlist_shares_ownerUserId_playlistId_key" ON "music_playlist_shares"("ownerUserId", "playlistId");
