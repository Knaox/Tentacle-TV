-- Générée par `pnpm db:migration init` (prisma migrate diff). Ne se retouche plus une fois publiée.
-- CreateTable
CREATE TABLE "invite_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "createdBy" TEXT
);

-- CreateTable
CREATE TABLE "invite_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteKeyId" TEXT NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invite_usages_inviteKeyId_fkey" FOREIGN KEY ("inviteKeyId") REFERENCES "invite_keys" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "mediaItemId" TEXT,
    "mediaItemName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "refId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pushedAt" DATETIME
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "expoPushToken" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "jellyfinUserId" TEXT NOT NULL PRIMARY KEY,
    "libraryAdded" BOOLEAN NOT NULL DEFAULT false,
    "seerAvailable" BOOLEAN NOT NULL DEFAULT true,
    "tickets" BOOLEAN NOT NULL DEFAULT true,
    "family" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "library_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "audioLang" TEXT,
    "subtitleLang" TEXT,
    "subtitleMode" TEXT NOT NULL DEFAULT 'none'
);

-- CreateTable
CREATE TABLE "item_track_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "audioLang" TEXT,
    "subtitleLang" TEXT,
    "subtitleMode" TEXT NOT NULL DEFAULT 'none',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "server_config" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "content_claims" (
    "tmdbId" INTEGER NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,

    PRIMARY KEY ("tmdbId", "jellyfinUserId")
);

-- CreateTable
CREATE TABLE "library_known_id" (
    "itemId" TEXT NOT NULL PRIMARY KEY,
    "contentKey" TEXT,
    "removedAt" DATETIME
);

-- CreateTable
CREATE TABLE "announced_contents" (
    "contentKey" TEXT NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "notifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("contentKey", "jellyfinUserId")
);

-- CreateTable
CREATE TABLE "watchlist_auto_retired" (
    "seriesId" TEXT NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "retiredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("seriesId", "jellyfinUserId")
);

-- CreateTable
CREATE TABLE "watchlist_pending" (
    "jellyfinUserId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "flag" TEXT NOT NULL DEFAULT 'watchlist',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("jellyfinUserId", "mediaType", "tmdbId", "flag")
);

-- CreateTable
CREATE TABLE "pairing_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "deviceName" TEXT,
    "deviceId" TEXT,
    "jellyfinUserId" TEXT,
    "username" TEXT,
    "token" TEXT,
    "jellyfinAccessToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "provisioning_codes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "jellyfinUserId" TEXT,
    "username" TEXT,
    "jellyfinAccessToken" TEXT,
    "token" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "paired_devices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "jellyfinUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jellyfinAccessToken" TEXT,
    "jellyfinDeviceId" TEXT,
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentId" TEXT,
    "profileKind" TEXT,
    "profilesSince" DATETIME,
    "legacyTokenHash" TEXT,
    "stickyProfileId" TEXT,
    "manageUntil" DATETIME
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerUserId" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "ownerColor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "family_members" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "family_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "inviteeUserId" TEXT NOT NULL,
    "inviteeName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "respondedAt" DATETIME,
    "snoozedUntil" DATETIME
);

-- CreateTable
CREATE TABLE "profile_pins" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "pinHash" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "profile_pin_attempts" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lockCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "guest_account_cleanups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "jellyfinName" TEXT,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "paired_device_cleanups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinDeviceId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "ownerUsername" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'watchlist',
    "options" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "watch_segments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "seriesId" TEXT,
    "seriesName" TEXT,
    "clientName" TEXT,
    "deviceName" TEXT,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "runtimeSeconds" INTEGER,
    "audioLang" TEXT,
    "startedAt" DATETIME NOT NULL,
    "lastSeenAt" DATETIME NOT NULL,
    "closedAt" DATETIME
);

-- CreateTable
CREATE TABLE "watch_time_lease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "playback_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "introAction" TEXT NOT NULL DEFAULT 'auto',
    "introCountdown" BOOLEAN NOT NULL DEFAULT true,
    "introDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "outroAction" TEXT NOT NULL DEFAULT 'button',
    "outroCountdown" BOOLEAN NOT NULL DEFAULT true,
    "outroDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "outroFilmAction" TEXT NOT NULL DEFAULT 'auto',
    "outroFilmCountdown" BOOLEAN NOT NULL DEFAULT true,
    "outroFilmDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "recapAction" TEXT NOT NULL DEFAULT 'button',
    "recapCountdown" BOOLEAN NOT NULL DEFAULT true,
    "recapDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "previewAction" TEXT NOT NULL DEFAULT 'auto',
    "previewCountdown" BOOLEAN NOT NULL DEFAULT true,
    "previewDelayMs" INTEGER NOT NULL DEFAULT 5000,
    "nextCard" BOOLEAN NOT NULL DEFAULT true,
    "nextCountdown" BOOLEAN NOT NULL DEFAULT true,
    "nextCountdownMs" INTEGER NOT NULL DEFAULT 10000,
    "nextAutoPlay" BOOLEAN NOT NULL DEFAULT true,
    "nextFinalCard" BOOLEAN NOT NULL DEFAULT true,
    "nextTrigger" TEXT NOT NULL DEFAULT 'outroStart',
    "nextBeforeEndSeconds" INTEGER NOT NULL DEFAULT 45,
    "beforeEndEnabled" BOOLEAN NOT NULL DEFAULT true,
    "beforeEndMode" TEXT NOT NULL DEFAULT 'percent',
    "beforeEndValue" INTEGER NOT NULL DEFAULT 98,
    "beforeEndRules" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "media_frame_analysis" (
    "itemId" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "runtimeMs" INTEGER NOT NULL,
    "verdict" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "media_audio_analysis" (
    "itemId" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "runtimeMs" INTEGER NOT NULL,
    "verdict" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_ratings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "jellyfinItemId" TEXT,
    "seasonNumber" INTEGER NOT NULL DEFAULT 0,
    "episodeNumber" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextSyncAt" DATETIME,
    "tmdbSyncedAt" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_likes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "taste_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "facets" TEXT NOT NULL,
    "signalCount" INTEGER NOT NULL DEFAULT 0,
    "ratingMean" REAL NOT NULL DEFAULT 0,
    "ratingStdDev" REAL NOT NULL DEFAULT 0,
    "animeShare" REAL NOT NULL DEFAULT 0,
    "anchors" TEXT,
    "potentials" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "reco_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "personalized" BOOLEAN NOT NULL DEFAULT true,
    "includeVigie" BOOLEAN NOT NULL DEFAULT true,
    "community" BOOLEAN NOT NULL DEFAULT true,
    "shareHistory" BOOLEAN NOT NULL DEFAULT true,
    "explorationBalance" INTEGER NOT NULL DEFAULT 70,
    "providerFilter" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recommendation_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "home_layouts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "heroMode" TEXT NOT NULL DEFAULT 'reco',
    "heroFixedItemId" TEXT,
    "rows" TEXT NOT NULL,
    "cardDensity" TEXT NOT NULL DEFAULT 'normal',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "external_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "guestSessionId" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "item_cooccurrences" (
    "itemAKey" TEXT NOT NULL,
    "itemBKey" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "userCount" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("itemAKey", "itemBKey")
);

-- CreateTable
CREATE TABLE "facet_idf" (
    "facetKey" TEXT NOT NULL PRIMARY KEY,
    "docCount" INTEGER NOT NULL,
    "idf" REAL NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tmdb_meta_cache" (
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,

    PRIMARY KEY ("mediaType", "tmdbId")
);

-- CreateTable
CREATE TABLE "user_liked_people" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "personId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "profilePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user_swipes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jellyfinUserId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "tmdbId" INTEGER NOT NULL,
    "verdict" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_keys_key_key" ON "invite_keys"("key");

-- CreateIndex
CREATE INDEX "invite_keys_key_idx" ON "invite_keys"("key");

-- CreateIndex
CREATE INDEX "support_tickets_jellyfinUserId_idx" ON "support_tickets"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "notifications_jellyfinUserId_read_idx" ON "notifications"("jellyfinUserId", "read");

-- CreateIndex
CREATE INDEX "notifications_type_pushedAt_idx" ON "notifications"("type", "pushedAt");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_expoPushToken_key" ON "push_devices"("expoPushToken");

-- CreateIndex
CREATE INDEX "push_devices_jellyfinUserId_idx" ON "push_devices"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "library_preferences_jellyfinUserId_idx" ON "library_preferences"("jellyfinUserId");

-- CreateIndex
CREATE UNIQUE INDEX "library_preferences_jellyfinUserId_libraryId_key" ON "library_preferences"("jellyfinUserId", "libraryId");

-- CreateIndex
CREATE INDEX "item_track_preferences_jellyfinUserId_idx" ON "item_track_preferences"("jellyfinUserId");

-- CreateIndex
CREATE UNIQUE INDEX "item_track_preferences_jellyfinUserId_itemId_key" ON "item_track_preferences"("jellyfinUserId", "itemId");

-- CreateIndex
CREATE INDEX "content_claims_expiresAt_idx" ON "content_claims"("expiresAt");

-- CreateIndex
CREATE INDEX "library_known_id_contentKey_idx" ON "library_known_id"("contentKey");

-- CreateIndex
CREATE INDEX "announced_contents_notifiedAt_idx" ON "announced_contents"("notifiedAt");

-- CreateIndex
CREATE INDEX "watchlist_auto_retired_jellyfinUserId_idx" ON "watchlist_auto_retired"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "watchlist_pending_mediaType_tmdbId_idx" ON "watchlist_pending"("mediaType", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "pairing_codes_code_key" ON "pairing_codes"("code");

-- CreateIndex
CREATE INDEX "pairing_codes_expiresAt_idx" ON "pairing_codes"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "provisioning_codes_code_key" ON "provisioning_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "paired_devices_tokenHash_key" ON "paired_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "paired_devices_jellyfinUserId_idx" ON "paired_devices"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "paired_devices_tokenHash_idx" ON "paired_devices"("tokenHash");

-- CreateIndex
CREATE INDEX "paired_devices_parentId_idx" ON "paired_devices"("parentId");

-- CreateIndex
CREATE INDEX "paired_devices_legacyTokenHash_idx" ON "paired_devices"("legacyTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "families_ownerUserId_key" ON "families"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_familyId_userId_key" ON "family_members"("familyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_userId_key" ON "family_members"("userId");

-- CreateIndex
CREATE INDEX "family_invitations_inviteeUserId_status_idx" ON "family_invitations"("inviteeUserId", "status");

-- CreateIndex
CREATE INDEX "family_invitations_ownerUserId_createdAt_idx" ON "family_invitations"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "family_invitations_familyId_status_idx" ON "family_invitations"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "guest_account_cleanups_jellyfinUserId_key" ON "guest_account_cleanups"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "guest_account_cleanups_nextAttemptAt_idx" ON "guest_account_cleanups"("nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "paired_device_cleanups_jellyfinDeviceId_key" ON "paired_device_cleanups"("jellyfinDeviceId");

-- CreateIndex
CREATE INDEX "paired_device_cleanups_nextAttemptAt_idx" ON "paired_device_cleanups"("nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE INDEX "share_links_token_idx" ON "share_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_ownerUserId_kind_key" ON "share_links"("ownerUserId", "kind");

-- CreateIndex
CREATE INDEX "watch_segments_jellyfinUserId_startedAt_idx" ON "watch_segments"("jellyfinUserId", "startedAt");

-- CreateIndex
CREATE INDEX "watch_segments_jellyfinUserId_seriesId_idx" ON "watch_segments"("jellyfinUserId", "seriesId");

-- CreateIndex
CREATE INDEX "watch_segments_startedAt_idx" ON "watch_segments"("startedAt");

-- CreateIndex
CREATE INDEX "watch_segments_sessionKey_itemId_closedAt_idx" ON "watch_segments"("sessionKey", "itemId", "closedAt");

-- CreateIndex
CREATE INDEX "watch_segments_closedAt_idx" ON "watch_segments"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "playback_settings_jellyfinUserId_key" ON "playback_settings"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "user_ratings_jellyfinUserId_idx" ON "user_ratings"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "user_ratings_syncStatus_nextSyncAt_idx" ON "user_ratings"("syncStatus", "nextSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_ratings_identity_key" ON "user_ratings"("jellyfinUserId", "mediaType", "tmdbId", "seasonNumber", "episodeNumber");

-- CreateIndex
CREATE INDEX "user_likes_jellyfinUserId_idx" ON "user_likes"("jellyfinUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_likes_jellyfinUserId_mediaType_tmdbId_key" ON "user_likes"("jellyfinUserId", "mediaType", "tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "taste_profiles_jellyfinUserId_key" ON "taste_profiles"("jellyfinUserId");

-- CreateIndex
CREATE UNIQUE INDEX "reco_settings_jellyfinUserId_key" ON "reco_settings"("jellyfinUserId");

-- CreateIndex
CREATE INDEX "recommendation_cache_expiresAt_idx" ON "recommendation_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_cache_jellyfinUserId_rowKey_key" ON "recommendation_cache"("jellyfinUserId", "rowKey");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_feedback_jellyfinUserId_itemKey_key" ON "recommendation_feedback"("jellyfinUserId", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "home_layouts_jellyfinUserId_key" ON "home_layouts"("jellyfinUserId");

-- CreateIndex
CREATE UNIQUE INDEX "external_accounts_jellyfinUserId_provider_key" ON "external_accounts"("jellyfinUserId", "provider");

-- CreateIndex
CREATE INDEX "item_cooccurrences_itemAKey_idx" ON "item_cooccurrences"("itemAKey");

-- CreateIndex
CREATE INDEX "tmdb_meta_cache_expiresAt_idx" ON "tmdb_meta_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_liked_people_jellyfinUserId_personId_key" ON "user_liked_people"("jellyfinUserId", "personId");

-- CreateIndex
CREATE INDEX "user_swipes_jellyfinUserId_updatedAt_idx" ON "user_swipes"("jellyfinUserId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_swipes_jellyfinUserId_mediaType_tmdbId_key" ON "user_swipes"("jellyfinUserId", "mediaType", "tmdbId");
