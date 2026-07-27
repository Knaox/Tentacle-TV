/**
 * Commandes de lecture locale : résolution de source, progression, file de
 * resynchronisation, purge à la demande.
 */

import { z } from "zod";
import { downloadsRoot, downloadsEngine } from "../downloadsRuntime";
import {
  localSource,
  markItemSynced,
  pendingReports,
  setPlaybackState,
} from "../downloads/playback";
import { purgeDueClaims, scheduleOnPlayed } from "../downloads/purge";
import { localDb } from "../localDb";
import { CommandRegistry } from "./registry";

const USER_ID = z.string().min(1).max(128);
const ITEM_ID = z.string().min(1);

const USER = z.object({ userId: USER_ID });
const USER_ITEM = z.object({ userId: USER_ID, itemId: ITEM_ID });

const PLAYBACK = z.object({
  userId: USER_ID,
  itemId: ITEM_ID,
  positionTicks: z.number(),
  played: z.boolean(),
  queueForSync: z.boolean(),
});

const SYNCED = z.object({
  userId: USER_ID,
  itemId: ITEM_ID,
  upToId: z.number().int(),
});

/** `null` explicite quand aucun item n'est exempté de la garde de lecture. */
const PURGE = z.object({ itemId: z.string().nullish() });

export function registerDownloadsPlaybackCommands(registry: CommandRegistry): void {
  registry
    .add("downloads_local_source", {
      schema: USER_ITEM,
      run: ({ userId, itemId }) =>
        localSource(localDb(), downloadsRoot(), userId, itemId, Date.now()),
    })
    .add("downloads_playback_set", {
      schema: PLAYBACK,
      run: ({ userId, itemId, positionTicks, played, queueForSync }) => {
        const db = localDb();
        const now = Date.now();
        setPlaybackState(db, userId, itemId, positionTicks, played, queueForSync, now);
        // L'échéance est posée ICI et non côté page : le lecteur peut être
        // démonté brutalement, la progression, elle, passe toujours.
        scheduleOnPlayed(db, userId, itemId, now);
      },
    })
    .add("downloads_reports_pending", {
      schema: USER,
      run: ({ userId }) => pendingReports(localDb(), userId),
    })
    .add("downloads_reports_mark_synced", {
      schema: SYNCED,
      run: ({ userId, itemId, upToId }) => {
        markItemSynced(localDb(), userId, itemId, upToId);
      },
    })
    .add("downloads_purge_due", {
      schema: PURGE,
      run: ({ itemId }) => {
        const purges = purgeDueClaims(localDb(), downloadsRoot(), Date.now(), itemId ?? null);
        if (purges > 0) downloadsEngine().notifyChanged();
        return purges;
      },
    });
}
