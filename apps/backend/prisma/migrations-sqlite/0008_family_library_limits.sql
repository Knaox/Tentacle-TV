-- Générée par `pnpm db:migration family_library_limits` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- AlterTable
ALTER TABLE "family_member_parental" ADD COLUMN "libraries" TEXT;
ALTER TABLE "family_member_parental" ADD COLUMN "libraryBase" TEXT;
ALTER TABLE "family_member_parental" ADD COLUMN "libraryWritten" TEXT;

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN "libraryAccess" TEXT;
