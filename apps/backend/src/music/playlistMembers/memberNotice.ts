/**
 * Octave — la personne à qui l'on partage une playlist le voit dans sa cloche (`music_playlist_shared` : le nom
 * de la playlist et de qui la partage, des données ; la phrase est celle de son client) et sa liste se relit
 * (`memberEvents.ts`). Une seule fois par partage (un droit changé ne sonne pas). Rien ne fait échouer le partage.
 */

import { getPrisma } from "../../services/db";
import { sendToUser } from "../../services/wsManager";
import { plainName } from "../../services/family/familyNotify";
import { MUSIC_PLAYLIST_SHARED_NOTIFICATION } from "../contract/musicPlaylistMembers";
import { normalizeId } from "../jellyfin/musicJellyfin";

export async function noticeShared(memberId: string, ownerName: string, playlistName: string, playlistId: string): Promise<void> {
  try {
    const refId = normalizeId(playlistId);
    // Partagée, retirée, repartagée : une seule ligne dans la cloche.
    await getPrisma().notification.deleteMany({ where: { jellyfinUserId: memberId, type: MUSIC_PLAYLIST_SHARED_NOTIFICATION, refId } });
    await getPrisma().notification.create({
      data: { jellyfinUserId: memberId, type: MUSIC_PLAYLIST_SHARED_NOTIFICATION, title: plainName(playlistName) || "Octave", body: plainName(ownerName), refId },
    });
    sendToUser(memberId, { type: "notifications:update", action: "refresh" });
  } catch (err) {
    console.warn("[octave] partage de playlist non notifié :", err instanceof Error ? err.message : err);
  }
}
