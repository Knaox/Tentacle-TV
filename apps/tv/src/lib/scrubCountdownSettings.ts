import { useCallback, useSyncExternalStore } from "react";
import { useUserId } from "@tentacle-tv/api-client";
import {
  createScrubCountdownStore,
  type ScrubCountdownSettings,
} from "@tentacle-tv/tv-core";
import { tvStorage } from "../storage/RNStorageAdapter";

/**
 * Le réglage « Avance rapide » (Apple TV) : ce que fait le décompte du
 * défilement à son terme, et au bout de combien (`scrubCountdownSettings.ts`,
 * tv-core). Réglage d'un COMPTE rangé sur le téléviseur — une clé par
 * identifiant Jellyfin (`tentacle_scrub_countdown:<id>`) : chaque profil de la
 * même Apple TV garde le sien, et le compte affiché est celui de
 * `tentacle_user` (`useUserId`).
 *
 * Écrit par l'onglet Lecture des réglages ; lu par le lecteur à chaque
 * ouverture du défilement (`hooks/scrubCountdownPolicy.ios.ts`).
 */
export const scrubCountdownStore = createScrubCountdownStore(tvStorage);

export function useScrubCountdownSettings(): {
  settings: ScrubCountdownSettings;
  update: (patch: Partial<ScrubCountdownSettings>) => void;
} {
  const userId = useUserId();
  const read = useCallback(() => scrubCountdownStore.read(userId), [userId]);
  const settings = useSyncExternalStore(scrubCountdownStore.subscribe, read, read);
  const update = useCallback(
    (patch: Partial<ScrubCountdownSettings>) => scrubCountdownStore.write(userId, patch),
    [userId],
  );
  return { settings, update };
}
