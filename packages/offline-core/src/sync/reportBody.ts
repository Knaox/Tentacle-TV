/**
 * Le corps envoyé à Jellyfin pour resynchroniser une progression regardée hors
 * ligne : `POST /api/jellyfin/UserItems/{id}/UserData` (style 10.9+, pérenne
 * 12.0). Un item vu repart à zéro avec `Played`, et porte la date RÉELLE du
 * visionnage — pas celle de la resynchronisation.
 */

import type { PendingReport } from "../core/playback";

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
