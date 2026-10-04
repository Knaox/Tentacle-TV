import { createRemoteHooks } from "../../shared/remoteHooks";
import { androidTvInput, ANDROIDTV_REMOTE_SUPPORTED } from "./remoteInput";

/**
 * L'entrée unique de la télécommande d'Android TV — voir
 * `docs/TV-NAVIGATION.md` (« Porter une autre télécommande ») et
 * `docs/tv-navigation/remote.md`. Même API que `platform/tvos/input` : le
 * reste de l'app la lit par le point d'entrée neutre (`platform/input`).
 */
export { androidTvInput, ANDROIDTV_REMOTE_SUPPORTED, receiveBack, receiveMenu, takeBack, withMenuIntent } from "./remoteInput";
export { attachRemoteLog, REMOTE_LOG_ENABLED } from "./remoteLog";
export type { BackTaker } from "@tentacle-tv/tv-core";
export type { RemoteContextOptions } from "../../shared/remoteHooks";

export const { useRemoteIntents, useRemoteContext, useTakenAhead } = createRemoteHooks(androidTvInput, ANDROIDTV_REMOTE_SUPPORTED);

/** Pas de pavé tactile sur Android TV : le pan continu n'existe pas, le tenir ne fait rien. */
export function acquirePanGesture(): () => void {
  return () => {};
}

export function usePanGesture(_enabled: boolean): void {}
