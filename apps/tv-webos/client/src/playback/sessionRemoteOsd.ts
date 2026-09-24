import { onSessionCommand, type SessionCommand } from "@tentacle-tv/api-client";
import { showOsd, tvPlayerActive } from "@tentacle-tv/tv-core";

/**
 * Une commande de la télécommande de Jellyfin montre l'habillage du lecteur.
 *
 * Le lecteur du web obéit déjà au canal (`useSessionRemote` de `VideoPlayer`) :
 * pause, reprise, saut, pistes, arrêt. Mais qui regarde doit VOIR que la
 * lecture vient d'être mise en pause ou déplacée par quelqu'un d'autre — sinon
 * l'image se fige sans explication. Même règle que `useTVSessionRemote` sur
 * l'Apple TV et Android TV. L'arrêt et les pistes n'en ont pas besoin : l'un
 * quitte le lecteur, les autres s'entendent et se lisent à l'écran.
 */

const SHOWN: ReadonlySet<SessionCommand["command"]> = new Set<SessionCommand["command"]>([
  "Pause", "Unpause", "PlayPause", "Seek", "Rewind", "FastForward",
]);

export function installSessionRemoteOsd(): () => void {
  return onSessionCommand(({ command }) => {
    if (tvPlayerActive() && SHOWN.has(command)) showOsd();
  });
}
