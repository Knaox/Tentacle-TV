import { getJellyfinUrl, getJellyfinApiKey } from "./configStore";
import { broadcastAll } from "./wsManager";

const POLL_INTERVAL = 300_000; // 5 min (fallback — le WebSocket Jellyfin gère le temps réel)
let timer: ReturnType<typeof setInterval> | null = null;

// In-memory snapshots for change detection
let lastItemCount: number | null = null;
let lastLatestIds: string | null = null;
let lastSessionCount: number | null = null;

async function jfFetch<T>(path: string): Promise<T | null> {
  const url = getJellyfinUrl();
  const apiKey = getJellyfinApiKey();
  if (!url || !apiKey) return null;

  try {
    const res = await fetch(`${url}${path}`, {
      headers: { "X-Emby-Token": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

async function poll(): Promise<void> {
  try {
    // 1. Check item count changes (recently added)
    const counts = await jfFetch<{ MovieCount?: number; SeriesCount?: number; EpisodeCount?: number }>(
      "/Items/Counts",
    );
    if (counts) {
      const total = (counts.MovieCount ?? 0) + (counts.SeriesCount ?? 0) + (counts.EpisodeCount ?? 0);
      if (lastItemCount !== null && total !== lastItemCount) {
        broadcastAll("recently_added");
      }
      lastItemCount = total;
    }

    // 2. Check latest items (more granular change detection)
    const latest = await jfFetch<Array<{ Id: string }>>(
      "/Items/Latest?Limit=5&Fields=DateCreated",
    );
    if (latest) {
      const ids = latest.map((i) => i.Id).join(",");
      if (lastLatestIds !== null && ids !== lastLatestIds) {
        broadcastAll("recently_added");
        broadcastAll("featured");
      }
      lastLatestIds = ids;
    }

    // 3. Check active sessions (playback activity)
    const sessions = await jfFetch<Array<{ NowPlayingItem?: unknown }>>(
      "/Sessions",
    );
    if (sessions) {
      const activePlaying = sessions.filter((s) => s.NowPlayingItem).length;
      if (lastSessionCount !== null && activePlaying !== lastSessionCount) {
        broadcastAll("continue_watching");
        broadcastAll("next_up");
      }
      lastSessionCount = activePlaying;
    }
  } catch (err) {
    console.error("[JellyfinPoller] Error:", err);
  }
}

export function startJellyfinPoller(): void {
  if (timer) return;
  console.log("[JellyfinPoller] Started as fallback (interval: 5min)");
  timer = setInterval(poll, POLL_INTERVAL);
  // Initial poll after a short delay to let the server finish starting
  setTimeout(poll, 5_000);
}

export function stopJellyfinPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
