import { TVOS_BINDINGS, type RemoteHintId } from "@tentacle-tv/tv-core";

/**
 * Le POINT D'ENTRÉE NEUTRE de la télécommande : ce que le reste de l'app
 * importe, sans savoir sur quelle plateforme il tourne.
 *
 * Ce fichier est celui de l'Apple TV (la base : tsc le lit, Metro le prend
 * sur tvOS) ; `index.android.ts`, son jumeau, sert Android TV avec les MÊMES
 * noms. Un nouveau nom s'ajoute aux deux — le typage du suffixe `.android`
 * le vérifie (`docs/TV-NAVIGATION.md`, « Porter une autre télécommande »).
 */
export {
  acquirePanGesture,
  receiveMenu,
  tvosInput as remoteInput,
  TVOS_REMOTE_SUPPORTED as REMOTE_SUPPORTED,
  usePanGesture,
  useRemoteContext,
  useRemoteIntents,
  useTakenAhead,
  withMenuIntent,
  type RemoteContextOptions,
} from "../tvos/input";

/** La table de la télécommande de cette plateforme. */
export const REMOTE_BINDINGS = TVOS_BINDINGS;

/** La clé i18n d'un texte qui nomme une touche, selon la télécommande ; `null` : ne rien dire. */
export function remoteHint(id: RemoteHintId): string | null {
  return REMOTE_BINDINGS.hints[id];
}
