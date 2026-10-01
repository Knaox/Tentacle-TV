/**
 * La file persistée des rapports : un arrêt n'est jamais perdu, et un rapport
 * ne part jamais périmé — ni sur une lecture plus récente, ni pour un autre
 * compte, ni pour le titre en cours.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackStateDto } from "@tentacle-tv/shared";

import {
  LIVE_NOTE_MS, OUTBOX_KEY, OUTBOX_MAX_ATTEMPTS, OUTBOX_MAX_AGE_MS,
  configurePlaybackOutbox, flushPlaybackOutbox, notePlaybackLive, notePlaybackStop, readPlaybackOutbox, settlePlayback,
  type OutboxFlushDeps, type OutboxOwner,
} from "./playbackOutbox";

const ME: OutboxOwner = { userId: "u1", deviceId: "tv1" };
let now = 1_000_000;
let owner: OutboxOwner | null = ME;
let content: Map<string, string>;

const state = (itemId: string, seconds: number): PlaybackStateDto => ({
  itemId, mediaSourceId: itemId, playMethod: "DirectPlay", positionTicks: seconds * 10_000_000, isPaused: false,
});

function deps(over: Partial<OutboxFlushDeps> = {}): OutboxFlushDeps & { sent: PlaybackStateDto[] } {
  const sent: PlaybackStateDto[] = [];
  return {
    sent,
    lastPlayedAt: over.lastPlayedAt ?? (() => Promise.resolve(null)),
    sendStop: over.sendStop ?? ((s) => { sent.push(s); return Promise.resolve(true); }),
  };
}

beforeEach(() => {
  now = 1_000_000;
  owner = ME;
  content = new Map();
  configurePlaybackOutbox({
    getItem: (k) => content.get(k) ?? null,
    setItem: (k, v) => void content.set(k, v),
    removeItem: (k) => void content.delete(k),
  }, () => owner, () => now);
});

describe("noter", () => {
  it("garde l'arrêt jusqu'à ce que le serveur l'ait pris, puis le retire", () => {
    const mark = notePlaybackStop(state("a", 120));
    expect(readPlaybackOutbox().a).toMatchObject({ kind: "stop", owner: ME });
    settlePlayback("a", mark);
    expect(content.has(OUTBOX_KEY)).toBe(false);
  });

  it("une entrée plus récente survit à la confirmation d'une plus ancienne", () => {
    const first = notePlaybackStop(state("a", 120));
    now += 5_000;
    notePlaybackLive(state("a", 10));
    settlePlayback("a", first);
    expect(readPlaybackOutbox().a).toMatchObject({ kind: "live" });
  });

  it("note la position en cours au fil de l'eau, et tout de suite à un bord", () => {
    notePlaybackLive(state("a", 10));
    now += LIVE_NOTE_MS - 1;
    notePlaybackLive(state("a", 11));
    expect(readPlaybackOutbox().a.state.positionTicks).toBe(10 * 10_000_000);
    notePlaybackLive(state("a", 12), true);
    expect(readPlaybackOutbox().a.state.positionTicks).toBe(12 * 10_000_000);
    now += LIVE_NOTE_MS;
    notePlaybackLive(state("a", 14));
    expect(readPlaybackOutbox().a.state.positionTicks).toBe(14 * 10_000_000);
  });

  it("sans session, ni sans file configurée, rien n'est noté", () => {
    owner = null;
    notePlaybackLive(state("a", 10));
    expect(notePlaybackStop(state("a", 10))).toBe(0);
    configurePlaybackOutbox(null, () => ME);
    notePlaybackLive(state("b", 10));
    expect(content.size).toBe(0);
  });
});

describe("vider", () => {
  it("rejoue l'arrêt d'une lecture que l'app n'a pas pu finir (morte en pleine lecture)", async () => {
    notePlaybackLive(state("a", 300));
    notePlaybackLive(state("b", 50));       // b est désormais la lecture en cours
    notePlaybackStop(state("b", 60));       // … et finie proprement
    settlePlayback("b", now);
    const d = deps();
    expect(await flushPlaybackOutbox(d)).toEqual({ sent: 1, dropped: 0, kept: 0 });
    expect(d.sent).toEqual([state("a", 300)]);
    expect(content.has(OUTBOX_KEY)).toBe(false);
  });

  it("n'écrase jamais une lecture plus récente du titre", async () => {
    notePlaybackStop(state("a", 300));
    const d = deps({ lastPlayedAt: () => Promise.resolve(now + 60_000) });
    expect(await flushPlaybackOutbox(d)).toMatchObject({ sent: 0, dropped: 1 });
    expect(d.sent).toEqual([]);
  });

  it("jette le rapport d'un autre compte ou d'un autre appareil, sans l'envoyer", async () => {
    notePlaybackStop(state("a", 300));
    owner = { userId: "u2", deviceId: "tv1" };
    notePlaybackStop(state("b", 30));
    const d = deps();
    expect(await flushPlaybackOutbox(d)).toEqual({ sent: 1, dropped: 1, kept: 0 });
    expect(d.sent.map((s) => s.itemId)).toEqual(["b"]);
  });

  it("ne touche pas au titre en cours de lecture", async () => {
    notePlaybackLive(state("a", 300));
    const d = deps();
    expect(await flushPlaybackOutbox(d)).toEqual({ sent: 0, dropped: 0, kept: 0 });
    expect(readPlaybackOutbox().a).toBeDefined();
  });

  it("garde tout quand le serveur ne répond pas, et compte un envoi refusé", async () => {
    notePlaybackStop(state("a", 300));
    notePlaybackStop(state("b", 30));
    expect(await flushPlaybackOutbox(deps({ lastPlayedAt: () => Promise.reject(new Error("réseau")) })))
      .toEqual({ sent: 0, dropped: 0, kept: 2 });
    expect(await flushPlaybackOutbox(deps({ sendStop: () => Promise.resolve(false) })))
      .toEqual({ sent: 0, dropped: 0, kept: 2 });
    expect(readPlaybackOutbox().a.attempts).toBe(1);
  });

  it("abandonne un rapport trop vieux, trop tenté, ou d'un titre disparu", async () => {
    notePlaybackStop(state("old", 1));
    now += OUTBOX_MAX_AGE_MS + 1;
    notePlaybackStop(state("gone", 1));
    const tired = notePlaybackStop(state("tired", 1));
    content.set(OUTBOX_KEY, JSON.stringify({
      ...readPlaybackOutbox(),
      tired: { ...readPlaybackOutbox().tired, attempts: OUTBOX_MAX_ATTEMPTS, recordedAt: tired },
    }));
    const d = deps({ lastPlayedAt: (id) => Promise.resolve(id === "gone" ? "gone" : null) });
    expect(await flushPlaybackOutbox(d)).toEqual({ sent: 0, dropped: 3, kept: 0 });
  });

  it("n'envoie pas une entrée remplacée pendant qu'il attendait le serveur", async () => {
    notePlaybackStop(state("a", 300));
    let release: (v: number | null) => void = () => {};
    const d = deps({ lastPlayedAt: () => new Promise((r) => { release = r; }) });
    const running = flushPlaybackOutbox(d);
    now += 1_000;
    notePlaybackLive(state("a", 5));        // une nouvelle lecture du titre commence
    release(null);
    expect(await running).toEqual({ sent: 0, dropped: 0, kept: 0 });
    expect(d.sent).toEqual([]);
  });

  it("un seul vidage à la fois : un second appel rejoint le premier", async () => {
    notePlaybackStop(state("a", 300));
    const send = vi.fn(() => Promise.resolve(true));
    const d = deps({ sendStop: send });
    const [x, y] = await Promise.all([flushPlaybackOutbox(d), flushPlaybackOutbox(d)]);
    expect(x).toBe(y);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
