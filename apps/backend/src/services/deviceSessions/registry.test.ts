import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JellyfinCaller } from "./jellyfinCalls";
import { PlaybackReporter } from "./playbackReporter";
import type { PlaybackStateDto, SessionServerMessage } from "./protocolMessages";
import {
  generalMessage,
  RECONNECT_GRACE_MS,
  SessionRegistry,
  type ChannelConnection,
  type DeviceHandlers,
  type DeviceLink,
} from "./registry";

/**
 * Le registre : une connexion Jellyfin par jeton, l'arrêt AVANT la fermeture
 * quand le lecteur disparaît, la grâce d'une reconnexion, et les commandes de
 * Jellyfin dirigées vers le lecteur qui lit.
 */

interface FakeDevice extends DeviceLink {
  token: string;
  handlers: DeviceHandlers;
  live: boolean;
  closed: boolean;
}

function harness(opts: { token?: string | null; enabled?: boolean } = {}) {
  const log: string[] = [];
  const devices: FakeDevice[] = [];
  const caller = (token: string): JellyfinCaller => ({
    post: (path) => {
      log.push(`${token} ${path}`);
      return Promise.resolve(true);
    },
  });
  const registry = new SessionRegistry({
    enabled: () => opts.enabled ?? true,
    resolveToken: (_conn, authToken) => Promise.resolve(opts.token === undefined ? authToken : opts.token),
    createDevice: (token, handlers) => {
      const device: FakeDevice = {
        token,
        handlers,
        live: false,
        closed: false,
        isLive() { return this.live; },
        open() { log.push(`${token} open`); },
        close() {
          this.closed = true;
          log.push(`${token} close`);
        },
      };
      devices.push(device);
      return device;
    },
    createReporter: (token) => new PlaybackReporter(caller(token)),
  });
  return { registry, log, devices };
}

function connection(userId = "u1"): ChannelConnection & { received: SessionServerMessage[] } {
  const received: SessionServerMessage[] = [];
  return { userId, username: userId, received, send: (msg) => received.push(msg) };
}

const STATE: PlaybackStateDto = {
  itemId: "item1",
  playSessionId: "ps1",
  playMethod: "DirectPlay",
  positionTicks: 0,
  isPaused: false,
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SessionRegistry — rattachement", () => {
  it("hello : une connexion Jellyfin par jeton, partagée entre onglets", async () => {
    const { registry, devices } = harness();
    const a = connection();
    const b = connection();
    await registry.hello(a, "jeton");
    await registry.hello(b, "jeton");
    expect(devices).toHaveLength(1);
    expect(a.received).toEqual([{ type: "session:ready", reporting: true, remoteControl: false }]);
  });

  it("sans jeton Jellyfin (ou canal coupé), le lecteur garde ses reports HTTP", async () => {
    const none = harness({ token: null });
    const c = connection();
    await none.registry.hello(c, "jwt");
    expect(c.received).toEqual([{ type: "session:ready", reporting: false, remoteControl: false }]);
    const off = harness({ enabled: false });
    const d = connection();
    await off.registry.hello(d, "jeton");
    expect(d.received).toEqual([{ type: "session:ready", reporting: false, remoteControl: false }]);
    expect(off.devices).toHaveLength(0);
  });

  it("la télécommande est annoncée quand la connexion Jellyfin s'ouvre, et perdue avec elle", async () => {
    const { registry, devices } = harness();
    const c = connection();
    await registry.hello(c, "jeton");
    devices[0]?.handlers.onOpen();
    devices[0]?.handlers.onLost();
    expect(c.received.slice(1)).toEqual([
      { type: "session:ready", reporting: true, remoteControl: true },
      { type: "session:ready", reporting: true, remoteControl: false },
    ]);
  });
});

describe("SessionRegistry — disparition d'un lecteur", () => {
  it("sans lecture, la connexion Jellyfin se ferme aussitôt", async () => {
    const { registry, devices } = harness();
    const c = connection();
    await registry.hello(c, "jeton");
    registry.closed(c);
    expect(devices[0]?.closed).toBe(true);
  });

  it("en lecture : l'arrêt part après la grâce, et la connexion ne se ferme qu'ENSUITE", async () => {
    const { registry, log, devices } = harness();
    const c = connection();
    await registry.hello(c, "jeton");
    await registry.start(c, STATE, false);
    registry.closed(c);
    expect(devices[0]?.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(RECONNECT_GRACE_MS);
    expect(log).toEqual(["jeton open", "jeton /Sessions/Playing", "jeton /Sessions/Playing/Stopped", "jeton close"]);
  });

  it("le lecteur revenu dans la grâce reprend sa lecture, sans arrêt ni nouveau début", async () => {
    const { registry, log, devices } = harness();
    const first = connection();
    await registry.hello(first, "jeton");
    await registry.start(first, STATE, false);
    registry.closed(first);
    const again = connection();
    await registry.hello(again, "jeton");
    await registry.start(again, { ...STATE, positionTicks: 50 }, true);
    await vi.advanceTimersByTimeAsync(RECONNECT_GRACE_MS * 2);
    expect(log).toEqual(["jeton open", "jeton /Sessions/Playing"]);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.closed).toBe(false);
  });

  it("l'arrêt explicite répond une fois Jellyfin servi", async () => {
    const { registry, log } = harness();
    const c = connection();
    await registry.hello(c, "jeton");
    await registry.start(c, STATE, false);
    await registry.stop(c, { ...STATE, positionTicks: 99 }, "r1");
    expect(log.at(-1)).toBe("jeton /Sessions/Playing/Stopped");
    expect(c.received.at(-1)).toEqual({ type: "playback:stopped", requestId: "r1", ok: true });
  });
});

describe("SessionRegistry — commandes de Jellyfin", () => {
  it("visent le lecteur qui lit, à défaut tous ceux de l'appareil", async () => {
    const { registry, devices } = harness();
    const idle = connection();
    const player = connection();
    await registry.hello(idle, "jeton");
    await registry.hello(player, "jeton");
    devices[0]?.handlers.onPlaystate("Pause");
    expect(idle.received.at(-1)).toEqual({ type: "session:command", command: "Pause", seekPositionTicks: undefined });
    await registry.start(player, STATE, false);
    idle.received.length = 0;
    devices[0]?.handlers.onPlaystate("Stop");
    expect(idle.received).toEqual([]);
    expect(player.received.at(-1)).toEqual({ type: "session:command", command: "Stop", seekPositionTicks: undefined });
  });

  it("DisplayMessage devient un message à afficher, borné", () => {
    expect(generalMessage("DisplayMessage", { Header: "Admin", Text: "Bonsoir", TimeoutMs: "5000" })).toEqual({
      type: "session:message", header: "Admin", text: "Bonsoir", timeoutMs: 5000,
    });
    expect(generalMessage("DisplayMessage", { Text: "x".repeat(5_000) })).toMatchObject({ header: "", text: "x".repeat(2_000) });
    expect(generalMessage("SetVolume", { Volume: "40" })).toEqual({ type: "session:general", name: "SetVolume", arguments: { Volume: "40" } });
  });

  it("une connexion Jellyfin qui RENAÎT redit l'état des lectures", async () => {
    const { registry, log, devices } = harness();
    const c = connection();
    await registry.hello(c, "jeton");
    await registry.start(c, STATE, false);
    devices[0]?.handlers.onOpen();
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toEqual(["jeton open", "jeton /Sessions/Playing"]);
    devices[0]?.handlers.onLost();
    devices[0]?.handlers.onOpen();
    await vi.advanceTimersByTimeAsync(0);
    expect(log.at(-1)).toBe("jeton /Sessions/Playing/Progress");
  });
});
