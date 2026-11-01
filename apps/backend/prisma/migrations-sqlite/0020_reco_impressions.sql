-- Générée par `pnpm db:migration reco_impressions` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "reco_impressions" (
    "jellyfinUserId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "firstDay" INTEGER NOT NULL,
    "lastDay" INTEGER NOT NULL,
    "daysShown" INTEGER NOT NULL DEFAULT 1,

    PRIMARY KEY ("jellyfinUserId", "itemKey")
);

-- CreateIndex
CREATE INDEX "reco_impressions_lastDay_idx" ON "reco_impressions"("lastDay");
