/**
 * Resynchronisation de la progression regardée HORS LIGNE, au retour en ligne.
 * File Rust dédupliquée (dernier état par item) → pour chaque item :
 * `POST /api/jellyfin/UserItems/{id}/UserData` (style moderne 10.9+, pérenne
 * 12.0) avec le token de l'utilisateur — position, état « vu », date réelle
 * de visionnage. Séquentiel ; au premier échec on s'arrête : le reste demeure
 * en file et sera retenté au prochain passage en ligne.
 */

import { backendUrl } from "../main";
import { markReportSynced, pendingReports } from "../downloads/playbackApi";

export async function drainReportQueue(userId: string): Promise<number> {
  let token: string | null = null;
  try {
    token = localStorage.getItem("tentacle_token");
  } catch {
    return 0;
  }
  if (!token) return 0;

  const pending = await pendingReports(userId);
  let synced = 0;
  for (const report of pending) {
    const body: Record<string, unknown> = {
      PlaybackPositionTicks: report.played ? 0 : report.positionTicks,
      Played: report.played,
    };
    if (report.played && report.occurredAtUtc > 0) {
      body.LastPlayedDate = new Date(report.occurredAtUtc).toISOString();
    }
    try {
      // X-Emby-Token : format du proxy /api/jellyfin (un Bearer y ferait 401).
      const res = await fetch(`${backendUrl}/api/jellyfin/UserItems/${report.itemId}/UserData`, {
        method: "POST",
        headers: { "X-Emby-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) break;
      await markReportSynced(userId, report.itemId, report.id);
      synced += 1;
    } catch {
      break;
    }
  }
  return synced;
}
