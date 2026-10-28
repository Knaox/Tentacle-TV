/**
 * « Qui regarde ? » sans serveur, sur le bureau et dans le navigateur — l'adaptateur des sorties
 * (`pickerUnreachableExits`, offline-core) : ce que le compte de l'appareil garde ici (lu seulement quand le
 * serveur ne répond pas, et seulement là où le hors ligne existe), son droit retenu, puis les deux gestes.
 *
 * « Continuer hors ligne » : le hors ligne MANUEL (un choix, dit et réversible par la pastille de connectivité),
 * au nom du COMPTE — une session de profil gardée y revient d'abord (`fallBackToAccount`, qui recharge), comme
 * quand la connexion tombe pendant un profil ; le choix de cette exécution vaut fait (`markLaunchPassed`).
 */

import { useEffect, useMemo, useState } from "react";
import { OFFLINE_KEEP_RIGHT_KEY, keepRightOf, lastKeepRight, pickerUnreachableExits } from "@tentacle-tv/offline-core";
import { supportsDownloads } from "../../desktop/capabilities";
import { readOfflineOwner } from "../../offline/offlineOwner";
import type { PickerExits } from "../picker/UnreachableExits";

// Le moteur du hors ligne, la connectivité et la bascule de session ne se chargent qu'au besoin (serveur muet,
// geste fait) : « Qui regarde ? » s'ouvre sans eux.

/** Le compte de l'appareil a-t-il un titre (film, épisode, musique) complet ici ? */
async function accountHasKeptContent(userId: string): Promise<boolean> {
  const [{ listDownloads }, { invoke }, { supportsMusicOffline }] = await Promise.all([
    import("../../downloads/api"),
    import("../../desktop/bridge"),
    import("../../desktop/capabilities"),
  ]);
  const videos = await listDownloads(userId);
  if (videos.some((entry) => entry.status === "complete")) return true;
  if (!supportsMusicOffline()) return false;
  try {
    const music = await invoke<{ tracks: { status: string }[] }>("downloads_music_list", { userId });
    return music.tracks.some((track) => track.status === "complete");
  } catch {
    return false;
  }
}

function readKeepRight(userId: string) {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OFFLINE_KEEP_RIGHT_KEY);
  } catch {
    /* stockage illisible : le droit reste inconnu */
  }
  return keepRightOf({ kind: "pending" }, lastKeepRight(raw, userId));
}

/** Passe hors ligne au nom du compte, puis `enterApp` (sauf si la page se recharge pour revenir au compte). */
export async function continueOfflineFromPicker(enterApp: () => void): Promise<void> {
  const [{ setManualOffline }, { clearPickerRequest }, { markLaunchPassed }, { fallBackToAccount }] = await Promise.all([
    import("../../offline/connectivityStore"),
    import("../../auth/profileEnded"),
    import("./launchState"),
    import("../../offline/accountFallback"),
  ]);
  setManualOffline(true);
  clearPickerRequest();
  markLaunchPassed();
  if (fallBackToAccount()) return;
  enterApp();
}

/** `active` : le serveur ne répond pas (rien n'est lu sinon). */
export function usePickerExits(active: boolean, enterApp: () => void, signOut: () => void): PickerExits | undefined {
  const offlineSupported = supportsDownloads();
  const owner = readOfflineOwner();
  const userId = owner?.userId ?? null;
  const [hasContent, setHasContent] = useState<boolean | null>(null);

  useEffect(() => {
    if (!active || !offlineSupported || !userId) return;
    let cancelled = false;
    void accountHasKeptContent(userId).then((kept) => {
      if (!cancelled) setHasContent(kept);
    });
    return () => {
      cancelled = true;
    };
  }, [active, offlineSupported, userId]);

  return useMemo(() => {
    if (!active) return undefined;
    const rule = pickerUnreachableExits({ offlineSupported, keepRight: userId ? readKeepRight(userId) : "unknown", hasContent: userId ? hasContent : false });
    return { goOffline: rule.goOffline ? () => void continueOfflineFromPicker(enterApp) : null, signOut };
  }, [active, offlineSupported, userId, hasContent, enterApp, signOut]);
}
