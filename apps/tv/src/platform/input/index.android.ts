import { ANDROIDTV_BINDINGS, type RemoteHintId } from "@tentacle-tv/tv-core";
import { androidTvInput, attachRemoteLog, REMOTE_LOG_ENABLED } from "../androidtv/input";

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

// Le journal de développement s'attache dès le chargement de l'app : l'entrée,
// elle, ne se charge qu'à la première écoute (`inlineRequires`). Éteint, rien
// n'est lu de plus que le drapeau.
if (REMOTE_LOG_ENABLED) attachRemoteLog(androidTvInput);

/** La table de la télécommande de cette plateforme. */
export const REMOTE_BINDINGS = ANDROIDTV_BINDINGS;

/** La clé i18n d'un texte qui nomme une touche, selon la télécommande (`t(remoteHint(id))`). */
export function remoteHint(id: RemoteHintId): string {
  return REMOTE_BINDINGS.hints[id];
}
