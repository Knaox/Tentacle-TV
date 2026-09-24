import { EventEmitter } from "events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceSocket, type DeviceSocketOptions, type SocketLike } from "./deviceSocket";

/**
 * La connexion Jellyfin d'un appareil : l'en-tête ne porte que le jeton, les
 * capacités partent avant d'annoncer la télécommande, les commandes de
 * Jellyfin sont relayées (et elles seules), et une connexion perdue se
 * rouvre — sauf fermeture délibérée.
 */

class FakeSocket extends EventEmitter implements SocketLike {
  readyState = 0;
  sent: string[] = [];
  closedByUs = false;
  constructor(readonly url: string, readonly headers: Record<string, string>) {
    super();
  }
  send(data: string): void {
    this.sent.push(data);
  }
  ping(): void {}
  terminate(): void {
    this.readyState = 3;
    this.emit("close");
  }
  close(): void {
    this.closedByUs = true;
    this.readyState = 3;
    this.emit("close");
  }
  accept(): void {
    this.readyState = 1;
    this.emit("open");
  }
  push(message: unknown): void {
    this.emit("message", Buffer.from(JSON.stringify(message)));
  }
}

let sockets: FakeSocket[] = [];

function setup(overrides: Partial<DeviceSocketOptions> = {}) {
  const events = {
    open: vi.fn(),
    lost: vi.fn(),
    playstate: vi.fn(),
    general: vi.fn(),
    capabilities: vi.fn(() => Promise.resolve(true)),
  };
  const device = new DeviceSocket({
    baseUrl: () => "http://jellyfin:8096",
    auth: { token: "jeton" },
    postCapabilities: events.capabilities,
    onOpen: events.open,
    onLost: events.lost,
    onPlaystate: events.playstate,
    onGeneralCommand: events.general,
    createSocket: (url, headers) => {
      const s = new FakeSocket(url, headers);
      sockets.push(s);
      return s;
    },
    ...overrides,
  });
  return { device, events };
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe("DeviceSocket", () => {
  it("se présente au /socket de Jellyfin avec le seul jeton", () => {
    const { device } = setup();
    device.open();
    expect(sockets[0]?.url).toBe("ws://jellyfin:8096/socket");
    expect(sockets[0]?.headers).toEqual({ Authorization: 'MediaBrowser Token="jeton"' });
  });

  it("poste les capacités AVANT d'annoncer la télécommande", async () => {
    const { device, events } = setup();
    device.open();
    sockets[0]?.accept();
    expect(events.capabilities).toHaveBeenCalledTimes(1);
    expect(device.isLive()).toBe(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(events.open).toHaveBeenCalledTimes(1);
    expect(device.isLive()).toBe(true);
  });

  it("relaie les commandes de lecture et les commandes générales, rien d'autre", async () => {
    const { device, events } = setup();
    device.open();
    sockets[0]?.accept();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.push({ MessageType: "Playstate", Data: { Command: "Seek", SeekPositionTicks: 42 } });
    sockets[0]?.push({ MessageType: "Playstate", Data: { Command: "Formate" } });
    sockets[0]?.push({
      MessageType: "GeneralCommand",
      Data: { Name: "DisplayMessage", Arguments: { Header: "Admin", Text: "Bonsoir", TimeoutMs: 5000 } },
    });
    sockets[0]?.push({ MessageType: "UserDataChanged", Data: {} });
    expect(events.playstate.mock.calls).toEqual([["Seek", 42]]);
    expect(events.general.mock.calls).toEqual([["DisplayMessage", { Header: "Admin", Text: "Bonsoir", TimeoutMs: "5000" }]]);
  });

  it("répond au ForceKeepAlive, puis parle toutes les 30 s", async () => {
    const { device } = setup();
    device.open();
    const s = sockets[0];
    s?.accept();
    s?.push({ MessageType: "ForceKeepAlive", Data: 60 });
    expect(s?.sent).toEqual([JSON.stringify({ MessageType: "KeepAlive" })]);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(s?.sent).toHaveLength(2);
  });

  it("une connexion perdue se rouvre ; la télécommande est dite perdue entre-temps", async () => {
    const { device, events } = setup();
    device.open();
    sockets[0]?.accept();
    await vi.advanceTimersByTimeAsync(0);
    sockets[0]?.terminate();
    expect(events.lost).toHaveBeenCalledTimes(1);
    expect(device.isLive()).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
    sockets[1]?.accept();
    await vi.advanceTimersByTimeAsync(0);
    expect(events.open).toHaveBeenCalledTimes(2);
  });

  it("une socket muette est déclarée morte", async () => {
    const { device } = setup();
    device.open();
    sockets[0]?.accept();
    await vi.advanceTimersByTimeAsync(0);
    // Le temps de Date.now() avance avec les faux minuteurs.
    await vi.advanceTimersByTimeAsync(110_000);
    expect(sockets.length).toBeGreaterThan(1);
  });

  it("la fermeture délibérée ferme pour de bon", async () => {
    const { device } = setup();
    device.open();
    sockets[0]?.accept();
    await vi.advanceTimersByTimeAsync(0);
    device.close();
    expect(sockets[0]?.closedByUs).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });
});
