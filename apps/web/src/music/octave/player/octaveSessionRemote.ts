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

export interface SessionRemote {
  /** Redit l'écoute si elle a changé — la capacité du serveur vient d'être connue, par exemple. */
  resync: () => void;
  detach: () => void;
}

/**
 * Branche la télécommande et la déclaration sur ce lecteur.
 *
 * La page qui PART (fermeture, rechargement : `pagehide`) dit l'arrêt de ce
 * qu'elle jouait — à Jellyfin pour un titre de la bibliothèque (le rapport part
 * en `keepalive`), au serveur pour la déclaration — sans toucher au lecteur : la
 * page suivante reprend en pause (D6), et une page restaurée du cache de
 * navigation (`pageshow`) se redéclare. Sans cela, l'ancienne page gardait un
 * moment sa connexion et l'écoute restait « en lecture » dans l'administration.
 */
export function attachSessionRemote(player: OctavePlayer, declares: () => boolean, now: () => number = Date.now): SessionRemote {
  const target = remoteTarget(player);
  // Rien en cours : une commande de l'appareil ne réveille pas une file arrêtée.
  const offCommand = onSessionCommand((command) => {
    if (player.snapshot.get().current !== null) applySessionCommand(target, command);
  });

  let last: LastDeclared | null = null;
  let departed = false;
  const current = () => (declares() ? declaredPlaybackOf(player.snapshot.get(), player.position.get()) : null);
  const sync = () => {
    if (departed) return;
    const next = current();
    const at = now();
    if (!shouldRedeclare(last, next, at)) return;
    // Socket fermé : rien n'est retenu, la réouverture redit l'état du moment.
    if (declarePlayback(next, next === null ? null : current)) last = { state: next, at };
  };

  const onPageHide = () => {
    departed = true;
    const { positionMs, durationMs } = player.position.get();
    player.deps.reporter.stopped(positionMs, durationMs);
    // Un serveur d'avant `sessions.musicControl` ne reçoit jamais de déclaration.
    if (declares()) declarePlayback(null, null);
    last = { state: null, at: now() };
  };
  const onPageShow = (event: PageTransitionEvent) => {
    if (!event.persisted) return;
    departed = false;
    last = null;
    sync();
  };

  const offSnapshot = player.snapshot.subscribe(sync);
  const offPosition = player.position.subscribe(sync);
  const heartbeat = setInterval(sync, DECLARE_HEARTBEAT_MS);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("pageshow", onPageShow);
  sync();
  return {
    resync: sync,
    detach: () => {
      offCommand();
      offSnapshot();
      offPosition();
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      if (last?.state) declarePlayback(null, null);
    },
  };
}
