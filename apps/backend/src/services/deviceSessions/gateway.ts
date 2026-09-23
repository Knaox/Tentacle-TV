import { getJellyfinUrl } from "../configStore";
import { DeviceSocket } from "./deviceSocket";
import { DEVICE_CAPABILITIES, jellyfinCaller } from "./jellyfinCalls";
import { PlaybackReporter } from "./playbackReporter";
import { parseSessionMessage } from "./protocolParse";
import { SessionRegistry, type ChannelConnection, type ConnectionView } from "./registry";
import { resolveJellyfinToken } from "./tokenResolver";

/**
 * Le canal de session, branché : le registre et ses vraies dépendances, et ce
 * que `routes/ws.ts` appelle. Voir `registry.ts` pour la mécanique.
 *
 * `TENTACLE_SESSION_CHANNEL=off` coupe le canal : chaque lecteur reçoit
 * `reporting: false` et garde ses reports HTTP, comme avant.
 */

const registry = new SessionRegistry({
  enabled: () => process.env.TENTACLE_SESSION_CHANNEL !== "off",
  resolveToken: (_conn, authToken) => resolveJellyfinToken(authToken),
  createDevice: (token, handlers) =>
    new DeviceSocket({
      baseUrl: getJellyfinUrl,
      token,
      postCapabilities: () => jellyfinCaller(token).post("/Sessions/Capabilities/Full", DEVICE_CAPABILITIES),
      onOpen: handlers.onOpen,
      onLost: handlers.onLost,
      onPlaystate: handlers.onPlaystate,
      onGeneralCommand: handlers.onGeneralCommand,
    }),
  createReporter: (token) => new PlaybackReporter(jellyfinCaller(token)),
});

export type { ChannelConnection, ConnectionView };

/** Un message `session:*` / `playback:*` d'une connexion authentifiée. */
export function handleSessionMessage(conn: ChannelConnection, authToken: string, raw: unknown): void {
  const msg = parseSessionMessage(raw);
  if (msg === null) return;
  switch (msg.type) {
    case "session:hello":
      void registry.hello(conn, authToken, msg.deviceId);
      break;
    case "playback:start":
      void registry.start(conn, msg.state, msg.resumed ?? false);
      break;
    case "playback:progress":
      registry.progress(conn, msg.event, msg.state);
      break;
    case "playback:stop":
      void registry.stop(conn, msg.state, msg.requestId);
      break;
  }
}

/** La connexion `/api/ws` s'est fermée. */
export function handleSessionClosed(conn: ChannelConnection): void {
  registry.closed(conn);
}

/** Les connexions rattachées, pour le tableau de bord. */
export function sessionConnections(): ConnectionView[] {
  return registry.list();
}
