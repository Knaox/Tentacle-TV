import type { MediaItem, UserItemData } from "./types/media";
import { TICKS_PER_SECOND } from "./constants";

/** Watch state for a single media item. */
export type WatchStatus = "unwatched" | "in_progress" | "watched";

/** Result of the getNextEpisode algorithm for a series. */
export type NextEpisodeResult =
  | { type: "completed" }
  | { type: "start"; episode: MediaItem }
  | { type: "continue"; episode: MediaItem; positionTicks: number }
  | { type: "next"; episode: MediaItem };

/** Determine the watch status of a single item. */
export function getWatchStatus(userData?: UserItemData): WatchStatus {
  if (!userData) return "unwatched";
  if (userData.Played) return "watched";
  if (userData.PlaybackPositionTicks > 0) return "in_progress";
  return "unwatched";
}

/** Get playback progress as 0-100 percentage. */
export function getProgressPercent(item: MediaItem): number {
  const position = item.UserData?.PlaybackPositionTicks ?? 0;
  const duration = item.RunTimeTicks ?? 0;
  if (duration <= 0 || position <= 0) return 0;
  return Math.min(100, Math.round((position / duration) * 100));
}

/** Format ticks to HH:MM:SS or MM:SS string. */
export function formatPosition(ticks: number): string {
  const totalSeconds = Math.floor(ticks / TICKS_PER_SECOND);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Strict "next episode" algorithm for a series.
 *
 * Episodes MUST be sorted by season (ParentIndexNumber) then episode (IndexNumber).
 *
 * Rules:
 * 1. Find the first episode where Played is false (firstUnfinished)
 * 2. If none → series completed
 * 3. If firstUnfinished has PlaybackPositionTicks > 0 → "continue" that episode
 * 4. If firstUnfinished is the very first episode → "start"
 * 5. If the previous episode has Played = true → "next" with firstUnfinished
 * 6. Otherwise → "continue" previous episode (safety fallback)
 */
export function getNextEpisode(episodes: MediaItem[]): NextEpisodeResult {
  if (episodes.length === 0) return { type: "completed" };

  // Find first unfinished episode
  const firstUnfinishedIdx = episodes.findIndex(
    (ep) => !ep.UserData?.Played
  );

  // All episodes watched
  if (firstUnfinishedIdx === -1) return { type: "completed" };

  const episode = episodes[firstUnfinishedIdx];
  const position = episode.UserData?.PlaybackPositionTicks ?? 0;

  // Episode is in progress
  if (position > 0) {
    return { type: "continue", episode, positionTicks: position };
  }

  // First episode of the series, never started
  if (firstUnfinishedIdx === 0) {
    return { type: "start", episode };
  }

  // Check previous episode
  const prev = episodes[firstUnfinishedIdx - 1];
  if (prev.UserData?.Played) {
    // Previous is done → this is the next episode
    return { type: "next", episode };
  }

  // Safety fallback: previous not finished, continue it
  const prevPosition = prev.UserData?.PlaybackPositionTicks ?? 0;
  return { type: "continue", episode: prev, positionTicks: prevPosition };
}

/** Get display text for the next episode result (French). */
export function getNextEpisodeLabel(result: NextEpisodeResult): string | null {
  if (result.type === "completed") return null;
  const ep = result.episode;
  const num = `S${String(ep.ParentIndexNumber ?? 0).padStart(2, "0")}E${String(ep.IndexNumber ?? 0).padStart(2, "0")}`;

  switch (result.type) {
    case "start":
      return `Commencer ${num}`;
    case "continue":
      return `Continuer ${num} — ${formatPosition(result.positionTicks)}`;
    case "next":
      return `Episode suivant : ${num}`;
  }
}
