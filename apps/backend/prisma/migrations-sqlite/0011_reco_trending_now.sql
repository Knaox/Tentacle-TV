-- Générée par `pnpm db:migration reco_trending_now` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_reco_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "personalized" BOOLEAN NOT NULL DEFAULT true,
    "includeVigie" BOOLEAN NOT NULL DEFAULT true,
    "community" BOOLEAN NOT NULL DEFAULT true,
    "shareHistory" BOOLEAN NOT NULL DEFAULT true,
    "explorationBalance" INTEGER NOT NULL DEFAULT 70,
    "providerFilter" TEXT NOT NULL DEFAULT '[]',
    "trendingNow" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_reco_settings" ("community", "createdAt", "explorationBalance", "id", "includeVigie", "jellyfinUserId", "personalized", "providerFilter", "shareHistory", "updatedAt") SELECT "community", "createdAt", "explorationBalance", "id", "includeVigie", "jellyfinUserId", "personalized", "providerFilter", "shareHistory", "updatedAt" FROM "reco_settings";
DROP TABLE "reco_settings";
ALTER TABLE "new_reco_settings" RENAME TO "reco_settings";
CREATE UNIQUE INDEX "reco_settings_jellyfinUserId_key" ON "reco_settings"("jellyfinUserId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
