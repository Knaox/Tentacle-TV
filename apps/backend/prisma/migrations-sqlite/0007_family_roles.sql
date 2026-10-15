-- Générée par `pnpm db:migration family_roles` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "family_member_parental" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "controls" TEXT,
    "base" TEXT NOT NULL,
    "written" TEXT,
    "restorePending" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_account_rights" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "createFamily" TEXT NOT NULL DEFAULT 'inherit',
    "createGuests" TEXT NOT NULL DEFAULT 'inherit',
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_family_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "color" TEXT,
    "jellyfinName" TEXT,
    "createdBy" TEXT,
    "canCreateGuests" BOOLEAN NOT NULL DEFAULT false,
    "canRequestTitles" BOOLEAN NOT NULL DEFAULT false,
    "parentalControls" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isParent" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_family_members" ("canCreateGuests", "canRequestTitles", "color", "createdAt", "createdBy", "displayName", "familyId", "id", "jellyfinName", "kind", "parentalControls", "userId") SELECT "canCreateGuests", "canRequestTitles", "color", "createdAt", "createdBy", "displayName", "familyId", "id", "jellyfinName", "kind", "parentalControls", "userId" FROM "family_members";
DROP TABLE "family_members";
ALTER TABLE "new_family_members" RENAME TO "family_members";
CREATE UNIQUE INDEX "family_members_familyId_userId_key" ON "family_members"("familyId", "userId");
CREATE UNIQUE INDEX "family_members_userId_key" ON "family_members"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "family_member_parental_familyId_idx" ON "family_member_parental"("familyId");
