/**
 * Resynchronisation de la progression regardée HORS LIGNE, au retour en
 * ligne : file dédupliquée (dernier état par titre) → pour chaque titre,
 * `POST /api/jellyfin/UserItems/{id}/UserData` avec le jeton de session.
 * Séquentiel ; au premier échec on s'arrête : le reste demeure en file et
 * sera retenté au prochain passage en ligne.
 */

import { markItemSynced, pendingReports, reportBody } from "@tentacle-tv/offline-core";
import { localDb } from "./database";

export async function drainReportQueue(serverUrl: string, token: string, userId: string): Promise<number> {
  const db = localDb();
  let synced = 0;
  for (const report of pendingReports(db, userId)) {
    try {
      // X-Emby-Token : format du proxy /api/jellyfin (un Bearer y ferait 401).
      const res = await fetch(`${serverUrl}/api/jellyfin/UserItems/${report.itemId}/UserData`, {
        method: "POST",
        headers: { "X-Emby-Token": token, "Content-Type": "application/json" },
        body: JSON.stringify(reportBody(report)),
      });
      if (!res.ok) break;
      markItemSynced(db, userId, report.itemId, report.id);
      synced += 1;
    } catch {
      break;
    }
  }
  return synced;
}
