-- Générée par `pnpm db:migration music_shelf_favorites` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_shelf_favorites" (
    "userId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "snapshotJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "section", "itemKey")
);
