-- Générée par `pnpm db:migration music_index` (prisma migrate diff), puis complétée à la main AVANT
-- publication par la table virtuelle FTS5 (Prisma ne décrit pas les tables virtuelles).
-- Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "music_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortName" TEXT NOT NULL,
    "albumId" TEXT,
    "albumName" TEXT,
    "albumArtist" TEXT,
    "artistsJson" TEXT NOT NULL DEFAULT '[]',
    "year" INTEGER,
    "trackNumber" INTEGER,
    "discNumber" INTEGER,
    "durationMs" INTEGER,
    "recordingMbid" TEXT,
    "releaseMbid" TEXT,
    "releaseGroupMbid" TEXT,
    "artistMbid" TEXT,
    "formatJson" TEXT,
    "sizeBytes" BIGINT,
    "normalizationGain" REAL,
    "replayGainJson" TEXT,
    "imageTag" TEXT,
    "childCount" INTEGER,
    "dateCreated" DATETIME,
    "syncedAt" DATETIME NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "music_items_kind_sortName_idx" ON "music_items"("kind", "sortName");

-- CreateIndex
CREATE INDEX "music_items_albumId_idx" ON "music_items"("albumId");

-- CreateIndex
CREATE INDEX "music_items_recordingMbid_idx" ON "music_items"("recordingMbid");

-- CreateIndex
CREATE INDEX "music_items_kind_dateCreated_idx" ON "music_items"("kind", "dateCreated");

-- Octave — la recherche locale : une table FTS5 autonome, tenue par le code
-- (src/music/index/indexStore.ts) dans la MÊME transaction que music_items.
-- `unicode61 remove_diacritics 2` : « ete » trouve « Été », « oeuvre » ne
-- trouve pas « Œuvre » (ligature, cf. normalisation à l'écriture) ; préfixes
-- de 1 à 3 caractères indexés : la frappe en cours répond sans balayage.
CREATE VIRTUAL TABLE "music_fts" USING fts5(
    "id" UNINDEXED,
    "kind" UNINDEXED,
    "name",
    "artists",
    "album",
    tokenize = 'unicode61 remove_diacritics 2',
    prefix = '1 2 3'
);
