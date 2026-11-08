import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideKeepalive, KEEPALIVE_SILENCE_MS, startKeepalive } from "./wsKeepalive";

/** Une socket de banc : compte les pings, répond (ou non) comme un client. */
class FakeSocket extends EventEmitter {
  readyState = 1;
  pings: number[] = [];
  terminatedAt: number | null = null;
  /** Le client répond aux pings protocolaires (navigateur, OkHttp, SocketRocket). */
  answersPings = true;

  ping(): void {
    this.pings.push(Date.now());
    if (this.answersPings) setTimeout(() => this.emit("pong"), 80);
  }

  terminate(): void {
    this.terminatedAt = Date.now();
    this.readyState = 3;
  }
}

const START = 1_000_000;

describe("battement d'une socket : la décision d'un tour", () => {
  it("entendue il y a moins de 35 s : rien", () => {
    expect(decideKeepalive({ heardAt: 0, awaitingPong: false }, KEEPALIVE_SILENCE_MS - 1, false)).toBe("wait");
  });
  it("muette 35 s : un ping", () => {
    expect(decideKeepalive({ heardAt: 0, awaitingPong: false }, KEEPALIVE_SILENCE_MS, false)).toBe("ping");
  });
  it("un ping resté sans réponse un tour : fermée", () => {
    expect(decideKeepalive({ heardAt: 0, awaitingPong: true }, 1, false)).toBe("terminate");
  });
  it("membre d'une séance Watch Together : un ping à chaque tour, comme avant", () => {
    expect(decideKeepalive({ heardAt: 0, awaitingPong: false }, 1, true)).toBe("ping");
  });
});

describe("battement d'une socket : dans le temps (horloge simulée)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(START);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("un client qui pinge toutes les 30 s n'est jamais sondé (5 min) : le serveur ne réveille plus le téléphone", () => {
    const socket = new FakeSocket();
    startKeepalive(socket, () => false);
    const clientPing = setInterval(() => socket.emit("message"), 30_000);
    vi.advanceTimersByTime(5 * 60_000);
    clearInterval(clientPing);
    expect(socket.pings).toEqual([]);
    expect(socket.terminatedAt).toBeNull();
  });

  it("un client muet qui répond aux pings (JS gelé derrière) : sondé toutes les ~40 s, jamais fermé", () => {
    const socket = new FakeSocket();
    startKeepalive(socket, () => false);
    vi.advanceTimersByTime(5 * 60_000);
    expect(socket.terminatedAt).toBeNull();
    // 5 min : un ping par 40 s (35 s de silence, au grain de 10 s) — 7, au lieu de 30 avant.
    expect(socket.pings).toHaveLength(7);
    const gaps = socket.pings.slice(1).map((at, i) => at - socket.pings[i]);
    for (const gap of gaps) expect(gap).toBeLessThan(60_000); // sous l'inactivité d'un Nginx par défaut
  });

  it("un client qui disparaît (plus rien, ni message ni pong) est fermé en 55 s au plus", () => {
    for (const lastWordAfter of [0, 1, 4_999, 5_000, 9_999]) {
      vi.setSystemTime(START);
      const socket = new FakeSocket();
      startKeepalive(socket, () => false);
      const clientPing = setInterval(() => socket.emit("message"), 30_000);
      vi.advanceTimersByTime(60_000 + lastWordAfter);
      socket.emit("message"); // dernier mot
      const lastWord = Date.now();
      clearInterval(clientPing);
      socket.answersPings = false;
      vi.advanceTimersByTime(120_000);
      expect(socket.terminatedAt).not.toBeNull();
      expect(socket.terminatedAt! - lastWord).toBeLessThanOrEqual(55_000);
      expect(socket.terminatedAt! - lastWord).toBeGreaterThanOrEqual(KEEPALIVE_SILENCE_MS);
    }
  });

  it("Watch Together : un ping par tour (10 s), fermée au premier pong manqué (≤ 20 s), comme en 1.42.0", () => {
    const socket = new FakeSocket();
    startKeepalive(socket, () => true);
    vi.advanceTimersByTime(60_000);
    expect(socket.pings).toHaveLength(6);
    socket.answersPings = false;
    const lost = Date.now();
    vi.advanceTimersByTime(30_000);
    expect(socket.terminatedAt).not.toBeNull();
    expect(socket.terminatedAt! - lost).toBeLessThanOrEqual(20_000);
  });

  it("devenir membre d'une séance resserre aussitôt la cadence (relue à chaque tour)", () => {
    const socket = new FakeSocket();
    let inRoom = false;
    startKeepalive(socket, () => inRoom);
    const clientPing = setInterval(() => socket.emit("message"), 30_000);
    vi.advanceTimersByTime(60_000);
    expect(socket.pings).toHaveLength(0);
    inRoom = true;
    vi.advanceTimersByTime(30_000);
    clearInterval(clientPing);
    expect(socket.pings).toHaveLength(3);
  });

  it("socket fermée entre-temps : aucun ping ; l'arrêt retire minuteur et écouteurs", () => {
    const socket = new FakeSocket();
    const stop = startKeepalive(socket, () => true);
    socket.readyState = 2;
    vi.advanceTimersByTime(30_000);
    expect(socket.pings).toEqual([]);
    stop();
    expect(socket.listenerCount("pong")).toBe(0);
    expect(socket.listenerCount("message")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
