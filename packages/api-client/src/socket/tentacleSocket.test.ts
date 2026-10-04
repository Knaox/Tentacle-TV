/**
 * Le socket partagé se connecte dès que l'URL du backend est connue, même si
 * l'acquisition l'a précédée (démarrage à froid : l'écran monte avant le
 * fournisseur qui pose l'URL) — sans cela, aucun socket de toute la vie de
 * l'app. Une acquisition faite après l'URL se connecte tout de suite.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  sent: string[] = [];
  closed = false;
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
}

type SocketModule = typeof import("./tentacleSocket");
let socket: SocketModule;

beforeEach(async () => {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.resetModules();
  socket = await import("./tentacleSocket");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tentacleSocket", () => {
  it("attend l'URL du backend, puis se connecte dès qu'elle est posée", () => {
    const release = socket.acquireSocket("jeton");
    expect(FakeWebSocket.instances).toHaveLength(0);
    socket.setWsBackendUrl("http://backend.test/");
    expect(FakeWebSocket.instances.map((w) => w.url)).toEqual(["ws://backend.test/api/ws"]);
    release();
  });

  it("se connecte tout de suite quand l'URL est déjà connue, une seule fois pour deux acquisitions", () => {
    socket.setWsBackendUrl("https://backend.test");
    const a = socket.acquireSocket("jeton");
    const b = socket.acquireSocket("jeton");
    expect(FakeWebSocket.instances.map((w) => w.url)).toEqual(["wss://backend.test/api/ws"]);
    a();
    b();
  });

  it("ne connecte rien sans acquisition", () => {
    socket.setWsBackendUrl("http://backend.test");
    expect(FakeWebSocket.instances).toHaveLength(0);
  });

  it("une session qui change ferme la connexion de l'ancien jeton, et la suivante présente le nouveau", () => {
    socket.setWsBackendUrl("http://backend.test");
    const before = socket.acquireSocket("jeton-profil-a");
    const first = FakeWebSocket.instances[0];
    first.readyState = FakeWebSocket.OPEN;
    first.onopen?.();
    expect(first.sent[0]).toBe(JSON.stringify({ type: "auth", token: "jeton-profil-a" }));

    socket.resetSocketSession();
    expect(first.closed).toBe(true);
    expect(first.onclose).toBeNull();
    expect(socket.getSocketStatus()).toBe("idle");
    // Rien ne se reconnecte avec l'ancien jeton.
    expect(FakeWebSocket.instances).toHaveLength(1);

    before();
    const after = socket.acquireSocket("jeton-profil-b");
    const second = FakeWebSocket.instances[1];
    second.readyState = FakeWebSocket.OPEN;
    second.onopen?.();
    expect(second.sent[0]).toBe(JSON.stringify({ type: "auth", token: "jeton-profil-b" }));
    after();
  });
});
