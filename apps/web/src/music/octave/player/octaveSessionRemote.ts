/**
 * Octave dans les sessions en cours de l'administration (web et bureau).
 *
 * - La TÉLÉCOMMANDE : pause, reprise, arrêt (et saut, suivant, précédent) que
 *   l'administration de Tentacle — ou celle de Jellyfin — envoie à cet appareil
 *   arrivent par le canal de session ; on les applique au lecteur d'Octave, par
 *   la traduction commune (`applySessionCommand`). Face à un serveur d'avant
 *   aussi : Jellyfin relaie déjà ses commandes.
 * - La DÉCLARATION : ce qui joue est dit au serveur (`playback:declare`) — un
 *   titre de la bibliothèque y gagne sa position à la seconde et la commande
 *   vise CE lecteur ; une lecture d'extension, que Jellyfin ne voit pas, y
 *   paraît. Seulement face à un serveur qui déclare `sessions.musicControl`.
 */

import { applySessionCommand, declarePlayback, onSessionCommand, type SessionRemoteTarget } from "@tentacle-tv/api-client";
import { declaredPlaybackOf, shouldRedeclare, DECLARE_HEARTBEAT_MS, type LastDeclared, type OctavePlayer } from "@tentacle-tv/shared/octave";

function remoteTarget(player: OctavePlayer): SessionRemoteTarget {
  return {
    stop: () => player.stop(),
    pause: () => player.pause(),
    play: () => player.resume(),
    isPaused: () => !player.snapshot.get().wantsPlay,
    seekTo: (seconds) => player.seek(seconds * 1_000),
    positionSeconds: () => player.position.get().positionMs / 1_000,
    next: () => player.next(),
    previous: () => player.previous(),
  };
}

/** Branche la télécommande et la déclaration sur ce lecteur ; renvoie le débranchement. */
export function attachSessionRemote(player: OctavePlayer, declares: () => boolean, now: () => number = Date.now): () => void {
  const target = remoteTarget(player);
  // Rien en cours : une commande de l'appareil ne réveille pas une file arrêtée.
  const offCommand = onSessionCommand((command) => {
    if (player.snapshot.get().current !== null) applySessionCommand(target, command);
  });

  let last: LastDeclared | null = null;
  const current = () => (declares() ? declaredPlaybackOf(player.snapshot.get(), player.position.get()) : null);
  const sync = () => {
    const next = current();
    const at = now();
    if (!shouldRedeclare(last, next, at)) return;
    // Socket fermé : rien n'est retenu, la réouverture redit l'état du moment.
    if (declarePlayback(next, next === null ? null : current)) last = { state: next, at };
  };

  const offSnapshot = player.snapshot.subscribe(sync);
  const offPosition = player.position.subscribe(sync);
  const heartbeat = setInterval(sync, DECLARE_HEARTBEAT_MS);
  sync();
  return () => {
    offCommand();
    offSnapshot();
    offPosition();
    clearInterval(heartbeat);
    if (last?.state) declarePlayback(null, null);
  };
}
