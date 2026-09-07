/**
 * Ce qui part vers Jellyfin pour resynchroniser une progression regardée hors
 * ligne.
 *
 * - `reportBody` : le corps historique (bureau) — `POST UserItems/{id}/UserData`
 *   avec `Played`, position et date réelle du visionnage.
 * - `reportRequest` (mobile) : un titre VU passe par « marquer comme lu »
 *   (`Users/{u}/PlayedItems/{id}?datePlayed=`, qui incrémente le compteur de
 *   lectures et pose la date) ; un arrêt partiel n'envoie que la position et
 *   la date, JAMAIS `Played: false` — Jellyfin lui-même ne dé-marque pas un
 *   titre sur un arrêt, et le drapeau serveur reste respecté.
 * - `drainOutcome` et `serverIsNewer` : la politique du drain.
 */

import type { PendingReport } from "../core/playback";
import type { ServerUserData } from "../core/reconcile";

export function reportBody(report: PendingReport): Record<string, unknown> {
  const body: Record<string, unknown> = {
    PlaybackPositionTicks: report.played ? 0 : report.positionTicks,
    Played: report.played,
  };
  if (report.played && report.occurredAtUtc > 0) {
    body.LastPlayedDate = new Date(report.occurredAtUtc).toISOString();
  }
  return body;
}

export interface ReportRequest {
  method: "POST";
  /** Relatif à `/api/jellyfin/`. */
  path: string;
  body: Record<string, unknown> | null;
}

/**
 * La requête d'un rapport — les deux routes que le proxy laisse passer
 * (`Users/{u}/PlayedItems/{id}`, `UserItems/{id}/UserData`).
 */
export function reportRequest(report: PendingReport, userId: string): ReportRequest {
  const date = report.occurredAtUtc > 0 ? new Date(report.occurredAtUtc).toISOString() : null;
  if (report.played) {
    const query = date === null ? "" : `?datePlayed=${encodeURIComponent(date)}`;
    return { method: "POST", path: `Users/${encodeURIComponent(userId)}/PlayedItems/${report.itemId}${query}`, body: null };
  }
  const body: Record<string, unknown> = { PlaybackPositionTicks: report.positionTicks };
  if (date !== null) body.LastPlayedDate = date;
  return { method: "POST", path: `UserItems/${report.itemId}/UserData`, body };
}

export type DrainOutcome = "synced" | "skipped" | "stop";

/**
 * 2xx → synchronisé ; 400 / 404 / 410 / 422 → le titre est perdu pour le
 * serveur, on passe (marqué synchronisé) ; 401 / 403 / 408 / 429 / 5xx / réseau
 * (`null`) → on s'arrête, le reste attend le prochain passage.
 */
export function drainOutcome(status: number | null): DrainOutcome {
  if (status === null) return "stop";
  if (status >= 200 && status < 300) return "synced";
  if (status === 400 || status === 404 || status === 410 || status === 422) return "skipped";
  return "stop";
}

/** Dernier écrivain gagne : le serveur a vu ce titre APRÈS ce rapport ? */
export function serverIsNewer(report: PendingReport, server: ServerUserData | undefined): boolean {
  if (server === undefined || server.lastPlayedAtMs === null) return false;
  return server.lastPlayedAtMs > report.occurredAtUtc;
}
