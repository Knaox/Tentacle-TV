import { ANDROIDTV_BINDINGS, type RemoteHintId } from "@tentacle-tv/tv-core";

/**
 * Le point d'entrée neutre de la télécommande, sur Android TV — le jumeau de
 * `index.ts` (Apple TV), aux MÊMES noms.
 */
export {
  acquirePanGesture,
  receiveMenu,
  androidTvInput as remoteInput,
  ANDROIDTV_REMOTE_SUPPORTED as REMOTE_SUPPORTED,
  usePanGesture,
  useRemoteContext,
  useRemoteIntents,
  useTakenAhead,
  withMenuIntent,
  type RemoteContextOptions,
} from "../androidtv/input";

/** La table de la télécommande de cette plateforme. */
export const REMOTE_BINDINGS = ANDROIDTV_BINDINGS;

/** La clé i18n d'un texte qui nomme une touche, selon la télécommande (`t(remoteHint(id))`). */
export function remoteHint(id: RemoteHintId): string {
  return REMOTE_BINDINGS.hints[id];
}
