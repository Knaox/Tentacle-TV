import type { WebSocket } from "@fastify/websocket";
import { chooseSessionToken, WS_COOKIE_FALLBACK_MS } from "../services/sessionTokenChoice";
import { bindSocketSession, checkSocketToken, type BoundSession } from "./wsSessionAuth";

/**
 * Quelle session tient une socket : le cookie de la poignée de main, ou le
 * message `auth` du client (mobile, TV, bureau ; la page web l'envoie aussi,
 * avec le même jeton que son cookie).
 *
 * - Un navigateur, ou une session posée par le serveur dans le cookie : le
 *   cookie authentifie AUSSITÔT (`cookieAtOnce`).
 * - Une app native : le cookie de CONNEXION de son pot (celui de
 *   `/api/auth/login` : le compte de l'appareil) n'est qu'un REPLI, au bout de
 *   `WS_COOKIE_FALLBACK_MS`, pour un client qui ne s'annoncerait pas.
 *
 * Dans les deux cas, le message `auth` l'emporte sur un cookie de connexion
 * (cf. `sessionTokenChoice`), même arrivé après coup : la socket quitte alors
 * la session du cookie pour la sienne. Sans quoi la session de profil d'un
 * téléphone parlait au nom de son compte (alpha mobile, 20/10). Le premier
 * message `auth` fait foi, comme avant.
 */

/** Une socket qui ne s'est toujours pas annoncée est fermée. */
export const AUTH_TIMEOUT_MS = 15_000;

export interface SocketAnnouncement {
  /** Le message `auth` du client. */
  announce(token: string): void;
  /** La socket est fermée : plus rien ne s'y lie. */
  dispose(): void;
}

export function createSocketAnnouncement(deps: {
  socket: WebSocket;
  /** Le cookie de session de la poignée de main, s'il y en a un. */
  cookie: string | undefined;
  /** Le cookie authentifie aussitôt (navigateur, session posée par le serveur). */
  cookieAtOnce: boolean;
  /** La socket parle désormais au nom de cette session. */
  adopt: (session: BoundSession) => void;
  /** La session tenue jusqu'ici ne l'est plus (remplacée). */
  release: () => void;
}): SocketAnnouncement {
  const { socket, cookie } = deps;
  /** Chaque jeton tenté a son numéro : un verdict dépassé ne lie ni ne ferme rien. */
  let attempt = 0;
  /** Le jeton tenu ou en cours de vérification. */
  let current: string | null = null;
  let announced = false;
  let adopted = false;
  let disposed = false;

  const authTimeout = setTimeout(() => {
    if (adopted || disposed) return;
    socket.send(JSON.stringify({ type: "auth_error", reason: "timeout" }));
    socket.close(4001, "Auth timeout");
  }, AUTH_TIMEOUT_MS);
  const fallback = cookie && !deps.cookieAtOnce
    ? setTimeout(() => {
        if (current === null && !disposed) attach(cookie, true);
      }, WS_COOKIE_FALLBACK_MS)
    : null;

  function stopTimers(): void {
    clearTimeout(authTimeout);
    if (fallback) clearTimeout(fallback);
  }

  /** `quiet` : le repli sur le cookie d'une app native — refusé, il ne ferme
   *  rien, la socket attend toujours le message du client. */
  function attach(token: string, quiet: boolean): void {
    const mine = ++attempt;
    current = token;
    if (adopted) {
      adopted = false;
      deps.release();
    }
    void checkSocketToken(token).then((check) => {
      if (mine !== attempt || disposed) return;
      if (!check.ok) {
        if (quiet) {
          current = null;
          return;
        }
        stopTimers();
        check.refuse(socket);
        return;
      }
      stopTimers();
      adopted = true;
      bindSocketSession(socket, check.session);
      deps.adopt(check.session);
    });
  }

  if (cookie && deps.cookieAtOnce) attach(cookie, false);

  return {
    announce(token) {
      if (announced || disposed) return;
      announced = true;
      // Le client s'est annoncé : le verdict sur son jeton décide, sans délai.
      clearTimeout(authTimeout);
      if (fallback) clearTimeout(fallback);
      const chosen = chooseSessionToken(cookie, token) ?? token;
      // Déjà tenu (le cookie portait ce même jeton) : rien à refaire. En cours de
      // vérification : vérifié de nouveau — et un refus est dit, cette fois.
      if (!(adopted && chosen === current)) attach(chosen, false);
    },
    dispose() {
      disposed = true;
      attempt += 1;
      stopTimers();
    },
  };
}
