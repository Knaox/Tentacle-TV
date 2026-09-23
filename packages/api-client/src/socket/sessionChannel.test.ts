/**
 * Le canal de session côté lecteur : il s'annonce à chaque authentification,
 * ne porte la télémétrie qu'une fois le backend d'accord, reprend une lecture
 * en cours quand il (re)devient disponible, et un arrêt sans confirmation
 * rend la main au HTTP.
 */

import type { WsClientMessage, WsServerMessage } from "@tentacle-tv/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const socket = vi.hoisted(() => ({
  sent: [] as unknown[],
  open: true,
  messageListener: null as ((msg: unknown) => void) | null,
  statusListener: null as ((s: string) => void) | null,
}));

vi.mock("./tentacleSocket", () => ({
  sendSocketMessage: (msg: WsClientMessage) => {
    if (!socket.open) return false;
    socket.sent.push(msg);
    return true;
  },
  subscribeSocket: (listener: (msg: unknown) => void) => {
    socket.messageListener = listener;
    return () => undefined;
  },
  onSocketStatus: (listener: (s: string) => void) => {
    socket.statusListener = listener;
    listener("idle");
    return () => undefined;
  },
}));

import {
  channelStart,
  channelStop,
  configureSessionChannel,
  isChannelReporting,
  onSessionCommand,
  onSessionMessage,
  setActivePlayback,
  clearActivePlayback,
} from "./sessionChannel";

const STATE = { itemId: "item1", playMethod: "DirectPlay" as const, positionTicks: 10, isPaused: false };

function server(msg: WsServerMessage): void {
  socket.messageListener?.(msg);
}

beforeEach(() => {
  socket.sent.length = 0;
  socket.open = true;
  configureSessionChannel({ deviceId: () => "appareil" });
  // Chaque test repart d'un socket fermé puis rouvert.
  socket.statusListener?.("closed");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("sessionChannel", () => {
  it("s'annonce à chaque authentification du socket", () => {
    socket.statusListener?.("open");
    expect(socket.sent).toEqual([{ type: "session:hello", version: 1, deviceId: "appareil" }]);
  });

  it("ne porte la télémétrie qu'après l'accord du backend", () => {
    socket.statusListener?.("open");
    expect(channelStart(STATE)).toBe(false);
    server({ type: "session:ready", reporting: true, remoteControl: false });
    expect(isChannelReporting()).toBe(true);
    expect(channelStart(STATE)).toBe(true);
    expect(socket.sent.at(-1)).toEqual({ type: "playback:start", state: STATE });
  });

  it("un backend qui refuse laisse les reports au HTTP", () => {
    socket.statusListener?.("open");
    server({ type: "session:ready", reporting: false, remoteControl: false });
    expect(channelStart(STATE)).toBe(false);
  });

  it("reprend la lecture en cours quand le canal (re)devient disponible", () => {
    const provider = () => STATE;
    setActivePlayback(provider);
    socket.statusListener?.("open");
    server({ type: "session:ready", reporting: true, remoteControl: true });
    expect(socket.sent.at(-1)).toEqual({ type: "playback:start", state: STATE, resumed: true });
    clearActivePlayback(provider);
  });

  it("un fournisseur remplacé n'est pas effacé par l'ancien lecteur", () => {
    const old = () => STATE;
    const current = () => ({ ...STATE, itemId: "item2" });
    setActivePlayback(old);
    setActivePlayback(current);
    clearActivePlayback(old);
    socket.statusListener?.("open");
    server({ type: "session:ready", reporting: true, remoteControl: false });
    expect(socket.sent.at(-1)).toMatchObject({ type: "playback:start", resumed: true, state: { itemId: "item2" } });
    clearActivePlayback(current);
  });

  it("l'arrêt se résout sur la confirmation du backend", async () => {
    socket.statusListener?.("open");
    server({ type: "session:ready", reporting: true, remoteControl: false });
    const stopped = channelStop(STATE);
    const sent = socket.sent.at(-1) as { type: string; requestId: string };
    expect(sent.type).toBe("playback:stop");
    server({ type: "playback:stopped", requestId: sent.requestId, ok: true });
    await expect(stopped).resolves.toBe(true);
  });

  it("sans confirmation à temps, ou socket tombé, l'arrêt rend la main au HTTP", async () => {
    vi.useFakeTimers();
    socket.statusListener?.("open");
    server({ type: "session:ready", reporting: true, remoteControl: false });
    const late = channelStop(STATE);
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(late).resolves.toBe(false);
    const cut = channelStop(STATE);
    socket.statusListener?.("closed");
    await expect(cut).resolves.toBe(false);
    expect(isChannelReporting()).toBe(false);
  });

  it("relaie commandes et messages aux abonnés", () => {
    const commands: unknown[] = [];
    const messages: unknown[] = [];
    const offCommand = onSessionCommand((c) => commands.push(c));
    const offMessage = onSessionMessage((m) => messages.push(m));
    server({ type: "session:command", command: "Seek", seekPositionTicks: 42 });
    server({ type: "session:message", header: "Admin", text: "Bonsoir", timeoutMs: 5000 });
    expect(commands).toEqual([{ command: "Seek", seekPositionTicks: 42 }]);
    expect(messages).toEqual([{ header: "Admin", text: "Bonsoir", timeoutMs: 5000 }]);
    offCommand();
    offMessage();
  });
});
