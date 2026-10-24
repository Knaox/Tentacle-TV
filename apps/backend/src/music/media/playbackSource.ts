/**
 * Octave — la SOURCE de lecture d'un titre de la bibliothèque (contrat
 * `PlaybackSource`) : le flux direct du cœur, le format VRAI du fichier (sondé
 * par Jellyfin), la ReplayGain de ses tags. Jamais d'expiration : l'URL ne
 * porte aucun secret, le moteur y pose l'authentification.
 */

import { MUSIC_ROUTES } from "../contract/musicCoreApi";
import { libraryTrackKey } from "../contract/musicKeys";
import type { PlaybackSource } from "../contract/musicPlayback";
import { rowById } from "../index/indexQueries";
import type { IndexRow } from "../index/indexTypes";
import { normalizeId } from "../jellyfin/musicJellyfin";
import { visibleRows, type UserView } from "../view/viewContext";
import { replayGainFor } from "./replayGainReader";

/** Le titre de l'index que ce compte peut lire ; `null` sinon (absent, caché, pas un titre). */
export async function playableRow(view: UserView, itemId: string): Promise<IndexRow | null> {
  const row = await rowById(normalizeId(itemId));
  if (!row || row.kind !== "track") return null;
  return visibleRows(view, [row])[0] ?? null;
}

export async function sourceFor(view: UserView, itemId: string): Promise<PlaybackSource | null> {
  const row = await playableRow(view, itemId);
  if (!row) return null;
  return {
    trackKey: libraryTrackKey(row.id),
    url: MUSIC_ROUTES.stream.replace(":id", row.id),
    origin: "library",
    complete: true,
    sizeBytes: row.sizeBytes,
    durationMs: row.durationMs,
    format: row.format,
    replayGain: await replayGainFor(row),
    expiresAt: null,
  };
}
