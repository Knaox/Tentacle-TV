import { describe, expect, it } from "vitest";
import { DECLARED_SESSION_PREFIX, DeclaredPlaybacks } from "./declaredPlayback";
import { PlaybackReporter } from "./playbackReporter";
import type { DeclaredPlaybackDto, SessionServerMessage } from "./protocolMessages";
import { parseSessionMessage } from "./protocolParse";
import { SessionRegistry, type ChannelConnection, type DeviceHandlers } from "./registry";

/**
 * Les écoutes DÉCLARÉES par les lecteurs (`playback:declare` : la musique
 * d'Octave) — forme validée, une par connexion, et la commande de Jellyfin
 * qui vise le lecteur qui déclare.
 */

const LISTENING: DeclaredPlaybackDto = {
  key: "ext:extension:abc",
  title: "Titre hors bibliothèque",
  artists: "A, B",
  album: "Album",
  imageUrl: "/api/plugins/extension/art/abc",
  durationMs: 180_000,
  positionMs: 12_000,
  isPaused: false,
};

function connection(userId = "u1"): ChannelConnection & { received: SessionServerMessage[] } {
  const received: SessionServerMessage[] = [];
  return { userId, username: userId, received, send: (msg) => received.push(msg) };
}

describe("playback:declare — la forme reçue", () => {
  it("une écoute bien formée passe, position arrondie ; `null` l'efface", () => {
    expect(parseSessionMessage({ type: "playback:declare", state: { ...LISTENING, positionMs: 12_000.7 } }))
      .toEqual({ type: "playback:declare", state: { ...LISTENING, positionMs: 12_000 } });
    expect(parseSessionMessage({ type: "playback:declare", state: null })).toEqual({ type: "playback:declare", state: null });
  });

  it("une pochette hors de notre serveur et hors https, un titre vide, un texte démesuré : refusés", () => {
    for (const imageUrl of ["javascript:alert(1)", "data:image/png;base64,AA", "http://exemple.test/a.jpg", "//exemple.test/a.jpg", "/api/../setup", "/autre/chemin"]) {
      expect(parseSessionMessage({ type: "playback:declare", state: { ...LISTENING, imageUrl } })).toBeNull();
    }
    expect(parseSessionMessage({ type: "playback:declare", state: { ...LISTENING, imageUrl: "https://i.exemple.test/a.jpg" } })).not.toBeNull();
    expect(parseSessionMessage({ type: "playback:declare", state: { ...LISTENING, title: "  " } })).toBeNull();
    expect(parseSessionMessage({ type: "playback:declare", state: { ...LISTENING, album: "x".repeat(301) } })).toBeNull();
    expect(parseSessionMessage({ type: "playback:declare", state: { ...LISTENING, itemId: "pas un id !" } })).toBeNull();
  });
});

describe("DeclaredPlaybacks — une écoute par connexion", () => {
  it("l'identifiant reste le même d'un titre à l'autre, et ne dit rien de la connexion", () => {
    const store = new DeclaredPlaybacks();
    const conn = connection();
    store.declare(conn, LISTENING, 1_000);
    const id = store.of(conn)?.id;
    expect(id?.startsWith(DECLARED_SESSION_PREFIX)).toBe(true);
    store.declare(conn, { ...LISTENING, key: "ext:extension:def", title: "Suivant" }, 2_000);
    expect(store.of(conn)).toMatchObject({ id, at: 2_000, state: { title: "Suivant" } });
    expect(store.connectionOf(id!)).toBe(conn);
  });

  it("`null` ou la connexion fermée l'effacent", () => {
    const store = new DeclaredPlaybacks();
    const a = connection();
    const b = connection("u2");
    store.declare(a, LISTENING);
    store.declare(b, LISTENING);
    store.declare(a, null);
    store.forget(b);
    expect(store.entries()).toEqual([]);
  });
});

describe("SessionRegistry — une commande vise le lecteur qui déclare son écoute", () => {
  it("deux onglets du même navigateur : seul celui qui écoute reçoit la pause", async () => {
    const declared = new DeclaredPlaybacks();
    let handlers: DeviceHandlers | null = null;
    const registry = new SessionRegistry({
      enabled: () => true,
      resolveAuth: () => Promise.resolve({ token: "jeton" }),
      createDevice: (_auth, h) => {
        handlers = h;
        return { isLive: () => true, open: () => undefined, close: () => undefined, reconnectNow: () => undefined };
      },
      createReporter: () => new PlaybackReporter({ post: () => Promise.resolve(true) }),
      jellyfinHealth: () => ({ state: "up", since: 0 }),
      declares: (conn) => declared.of(conn) !== null,
    });
    const films = connection();
    const octave = connection();
    await registry.hello(films, "jeton", { deviceId: "navigateur" });
    await registry.hello(octave, "jeton", { deviceId: "navigateur" });
    declared.declare(octave, { ...LISTENING, itemId: "item1" });
    films.received.length = 0;
    (handlers as DeviceHandlers | null)?.onPlaystate("Pause");
    expect(films.received).toEqual([]);
    expect(octave.received.at(-1)).toEqual({ type: "session:command", command: "Pause", seekPositionTicks: undefined });
    expect(registry.deviceIdOf(octave)).toBe("navigateur");
  });
});
