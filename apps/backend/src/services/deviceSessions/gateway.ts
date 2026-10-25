import { getJellyfinUrl } from "../configStore";
import { jellyfinHealth, onJellyfinHealth } from "../jellyfinHealth";
import { DeviceSocket } from "./deviceSocket";
import { DEVICE_CAPABILITIES, jellyfinCaller } from "./jellyfinCalls";
import { PlaybackReporter } from "./playbackReporter";
import { parseSessionMessage } from "./protocolParse";
import { SessionRegistry, type ChannelConnection, type ConnectionView } from "./registry";
import { resolveDeviceAuth } from "./tokenResolver";
import { DeclaredPlaybacks, type DeclaredEntry } from "./declaredPlayback";
import type { DeclaredPlaybackDto, SessionPlaystateCommandDto } from "./protocolMessages";
import { relayLibraryChanged, relayUserDataChanged } from "../jellyfinUserEvents";

/**
 * Le canal de session, branché : le registre et ses vraies dépendances, et ce
 * que `routes/ws.ts` appelle. Voir `registry.ts` pour la mécanique.
 *
 * `TENTACLE_SESSION_CHANNEL=off` coupe le canal : chaque lecteur reçoit
 * `reporting: false` et garde ses reports HTTP, comme avant.
 */

const declared = new DeclaredPlaybacks();

const registry = new SessionRegistry({
  enabled: () => process.env.TENTACLE_SESSION_CHANNEL !== "off",
  resolveAuth: (_conn, authToken, hello) => resolveDeviceAuth(authToken, hello),
  createDevice: (auth, handlers) =>
    new DeviceSocket({
      baseUrl: getJellyfinUrl,
      auth,
      postCapabilities: () => jellyfinCaller(auth).post("/Sessions/Capabilities/Full", DEVICE_CAPABILITIES),
      onOpen: handlers.onOpen,
      onLost: handlers.onLost,
      onPlaystate: handlers.onPlaystate,
      onGeneralCommand: handlers.onGeneralCommand,
      // Les ajouts et les « vu » du compte, en direct (cf. `jellyfinUserEvents.ts`).
      onAccountEvent: (type, data) => (type === "LibraryChanged" ? relayLibraryChanged(data) : relayUserDataChanged(data)),
    }),
  createReporter: (auth) => new PlaybackReporter(jellyfinCaller(auth)),
  jellyfinHealth,
  declares: (conn) => declared.of(conn) !== null,
});

// Les lecteurs apprennent chaque changement ; au retour, les connexions des
// appareils rouvrent sans attendre, et leurs reports repartent.
onJellyfinHealth((next, previous) => {
  registry.jellyfinChanged(next.state, next.since);
  if (next.state === "up" && previous.state !== "up") registry.jellyfinBack();
});

export type { ChannelConnection, ConnectionView };

/** Un message `session:*` / `playback:*` d'une connexion authentifiée. */
export function handleSessionMessage(conn: ChannelConnection, authToken: string, raw: unknown): void {
  const msg = parseSessionMessage(raw);
  if (msg === null) return;
  switch (msg.type) {
    case "session:hello":
      void registry.hello(conn, authToken, {
        deviceId: msg.deviceId,
        client: msg.client,
        device: msg.device,
        appVersion: msg.appVersion,
      });
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
    case "playback:declare":
      declared.declare(conn, msg.state);
      break;
  }
}

/** La connexion `/api/ws` s'est fermée. */
export function handleSessionClosed(conn: ChannelConnection): void {
  declared.forget(conn);
  registry.closed(conn);
}

/** Un appareil jumelé révoqué : sa session Jellyfin s'arrête et se ferme,
 *  sans délai de grâce (`registry.end`). */
export function endPairedDeviceSessions(jellyfinDeviceId: string): Promise<void> {
  return registry.end(jellyfinDeviceId);
}

/** Les connexions rattachées, pour le tableau de bord. */
export function sessionConnections(): ConnectionView[] {
  return registry.list();
}

/** Une écoute déclarée, telle que le tableau de bord la voit. */
export interface DeclaredPlaybackView extends DeclaredEntry {
  userId: string;
  username: string;
  deviceId: string | undefined;
}

/** Les écoutes déclarées (`playback:declare`), pour le tableau de bord. */
export function declaredPlaybacks(): DeclaredPlaybackView[] {
  return declared.entries().map(([conn, entry]) => ({
    ...entry,
    userId: conn.userId,
    username: conn.username,
    deviceId: registry.deviceIdOf(conn),
  }));
}

/**
 * Une commande du tableau de bord pour une lecture d'EXTENSION : Jellyfin ne
 * la connaît pas, elle part par le canal, au lecteur qui l'a déclarée. Faux si
 * cette lecture n'existe plus.
 */
export function commandDeclaredPlayback(id: string, command: SessionPlaystateCommandDto): boolean {
  const conn = declared.connectionOf(id);
  if (conn === null) return false;
  conn.send({ type: "session:command", command });
  return true;
}

export type { DeclaredPlaybackDto };
