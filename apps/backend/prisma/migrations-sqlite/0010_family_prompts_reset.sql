-- Générée par `pnpm db:migration family_prompts_reset` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- AlterTable
ALTER TABLE "family_members" ADD COLUMN "promptsResetAt" DATETIME;
