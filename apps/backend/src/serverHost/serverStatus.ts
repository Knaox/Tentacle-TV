import { getAppState } from "../services/configStore";
import { BOOT_ID, isRestartPending } from "../services/pluginRestart";
import { someoneIsWatching } from "../services/segmentPlugins/jellyfinRestart";
import type { ServerStatus } from "./hostProtocol";

const PLAYBACK_PROBE_MS = 3000;

/** Une lecture en cours sur Jellyfin ; `null` si on ne sait pas — l'hôte le prend pour « peut-être ». */
async function playbackActive(): Promise<boolean | null> {
  if (getAppState() !== "running") return null;
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      someoneIsWatching(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), PLAYBACK_PROBE_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** La réponse à `status` : de quoi choisir un moment calme pour une mise à jour du Store. */
export async function serverStatus(): Promise<ServerStatus> {
  return {
    bootId: BOOT_ID,
    appState: getAppState(),
    playbackActive: await playbackActive(),
    restartPending: isRestartPending(),
  };
}
