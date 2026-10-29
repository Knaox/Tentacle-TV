-- Générée par `pnpm db:migration music_playlist_members` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_playlist_members" (
    "playlistId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "right" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("playlistId", "memberId")
);

-- CreateIndex
CREATE INDEX "music_playlist_members_memberId_idx" ON "music_playlist_members"("memberId");
