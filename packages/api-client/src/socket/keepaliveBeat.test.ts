/**
 * Le battement du socket partagé : un par ping keepalive (30 s), aucun sans
 * socket ouvert ni pour un échantillon d'horloge — c'est sur lui que part le
 * rapport d'écoute d'Octave app derrière (`socketReportPacing.ts`).
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
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
  open(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
}

let socket: typeof import("./tentacleSocket");
let beats: typeof import("./keepaliveBeat");
let pacingModule: typeof import("../music/player/socketReportPacing");

beforeEach(async () => {
  vi.useFakeTimers();
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.resetModules();
  socket = await import("./tentacleSocket");
  beats = await import("./keepaliveBeat");
  pacingModule = await import("../music/player/socketReportPacing");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const pingsOf = (ws: FakeWebSocket) => ws.sent.filter((m) => JSON.parse(m).type === "ping").length;

describe("battement du socket partagé", () => {
  it("un battement par ping keepalive, toutes les 30 s, juste après l'envoi", () => {
    socket.setWsBackendUrl("http://backend.test");
    const release = socket.acquireSocket("jeton");
    const ws = FakeWebSocket.instances[0];
    ws.open();
    const pingsWhenBeating: number[] = [];
    beats.onKeepaliveBeat(() => pingsWhenBeating.push(pingsOf(ws)));
    vi.advanceTimersByTime(2 * 60_000);
    // Le premier ping de l'ouverture (horloge) n'est pas un battement ; puis un par 30 s.
    expect(pingsWhenBeating).toEqual([2, 3, 4, 5]);
    release();
  });

  it("aucun battement sans socket ouvert", () => {
    socket.setWsBackendUrl("http://backend.test");
    const release = socket.acquireSocket("jeton");
    const ws = FakeWebSocket.instances[0];
    ws.open();
    const heard = vi.fn();
    beats.onKeepaliveBeat(heard);
    ws.readyState = 3; // tombé sans que onclose ait encore suivi
    vi.advanceTimersByTime(60_000);
    expect(heard).not.toHaveBeenCalled();
    release();
  });

  it("le rythme d'Octave relaie le battement au rapporteur, et plus rien une fois rendu", () => {
    const pacing = pacingModule.socketReportPacing(() => true);
    expect(pacing.pacing.background?.()).toBe(true);
    const reporterBeat = vi.fn();
    pacing.pacing.onBeat?.(reporterBeat);
    beats.emitKeepaliveBeat();
    expect(reporterBeat).toHaveBeenCalledTimes(1);
    pacing.dispose();
    beats.emitKeepaliveBeat();
    expect(reporterBeat).toHaveBeenCalledTimes(1);
  });
});
