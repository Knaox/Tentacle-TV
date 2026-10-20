/**
 * Bascule de profil sur le mobile (retour de l'alpha, 21/10) : la salle créée
 * depuis un profil avait pour hôte le compte de connexion, et le profil
 * paraissait hors ligne — la socket et le REST de Watch Together gardaient le
 * jeton du compte. Après `switchWtSession`, tout parle au nom du profil, et
 * l'ancienne session a quitté sa salle avec SON jeton.
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
  sent: string[] = [];
  closed = false;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
}

interface Call {
  url: string;
  authorization: string | undefined;
}

let calls: Call[];
let api: typeof import("../../hooks/useWatchTogetherApi");
let socket: typeof import("../../socket/tentacleSocket");
let sessionSwitch: typeof import("./sessionSwitch");

function open(ws: FakeWebSocket): void {
  ws.readyState = FakeWebSocket.OPEN;
  ws.onopen?.();
  ws.onmessage?.({ data: JSON.stringify({ type: "auth_ok" }) });
}

beforeEach(async () => {
  calls = [];
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, authorization: (init.headers as Record<string, string>).Authorization });
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }));
  vi.resetModules();
  api = await import("../../hooks/useWatchTogetherApi");
  socket = await import("../../socket/tentacleSocket");
  sessionSwitch = await import("./sessionSwitch");
  api.setWatchTogetherBackendUrl("http://serveur.test");
  socket.setWsBackendUrl("http://serveur.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Watch Together suit la bascule de session", () => {
  it("compte → profil : l'ancienne session quitte sa salle, puis REST et socket parlent au nom du profil", async () => {
    api.setWatchTogetherToken("jeton-compte");
    const held = socket.acquireSocket("jeton-compte");
    const first = FakeWebSocket.instances[0];
    open(first);
    sessionSwitch.noteWtRoomHeld(true);

    sessionSwitch.switchWtSession("jeton-profil");

    expect(calls).toEqual([{ url: "http://serveur.test/api/watch-together/group/leave", authorization: "Bearer jeton-compte" }]);
    expect(first.closed).toBe(true);
    const second = FakeWebSocket.instances[1];
    expect(second).toBeDefined();
    open(second);
    expect(second.sent[0]).toBe(JSON.stringify({ type: "auth", token: "jeton-profil" }));

    await api.createGroup("film");
    expect(calls[1]).toEqual({ url: "http://serveur.test/api/watch-together/group", authorization: "Bearer jeton-profil" });
    held();
  });

  it("hors d'une salle : rien n'est quitté, la socket suit quand même", () => {
    api.setWatchTogetherToken("jeton-compte");
    const held = socket.acquireSocket("jeton-compte");
    open(FakeWebSocket.instances[0]);
    sessionSwitch.noteWtRoomHeld(false);

    sessionSwitch.switchWtSession("jeton-profil");

    expect(calls).toEqual([]);
    expect(FakeWebSocket.instances).toHaveLength(2);
    held();
  });

  it("une salle n'est quittée qu'une fois", () => {
    api.setWatchTogetherToken("jeton-a");
    sessionSwitch.noteWtRoomHeld(true);
    sessionSwitch.switchWtSession("jeton-b");
    sessionSwitch.switchWtSession("jeton-c");
    expect(calls.map((c) => c.authorization)).toEqual(["Bearer jeton-a"]);
  });
});
