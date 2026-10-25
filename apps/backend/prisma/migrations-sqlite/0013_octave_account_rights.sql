-- Générée par `pnpm db:migration octave_account_rights` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "octave_account_rights" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "access" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);
