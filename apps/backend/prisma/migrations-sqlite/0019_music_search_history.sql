-- Générée par `pnpm db:migration music_search_history` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_search_history" (
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "at" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "kind", "itemKey")
);

-- CreateIndex
CREATE INDEX "music_search_history_userId_kind_at_idx" ON "music_search_history"("userId", "kind", "at");
