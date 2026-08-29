import { getJellyfinApiKey, getJellyfinUrl } from "../configStore";
import type { Sample, RawSession } from "./types";

/**
 * Lecture des sessions Jellyfin — la vue du SERVEUR, pas celle des clients.
 *
 * C'est ce qui rend la mesure imperméable au chemin réseau : en mode Direct
 * Streaming, les clients envoient leurs rapports de lecture directement à
 * Jellyfin sans passer par notre proxy. Une mesure branchée sur le proxy aurait
 * des trous ; celle-ci voit tout.
 */

/** Un tick Jellyfin vaut 100 ns. */
const TICKS_PER_SECOND = 10_000_000;

/** Au-delà d'un jour d'écart, un horodatage est tenu pour aberrant. */
const ABSURD_GAP_MS = 24 * 3600_000;

export async function readSessions(): Promise<RawSession[] | null> {
  const base = getJellyfinUrl();
  const key = getJellyfinApiKey();
  if (!base || !key) return null;

  try {
    const res = await fetch(`${base}/Sessions`, {
      headers: { "X-Emby-Token": key },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? (data as RawSession[]) : null;
  } catch {
    // Jellyfin injoignable : on ne crédite rien et on ne touche à rien. Le
    // temps de la panne est perdu, il n'est pas rattrapé au retour.
    return null;
  }
}

/**
 * Convertit un horodatage Jellyfin en millisecondes, ou `null` s'il est absent
 * ou aberrant. Jellyfin renvoie `0001-01-01T00:00:00Z` quand le champ n'a
 * jamais été posé : c'est « inconnu », pas « très ancien ».
 */
function instant(value: string | undefined, nowMs: number): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.abs(nowMs - ms) > ABSURD_GAP_MS ? null : ms;
}

/**
 * Ne retient que les sessions qui jouent quelque chose, sous une forme stable.
 * Fonction PURE : `maintenantMs` est passé, jamais lu de l'horloge — c'est ce
 * qui rend le tout testable image par image.
 */
export function normalize(raw: RawSession[], nowMs: number): Sample[] {
  const out: Sample[] = [];

  for (const s of raw) {
    const item = s.NowPlayingItem;
    if (!s.Id || !s.UserId || !item?.Id) continue;

    out.push({
      sessionKey: s.Id,
      userId: s.UserId,
      itemId: item.Id,
      itemType: item.Type ?? "Unknown",
      itemName: (item.Name ?? "").slice(0, 500),
      seriesId: item.SeriesId ?? null,
      seriesName: item.SeriesName ? item.SeriesName.slice(0, 500) : null,
      clientName: s.Client ? s.Client.slice(0, 100) : null,
      deviceName: s.DeviceName ? s.DeviceName.slice(0, 191) : null,
      runtimeSeconds: item.RunTimeTicks ? Math.round(item.RunTimeTicks / TICKS_PER_SECOND) : null,
      paused: s.PlayState?.IsPaused === true,
      active: s.IsActive !== false,
      positionTicks: s.PlayState?.PositionTicks ?? 0,
      // `LastPlaybackCheckIn` d'abord : il ne bouge que pendant une lecture.
      // `LastActivityDate` bouge à la moindre requête du client, y compris
      // quand il ne joue rien — il ne sert donc que de repli.
      checkInMs:
        instant(s.LastPlaybackCheckIn, nowMs) ?? instant(s.LastActivityDate, nowMs),
    });
  }

  return out;
}
