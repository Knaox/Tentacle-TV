import type { StorageAdapter } from "@tentacle-tv/api-client";
import type { PlaybackOwner } from "@tentacle-tv/tv-core/playback";

/**
 * Le compte et l'appareil de la session courante ; `null` sans session. Ce qui
 * appartient à une lecture — la file des rapports, le marqueur de relance —
 * porte ce couple : rien n'en survit à un changement de compte ni d'identité
 * d'appareil (rejumelage).
 */
export function sessionOwnerOf(storage: StorageAdapter, deviceId: string): PlaybackOwner | null {
  if (!storage.getItem("tentacle_token")) return null;
  try {
    const user = JSON.parse(storage.getItem("tentacle_user") ?? "null") as { Id?: string } | null;
    return user?.Id ? { userId: user.Id, deviceId } : null;
  } catch {
    return null;
  }
}
