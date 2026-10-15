-- Générée par `pnpm db:migration notification_target` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "state" TEXT;
ALTER TABLE "notifications" ADD COLUMN "target" TEXT;
