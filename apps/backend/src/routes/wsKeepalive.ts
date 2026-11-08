/**
 * Le battement d'une socket `/api/ws`, vu du serveur : savoir qu'un client a
 * disparu sans réveiller pour rien le modem de ceux qui vivent.
 *
 * Avant (1.42.0) : un ping protocolaire toutes les 10 s à CHAQUE socket. Un
 * téléphone qui écoute Octave écran éteint était réveillé six fois par minute
 * par le serveur seul — en 4G/5G, le modem ne s'endormait jamais. Or tout
 * client Tentacle pinge déjà de lui-même toutes les 30 s
 * (`packages/api-client/src/socket/tentacleSocket.ts`) : un client qui parle
 * est vivant, inutile de le sonder.
 *
 * Désormais, à chaque tour d'un minuteur LOCAL (10 s, aucun octet envoyé) :
 * - une socket entendue depuis moins de 35 s (message, pong) : rien ;
 * - restée muette 35 s : un ping protocolaire (un navigateur, OkHttp,
 *   SocketRocket y répondent d'eux-mêmes, JavaScript endormi compris) ;
 * - ping resté sans réponse au tour suivant : fermée d'office.
 * Socket morte constatée en 55 s au plus (35 + 10 de grain + 10 de réponse) ;
 * 20 s avant. Un client vivant n'est plus jamais sondé ; un client muet
 * (JavaScript gelé derrière sur Android, client d'avant) l'est toutes les
 * ~40 s, ce qui garde aussi le trafic sous les 60 s d'inactivité d'un
 * mandataire Nginx réglé par défaut.
 *
 * WATCH TOGETHER garde la cadence d'avant (`urgent`) : la socket d'un compte
 * membre d'une séance est sondée à chaque tour et fermée au premier pong
 * manqué (≤ 20 s) — une salle ne doit pas attendre un lecteur disparu
 * (barrière, arrivée, présence, grâce par appareil : `watchTogether/`).
 */

/** Le tour du minuteur local. */
export const KEEPALIVE_TICK_MS = 10_000;
/** Silence au-delà duquel une socket est sondée (le client pinge toutes les 30 s ; 5 s de marge). */
export const KEEPALIVE_SILENCE_MS = 35_000;

/** Ce qu'il faut savoir d'une socket entre deux tours. */
export interface KeepaliveState {
  /** Dernier signe de vie (message reçu, pong). */
  heardAt: number;
  /** Un ping protocolaire attend sa réponse depuis le tour précédent. */
  awaitingPong: boolean;
}

export type KeepaliveAction = "wait" | "ping" | "terminate";

/** La décision d'un tour. `urgent` : compte membre d'une séance Watch Together. */
export function decideKeepalive(state: KeepaliveState, now: number, urgent: boolean): KeepaliveAction {
  // Un tour entier sans réponse au ping, ni message : la socket est morte.
  if (state.awaitingPong) return "terminate";
  if (urgent) return "ping";
  return now - state.heardAt >= KEEPALIVE_SILENCE_MS ? "ping" : "wait";
}

/** La part d'une socket `ws` que le battement emploie. */
export interface KeepaliveSocket {
  readonly readyState: number;
  ping(): void;
  terminate(): void;
  on(event: "pong" | "message", listener: () => void): unknown;
  off(event: "pong" | "message", listener: () => void): unknown;
}

const OPEN = 1;

/** Pose le battement d'une socket authentifiée ; rend son arrêt. */
export function startKeepalive(socket: KeepaliveSocket, urgent: () => boolean, now: () => number = Date.now): () => void {
  const state: KeepaliveState = { heardAt: now(), awaitingPong: false };
  const heard = (): void => {
    state.heardAt = now();
    state.awaitingPong = false;
  };
  socket.on("pong", heard);
  socket.on("message", heard);
  const timer = setInterval(() => {
    if (socket.readyState !== OPEN) return;
    const action = decideKeepalive(state, now(), urgent());
    if (action === "terminate") socket.terminate();
    else if (action === "ping") {
      state.awaitingPong = true;
      socket.ping();
    }
  }, KEEPALIVE_TICK_MS);
  return () => {
    clearInterval(timer);
    socket.off("pong", heard);
    socket.off("message", heard);
  };
}
