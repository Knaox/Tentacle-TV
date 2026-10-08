-- Générée par `pnpm db:migration plugin_migrations` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "plugin_migrations" (
    "pluginId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL,

    PRIMARY KEY ("pluginId", "version")
);
