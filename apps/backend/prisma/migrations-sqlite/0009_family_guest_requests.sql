-- Générée par `pnpm db:migration family_guest_requests` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- AlterTable
ALTER TABLE "family_members" ADD COLUMN "requestTitlesGrantedBy" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_family_account_rights" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "createFamily" TEXT NOT NULL DEFAULT 'inherit',
    "createGuests" TEXT NOT NULL DEFAULT 'inherit',
    "grantGuestRequests" TEXT NOT NULL DEFAULT 'inherit',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_family_account_rights" ("createFamily", "createGuests", "updatedAt", "userId") SELECT "createFamily", "createGuests", "updatedAt", "userId" FROM "family_account_rights";
DROP TABLE "family_account_rights";
ALTER TABLE "new_family_account_rights" RENAME TO "family_account_rights";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
