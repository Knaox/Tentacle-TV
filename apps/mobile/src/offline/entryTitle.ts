import type { OfflineEntry } from "./engineApi";

/**
 * Le nom d'un titre gardé, tel qu'il s'écrit partout : dans la liste, dans la
 * feuille d'actions et dans les notifications.
 *
 * Un épisode porte son code — « S01E05 · Et voici… ». Sans lui, une
 * notification annonçait « Et voici Naruto Uzumaki », et rien ne disait de
 * quel épisode il s'agissait.
 */
export function entryTitle(entry: OfflineEntry): string {
  const code = episodeCode(entry);
  return code === null ? (entry.title ?? entry.itemId) : `${code} · ${entry.title ?? entry.itemId}`;
}

/** « S01E05 », ou `null` si ce n'est pas un épisode numéroté. */
export function episodeCode(entry: OfflineEntry): string | null {
  if (entry.kind !== "episode" || entry.indexNumber == null) return null;
  const season = String(entry.parentIndexNumber ?? 1).padStart(2, "0");
  return `S${season}E${String(entry.indexNumber).padStart(2, "0")}`;
}
