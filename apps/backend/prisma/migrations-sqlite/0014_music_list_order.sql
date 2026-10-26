-- Générée par `pnpm db:migration music_list_order` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_list_added" (
    "scope" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "addedAt" DATETIME NOT NULL,

    PRIMARY KEY ("scope", "itemId")
);

-- CreateTable
CREATE TABLE "music_list_prefs" (
    "userId" TEXT NOT NULL,
    "listKey" TEXT NOT NULL,
    "sort" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "customJson" TEXT,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "listKey")
);
