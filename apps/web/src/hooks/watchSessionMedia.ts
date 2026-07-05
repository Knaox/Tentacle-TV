import type { JellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem, MediaStream as JfStream } from "@tentacle-tv/shared";
import type { AudioTrack, SubtitleTrack } from "../components/player/videoPlayer.types";

/**
 * Helpers média purs de la session de lecture (labels de pistes, listes de
 * pistes pour les sélecteurs, bannière). Extraction mécanique de
 * useWatchSession (limite 300 lignes/fichier).
 */

type TFunc = (key: string, opts?: Record<string, unknown>) => string;

/** UUID v4 (crypto.randomUUID si dispo, sinon getRandomValues). */
export function generatePlaySessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatTrackLabel(s: JfStream, t: TFunc): string {
  const title = s.DisplayTitle || s.Title || s.Language || t("player:trackFallback", { index: s.Index });
  const codec = s.Codec?.toUpperCase();
  const parts = [title];
  if (codec && !title.toUpperCase().includes(codec)) parts.push(codec);
  return parts.join(" - ");
}

export function buildAudioTracks(streams: JfStream[], t: TFunc): AudioTrack[] {
  return streams.filter((s) => s.Type === "Audio")
    .map((s) => ({ index: s.Index, label: formatTrackLabel(s, t), lang: s.Language?.toLowerCase() }));
}

export function buildSubtitleTracks(
  streams: JfStream[],
  client: JellyfinClient,
  itemId: string,
  mediaSourceId: string,
  t: TFunc,
): SubtitleTrack[] {
  return streams.filter((s) => s.Type === "Subtitle")
    .map((s) => ({
      index: s.Index,
      label: formatTrackLabel(s, t),
      url: client.getSubtitleUrl(itemId, mediaSourceId, s.Index),
      lang: s.Language?.toLowerCase(),
      codec: s.Codec?.toLowerCase(),
    }));
}

/** Chaîne de repli pour toujours avoir une bannière quand l'item est chargé :
 *  backdrop propre (films) → backdrop du parent (épisodes) → backdrop de la
 *  série via SeriesId (épisodes dont les champs ParentBackdrop* manquent). */
export function buildPosterUrl(client: JellyfinClient, item: MediaItem | undefined): string | undefined {
  if (!item) return undefined;
  if ((item.BackdropImageTags?.length ?? 0) > 0) {
    return client.getImageUrl(item.Id, "Backdrop", { width: 1920, quality: 80 });
  }
  if ((item.ParentBackdropImageTags?.length ?? 0) > 0 && item.ParentBackdropItemId) {
    return client.getImageUrl(item.ParentBackdropItemId, "Backdrop", { width: 1920, quality: 80 });
  }
  if (item.SeriesId) {
    return client.getImageUrl(item.SeriesId, "Backdrop", { width: 1920, quality: 80 });
  }
  return undefined;
}
